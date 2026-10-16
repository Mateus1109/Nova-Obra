-- Chat / Multiatendimento (estilo DataCrazy): conversas de WhatsApp dentro do CRM.

-- Departamentos (para transferência entre setores)
create table public.departamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
insert into public.departamentos (nome, ordem) values ('Comercial', 1), ('Suporte', 2);

-- Uma conversa por atendimento aberto de um lead
create table public.conversas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  atendente_id uuid references public.profiles(id) on delete set null,
  departamento_id uuid references public.departamentos(id) on delete set null,
  status text not null default 'aberto' check (status in ('aberto','finalizado','oculto')),
  protocolo int not null default 1,
  conexao text not null default '',
  nao_lidas int not null default 0,
  ultima_msg text not null default '',
  ultima_msg_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index conversas_lead_idx on public.conversas (lead_id);
create index conversas_fila_idx on public.conversas (status, ultima_msg_em desc);

-- Mensagens de uma conversa (recebidas, enviadas e notas internas)
create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  direcao text not null check (direcao in ('entra','sai','nota')),
  tipo text not null default 'texto' check (tipo in ('texto','imagem','audio','video','documento')),
  texto text not null default '',
  midia_url text,
  midia_nome text,
  status text not null default 'enviada' check (status in ('agendada','enviando','enviada','entregue','lida','erro')),
  wa_id text,
  atendente_id uuid references public.profiles(id) on delete set null,
  agendada_para timestamptz,
  criado_em timestamptz not null default now()
);
create index mensagens_conversa_idx on public.mensagens (conversa_id, criado_em);

-- ===== Gatilhos =====
create or replace function public.so_digitos(t text) returns text
language sql immutable as $$ select regexp_replace(coalesce(t, ''), '\D', '', 'g') $$;

-- Protocolo sequencial por lead
create or replace function public.conversa_protocolo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.protocolo is null or new.protocolo <= 1 then
    select coalesce(max(protocolo), 0) + 1 into new.protocolo from public.conversas where lead_id = new.lead_id;
  end if;
  return new;
end; $$;
create trigger trg_conversa_protocolo before insert on public.conversas
  for each row execute function public.conversa_protocolo();

-- Cada mensagem atualiza o resumo da conversa e o contador de não lidas
create or replace function public.mensagem_atualiza_conversa() returns trigger
language plpgsql security definer set search_path = public as $$
declare resumo text;
begin
  resumo := case
    when new.direcao = 'nota' then '📝 ' || left(new.texto, 80)
    when new.tipo <> 'texto' then '[' || new.tipo || ']'
    else left(new.texto, 120)
  end;
  update public.conversas set
    ultima_msg = resumo,
    ultima_msg_em = new.criado_em,
    atualizado_em = now(),
    nao_lidas = nao_lidas + (case when new.direcao = 'entra' then 1 else 0 end)
  where id = new.conversa_id;
  return new;
end; $$;
create trigger trg_mensagem_atualiza_conversa after insert on public.mensagens
  for each row execute function public.mensagem_atualiza_conversa();

-- Usada pela Edge Function de recebimento: acha/cria o lead pelo telefone, abre/reaproveita
-- a conversa e grava a mensagem recebida. SECURITY DEFINER para rodar como serviço.
create or replace function public.registrar_msg_recebida(
  p_telefone text, p_nome text, p_texto text, p_tipo text,
  p_midia_url text, p_wa_id text, p_conexao text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare dig text; lid uuid; cid uuid;
begin
  dig := public.so_digitos(p_telefone);
  if length(dig) < 8 then raise exception 'telefone inválido'; end if;

  -- lead pelos últimos 8 dígitos (absorve 55/DDD/9º dígito); senão cria
  select id into lid from public.leads
   where length(public.so_digitos(telefone)) >= 8 and right(public.so_digitos(telefone), 8) = right(dig, 8)
   order by criado_em limit 1;
  if lid is null then
    insert into public.leads (tipo, nome, telefone, origem)
    values ('pessoa', coalesce(nullif(trim(p_nome), ''), dig), dig, 'whatsapp')
    returning id into lid;
  end if;

  -- conversa aberta do lead; senão abre nova (protocolo novo)
  select id into cid from public.conversas where lead_id = lid and status = 'aberto' order by ultima_msg_em desc limit 1;
  if cid is null then
    insert into public.conversas (lead_id, conexao) values (lid, coalesce(p_conexao, '')) returning id into cid;
  end if;

  insert into public.mensagens (conversa_id, lead_id, direcao, tipo, texto, midia_url, wa_id)
  values (cid, lid, 'entra', coalesce(nullif(p_tipo, ''), 'texto'), coalesce(p_texto, ''), p_midia_url, p_wa_id);
  return cid;
end; $$;

-- ===== RLS =====
alter table public.departamentos enable row level security;
alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;

create policy departamentos_select on public.departamentos for select to authenticated using (usuario_ativo());
create policy departamentos_todos on public.departamentos for all to authenticated using (is_admin()) with check (is_admin());

-- Atendente vê as conversas suas, as sem dono e (com permissão) as de todos; nunca as ocultas
create policy conversas_select on public.conversas for select to authenticated using (
  is_admin() or (usuario_ativo() and status <> 'oculto' and (atendente_id = auth.uid() or atendente_id is null or pode('ver_todas_obras'))));
create policy conversas_insert on public.conversas for insert to authenticated with check (usuario_ativo());
create policy conversas_update on public.conversas for update to authenticated using (
  is_admin() or (usuario_ativo() and (atendente_id = auth.uid() or atendente_id is null or pode('ver_todas_obras'))));

create policy mensagens_select on public.mensagens for select to authenticated using (
  exists (select 1 from public.conversas c where c.id = mensagens.conversa_id));
-- o atendente só insere envio/nota; o 'entra' é gravado pelo serviço (definer, ignora RLS)
create policy mensagens_insert on public.mensagens for insert to authenticated with check (
  usuario_ativo() and direcao in ('sai', 'nota') and exists (select 1 from public.conversas c where c.id = mensagens.conversa_id));
create policy mensagens_update on public.mensagens for update to authenticated using (
  usuario_ativo() and exists (select 1 from public.conversas c where c.id = mensagens.conversa_id));

alter publication supabase_realtime add table public.conversas;
alter publication supabase_realtime add table public.mensagens;
alter publication supabase_realtime add table public.departamentos;
