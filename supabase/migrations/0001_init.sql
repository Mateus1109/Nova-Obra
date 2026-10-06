-- ============================================================================
-- Nova Obra · Megamix — Schema completo (Supabase / Postgres)
-- Aplicado no projeto hdpqnzwjynsziuqhrnxq via MCP. Este arquivo é a referência
-- versionada do backend (enums, tabelas, índices, triggers, RLS e realtime).
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- ENUMs ----------
create type tipo_obra       as enum ('vertical','condominio','comercial','galpao','publica');
create type status_obra     as enum ('lancamento','em_andamento');
create type produto_alvo    as enum ('concreto_usinado','bombeado','bomba_lanca','locacao_bomba');
create type origem_obra     as enum ('levantamento','indicacao','licitacao','outro');
create type etapa_funil     as enum ('qualificacao','necessita_analise','apresentacao','proposta','ganho','perdido');
create type classificacao   as enum ('frio','morno','quente');
create type status_visita   as enum ('agendada','realizada','remarcada','cancelada');
create type tipo_interacao  as enum ('visita','ligacao','whatsapp','email');
create type app_role        as enum ('admin','vendedor');

-- ---------- Tabelas ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null, telefone text default '', email text not null,
  role app_role not null default 'vendedor', zona_atuacao text default '',
  ativo boolean not null default true, criado_em timestamptz not null default now()
);

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  nome_obra text not null, construtora text default '',
  tipo tipo_obra not null default 'vertical',
  status_obra status_obra not null default 'lancamento',
  bairro text default '', cidade text default 'São Luís', uf text default 'MA',
  endereco text default '', latitude numeric, longitude numeric,
  produto_alvo produto_alvo not null default 'concreto_usinado',
  volume_estimado_m3 numeric default 0,
  contato_nome text default '', contato_cargo text default '',
  contato_telefone text default '', contato_email text default '',
  origem origem_obra not null default 'levantamento', observacoes text default '',
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  vendedor_id uuid references public.profiles(id) on delete set null,
  etapa etapa_funil not null default 'qualificacao',
  classificacao classificacao not null default 'frio',
  proxima_etapa_data date, previsao_fechamento date,
  motivo_perda text, concorrente text, valor_estimado numeric default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  vendedor_id uuid references public.profiles(id) on delete set null,
  data_visita date not null default current_date,
  status_visita status_visita not null default 'agendada',
  resultado text default '', proximo_passo text default '',
  criado_em timestamptz not null default now()
);

create table public.interacoes (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references public.oportunidades(id) on delete cascade,
  tipo tipo_interacao not null default 'visita', descricao text default '',
  data timestamptz not null default now(),
  usuario_id uuid references public.profiles(id) on delete set null
);

-- ---------- Índices ----------
create index idx_oport_vendedor on public.oportunidades(vendedor_id);
create index idx_oport_etapa    on public.oportunidades(etapa);
create index idx_oport_obra      on public.oportunidades(obra_id);
create index idx_obras_status    on public.obras(status_obra);
create index idx_obras_bairro    on public.obras(bairro);
create index idx_visitas_vendedor on public.visitas(vendedor_id);
create index idx_visitas_data     on public.visitas(data_visita);
create index idx_interacoes_oport on public.interacoes(oportunidade_id);

-- ---------- Triggers / Funções ----------
create or replace function public.touch_atualizado_em()
returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em = now(); return new; end; $$;

create trigger trg_oport_touch before update on public.oportunidades
  for each row execute function public.touch_atualizado_em();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke execute on function public.is_admin() from anon;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email, 'vendedor')
  on conflict (id) do nothing;
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS ----------
alter table public.profiles      enable row level security;
alter table public.obras         enable row level security;
alter table public.oportunidades enable row level security;
alter table public.visitas       enable row level security;
alter table public.interacoes    enable row level security;

create policy "profiles_select_vendedores" on public.profiles for select to authenticated using (true);
create policy "profiles_update" on public.profiles for update to authenticated using (public.is_admin() or id = auth.uid());
create policy "profiles_insert_admin" on public.profiles for insert to authenticated with check (public.is_admin());

create policy "obras_select" on public.obras for select to authenticated using (
  public.is_admin() or criado_por = auth.uid()
  or exists (select 1 from public.oportunidades o where o.obra_id = obras.id and o.vendedor_id = auth.uid()));
create policy "obras_insert" on public.obras for insert to authenticated with check (auth.uid() is not null);
create policy "obras_update" on public.obras for update to authenticated using (
  public.is_admin() or criado_por = auth.uid()
  or exists (select 1 from public.oportunidades o where o.obra_id = obras.id and o.vendedor_id = auth.uid()));
create policy "obras_delete_admin" on public.obras for delete to authenticated using (public.is_admin());

create policy "oport_select" on public.oportunidades for select to authenticated using (public.is_admin() or vendedor_id = auth.uid());
create policy "oport_insert" on public.oportunidades for insert to authenticated with check (public.is_admin() or vendedor_id = auth.uid());
create policy "oport_update" on public.oportunidades for update to authenticated using (public.is_admin() or vendedor_id = auth.uid());
create policy "oport_delete_admin" on public.oportunidades for delete to authenticated using (public.is_admin());

create policy "visitas_select" on public.visitas for select to authenticated using (public.is_admin() or vendedor_id = auth.uid());
create policy "visitas_insert" on public.visitas for insert to authenticated with check (public.is_admin() or vendedor_id = auth.uid());
create policy "visitas_update" on public.visitas for update to authenticated using (public.is_admin() or vendedor_id = auth.uid());
create policy "visitas_delete" on public.visitas for delete to authenticated using (public.is_admin() or vendedor_id = auth.uid());

create policy "inter_select" on public.interacoes for select to authenticated using (
  public.is_admin() or exists (select 1 from public.oportunidades o where o.id = interacoes.oportunidade_id and o.vendedor_id = auth.uid()));
create policy "inter_insert" on public.interacoes for insert to authenticated with check (usuario_id = auth.uid());

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.oportunidades;
alter publication supabase_realtime add table public.obras;
alter publication supabase_realtime add table public.visitas;
