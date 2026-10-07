-- 0008 · Status do negócio (ganhar/perder/restaurar), lixeira, Configurações e permissões de pipeline
-- (aplicado em produção como crm_config_tabelas, crm_status_lixeira_permissoes, crm_status_gatilhos)

-- ===== Tabelas de configuração =====
create table public.motivos_perda (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  obrigatorio boolean not null default false,   -- exige descrever o motivo ao perder
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
insert into public.motivos_perda (nome, obrigatorio, ordem) values
  ('Preço acima do concorrente', false, 1), ('Concorrente escolhido', true, 2), ('Prazo de entrega', false, 3),
  ('Limitações de orçamento', false, 4), ('Projeto cancelado', false, 5), ('Momento inadequado', false, 6),
  ('Sem interesse', false, 7), ('Requisitos mudaram', true, 8), ('Outro', true, 9);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text not null default '#3385FF',
  criado_em timestamptz not null default now()
);

create table public.tipos_atividade (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  icone text not null default 'tarefa' check (icone in ('tarefa','ligacao','whatsapp','visita','reuniao','email','proposta')),
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
insert into public.tipos_atividade (nome, icone, ordem) values
  ('Ligação','ligacao',1), ('WhatsApp','whatsapp',2), ('Visita','visita',3), ('Reunião','reuniao',4),
  ('Enviar proposta','proposta',5), ('E-mail','email',6), ('Tarefa','tarefa',7);

create table public.listas_opcoes (
  id uuid primary key default gen_random_uuid(),
  lista text not null check (lista in ('origem','segmento')),
  valor text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  unique (lista, valor)
);
insert into public.listas_opcoes (lista, valor, ordem) values
  ('segmento','Construtora',1), ('segmento','Incorporadora',2), ('segmento','Engenharia / projetos',3),
  ('segmento','Pré-moldados',4), ('segmento','Órgão público',5), ('segmento','Pessoa física (obra própria)',6), ('segmento','Outro',7),
  ('origem','Prospecção em campo',1), ('origem','Indicação',2), ('origem','Cowork / pesquisa',3), ('origem','Instagram',4),
  ('origem','Site',5), ('origem','WhatsApp',6), ('origem','Ligação',7), ('origem','Outro',8);

create table public.campos_adicionais (
  id uuid primary key default gen_random_uuid(),
  entidade text not null check (entidade in ('lead','negocio')),
  nome text not null,
  tipo text not null default 'texto' check (tipo in ('texto','numero','data','opcoes','sim_nao')),
  opcoes text[] not null default '{}',
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['motivos_perda','tags','tipos_atividade','listas_opcoes','campos_adicionais'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (usuario_ativo())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (is_admin())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (is_admin())', t || '_delete', t);
  end loop;
end $$;

-- ===== Negócio: status, lixeira, campos adicionais =====
alter table public.oportunidades add column status text not null default 'aberto' check (status in ('aberto','ganho','perdido'));
alter table public.oportunidades add column status_em timestamptz;
alter table public.oportunidades add column motivo_perda_id uuid references public.motivos_perda(id) on delete set null;
alter table public.oportunidades add column excluido_em timestamptz;
alter table public.oportunidades add column excluido_por uuid references public.profiles(id) on delete set null;
alter table public.oportunidades add column campos jsonb not null default '{}'::jsonb;
alter table public.leads add column campos jsonb not null default '{}'::jsonb;
create index oport_status_idx on public.oportunidades (status) where excluido_em is null;
alter table public.atividades add column tipo_id uuid references public.tipos_atividade(id) on delete set null;

-- ===== Etapas: requisitos para sair =====
alter table public.etapas add column requisitos text[] not null default '{}';

-- ===== Permissões por pipeline =====
alter table public.pipelines add column restrito boolean not null default false;
create table public.pipeline_membros (
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  primary key (pipeline_id, usuario_id)
);
alter table public.pipeline_membros enable row level security;
create policy pipeline_membros_select on public.pipeline_membros for select to authenticated using (usuario_ativo());
create policy pipeline_membros_insert on public.pipeline_membros for insert to authenticated with check (is_admin());
create policy pipeline_membros_delete on public.pipeline_membros for delete to authenticated using (is_admin());

create or replace function public.pode_ver_pipeline(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.usuario_ativo() and exists (
    select 1 from public.pipelines p
     where p.id = pid
       and (not p.restrito or exists (select 1 from public.pipeline_membros m where m.pipeline_id = p.id and m.usuario_id = auth.uid()))
  ));
$$;
create or replace function public.pode_ver_etapa(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.etapas e where e.id = eid and public.pode_ver_pipeline(e.pipeline_id));
$$;
alter policy pipelines_select on public.pipelines using (pode_ver_pipeline(id));
alter policy etapas_select on public.etapas using (pode_ver_pipeline(pipeline_id));
alter policy oport_select on public.oportunidades using (
  is_admin() or (usuario_ativo() and pode_ver_etapa(etapa_id) and (vendedor_id = auth.uid() or pode('ver_todas_obras'))));

-- ===== Gatilhos =====
create or replace function public.oport_status_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.status_em := case when new.status = 'aberto' then null else now() end;
    if new.status <> 'perdido' then new.motivo_perda_id := null; end if;
  end if;
  if new.excluido_em is distinct from old.excluido_em then
    if auth.uid() is not null and not public.pode('excluir_obras') then
      raise exception 'Você não tem permissão para excluir negócios.';
    end if;
    new.excluido_por := case when new.excluido_em is null then null else auth.uid() end;
  end if;
  return new;
end; $$;
create trigger trg_oport_status_guarda before update on public.oportunidades
  for each row execute function public.oport_status_guarda();

-- registrar_historico_oport: passa a registrar ganho/perdido/restaurado e lixeira (ver 0011)

-- Negócios já em colunas de ganho/perda recebem o status correspondente
update public.oportunidades o set status = e.tipo
  from public.etapas e
 where e.id = o.etapa_id and e.tipo in ('ganho','perdido') and o.status = 'aberto';

alter publication supabase_realtime add table public.motivos_perda;
alter publication supabase_realtime add table public.tags;
alter publication supabase_realtime add table public.tipos_atividade;
alter publication supabase_realtime add table public.listas_opcoes;
alter publication supabase_realtime add table public.campos_adicionais;
alter publication supabase_realtime add table public.pipeline_membros;
