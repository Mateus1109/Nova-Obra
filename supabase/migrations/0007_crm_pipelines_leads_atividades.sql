-- 0007 · CRM no padrão DataCrazy: pipelines, leads (pessoa/empresa), atividades e histórico
-- (aplicado em produção em partes: crm_pipelines, crm_leads, crm_leads_select_fix,
--  crm_atividades_historico, crm_lead_automatico)

-- Pipelines (vários funis, agrupados como no painel lateral)
create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null default '',
  grupo text not null default 'Padrão',
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.pipelines enable row level security;
create policy pipelines_select on public.pipelines for select to authenticated using (usuario_ativo());
create policy pipelines_insert on public.pipelines for insert to authenticated with check (is_admin());
create policy pipelines_update on public.pipelines for update to authenticated using (is_admin());
create policy pipelines_delete on public.pipelines for delete to authenticated using (is_admin());
insert into public.pipelines (nome, descricao, ordem) values ('Aquisição de obras', 'Funil de prospecção de novas obras', 0);

alter table public.etapas add column pipeline_id uuid references public.pipelines(id) on delete cascade;
update public.etapas set pipeline_id = (select id from public.pipelines order by ordem limit 1) where pipeline_id is null;
alter table public.etapas alter column pipeline_id set not null;
create index etapas_pipeline_idx on public.etapas(pipeline_id, ordem);

create or replace function public.definir_etapa_padrao() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.etapa_id is null then
    select e.id into new.etapa_id
      from public.etapas e join public.pipelines p on p.id = e.pipeline_id
     order by p.ordem, (e.tipo <> 'aberta'), e.ordem limit 1;
  end if;
  return new;
end; $$;

-- Leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'empresa' check (tipo in ('pessoa','empresa')),
  nome text not null,
  nome_exibicao text not null default '',
  telefone text not null default '',
  email text not null default '',
  documento text not null default '',
  segmento text not null default '',
  cargo text not null default '',
  origem text not null default '',
  data_referencia date,
  instagram text not null default '',
  site text not null default '',
  cep text not null default '',
  logradouro text not null default '',
  numero text not null default '',
  complemento text not null default '',
  bairro text not null default '',
  cidade text not null default 'São Luís',
  uf text not null default 'MA',
  notas text not null default '',
  tags text[] not null default '{}',
  empresa_id uuid references public.leads(id) on delete set null,
  contato_principal_id uuid references public.leads(id) on delete set null,
  responsavel_id uuid references public.profiles(id) on delete set null,
  criado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index leads_nome_idx on public.leads (lower(nome));
create index leads_empresa_idx on public.leads (empresa_id);

alter table public.oportunidades add column lead_id uuid references public.leads(id) on delete set null;
alter table public.oportunidades add column tags text[] not null default '{}';
alter table public.oportunidades alter column obra_id drop not null;
create index oport_lead_idx on public.oportunidades (lead_id);

alter table public.leads enable row level security;
-- sem subconsulta em leads dentro da própria política (evita recursão no RLS)
create policy leads_select on public.leads for select to authenticated using (
  is_admin() or (usuario_ativo() and (
    pode('ver_todas_obras') or responsavel_id = auth.uid() or criado_por = auth.uid()
    or exists (select 1 from public.oportunidades o where o.lead_id = leads.id))));
create policy leads_insert on public.leads for insert to authenticated with check (usuario_ativo());
create policy leads_update on public.leads for update to authenticated using (
  is_admin() or (usuario_ativo() and (responsavel_id = auth.uid() or criado_por = auth.uid()
    or exists (select 1 from public.oportunidades o where o.lead_id = leads.id and o.vendedor_id = auth.uid())
    or (pode('ver_todas_obras') and pode('mover_funil')))));
create policy leads_delete on public.leads for delete to authenticated using (pode('excluir_obras'));

-- Atividades
create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid references public.oportunidades(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  tipo text not null default 'tarefa' check (tipo in ('tarefa','ligacao','whatsapp','visita','reuniao','email','proposta')),
  titulo text not null,
  descricao text not null default '',
  data_hora timestamptz,
  concluida boolean not null default false,
  concluida_em timestamptz,
  responsavel_id uuid references public.profiles(id) on delete set null default auth.uid(),
  criado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index atividades_oport_idx on public.atividades (oportunidade_id);
create index atividades_lead_idx on public.atividades (lead_id);
alter table public.atividades enable row level security;
create policy atividades_select on public.atividades for select to authenticated using (
  is_admin() or (usuario_ativo() and (responsavel_id = auth.uid() or criado_por = auth.uid()
    or exists (select 1 from public.oportunidades o where o.id = atividades.oportunidade_id)
    or exists (select 1 from public.leads l where l.id = atividades.lead_id))));
create policy atividades_insert on public.atividades for insert to authenticated with check (usuario_ativo());
create policy atividades_update on public.atividades for update to authenticated using (
  is_admin() or (usuario_ativo() and (responsavel_id = auth.uid() or criado_por = auth.uid()
    or exists (select 1 from public.oportunidades o where o.id = atividades.oportunidade_id and o.vendedor_id = auth.uid()))));
create policy atividades_delete on public.atividades for delete to authenticated using (is_admin() or criado_por = auth.uid());

-- Histórico automático do negócio
create table public.historico (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid references public.oportunidades(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  usuario_id uuid references public.profiles(id) on delete set null default auth.uid(),
  acao text not null,
  detalhe text not null default '',
  criado_em timestamptz not null default now()
);
create index historico_oport_idx on public.historico (oportunidade_id, criado_em desc);
alter table public.historico enable row level security;
create policy historico_select on public.historico for select to authenticated using (
  is_admin() or (usuario_ativo() and (
    exists (select 1 from public.oportunidades o where o.id = historico.oportunidade_id)
    or exists (select 1 from public.leads l where l.id = historico.lead_id))));

create or replace function public.registrar_historico_oport() returns trigger
language plpgsql security definer set search_path = public as $$
declare de text; para text; nome_v text;
begin
  if tg_op = 'INSERT' then
    select nome into para from public.etapas where id = new.etapa_id;
    insert into public.historico (oportunidade_id, lead_id, acao, detalhe)
    values (new.id, new.lead_id, 'Negócio criado', coalesce('Na coluna ' || para, ''));
    return new;
  end if;
  if new.etapa_id is distinct from old.etapa_id then
    select nome into de from public.etapas where id = old.etapa_id;
    select nome into para from public.etapas where id = new.etapa_id;
    insert into public.historico (oportunidade_id, lead_id, acao, detalhe)
    values (new.id, new.lead_id, 'Mudou de etapa', coalesce(de, '?') || ' → ' || coalesce(para, '?'));
  end if;
  if new.vendedor_id is distinct from old.vendedor_id then
    select nome into nome_v from public.profiles where id = new.vendedor_id;
    insert into public.historico (oportunidade_id, lead_id, acao, detalhe)
    values (new.id, new.lead_id, 'Responsável alterado', coalesce(nome_v, 'Sem responsável'));
  end if;
  if new.valor_estimado is distinct from old.valor_estimado then
    insert into public.historico (oportunidade_id, lead_id, acao, detalhe)
    values (new.id, new.lead_id, 'Valor alterado',
      'R$ ' || to_char(coalesce(old.valor_estimado,0), 'FM999G999G990D00') || ' → R$ ' || to_char(coalesce(new.valor_estimado,0), 'FM999G999G990D00'));
  end if;
  if new.classificacao is distinct from old.classificacao then
    insert into public.historico (oportunidade_id, lead_id, acao, detalhe)
    values (new.id, new.lead_id, 'Temperatura alterada', old.classificacao::text || ' → ' || new.classificacao::text);
  end if;
  return new;
end; $$;
create trigger trg_historico_oport after insert or update on public.oportunidades
  for each row execute function public.registrar_historico_oport();

-- Negócio criado sem lead (Cowork, "Nova obra", relatório de visita) ganha o lead da construtora
create or replace function public.vincular_lead_da_obra() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text; tel text; lid uuid;
begin
  if new.lead_id is null and new.obra_id is not null then
    select nullif(trim(construtora), ''), coalesce(contato_telefone, '') into c, tel from public.obras where id = new.obra_id;
    if c is not null then
      select id into lid from public.leads where tipo = 'empresa' and lower(nome) = lower(c) order by criado_em limit 1;
      if lid is null then
        insert into public.leads (tipo, nome, telefone, segmento, responsavel_id, criado_por)
        values ('empresa', c, tel, 'Construtora', new.vendedor_id, coalesce(auth.uid(), new.vendedor_id))
        returning id into lid;
      end if;
      new.lead_id := lid;
    end if;
  end if;
  return new;
end; $$;
create trigger trg_oport_lead before insert on public.oportunidades
  for each row execute function public.vincular_lead_da_obra();

alter publication supabase_realtime add table public.pipelines;
alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.atividades;
