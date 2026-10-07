-- ============================================================================
-- Nova Obra · Colunas do funil editáveis + ficha da obra + fase no relatório
-- ============================================================================

-- ---------- Colunas (etapas) do funil, editáveis pelo diretor ----------
create table public.etapas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor text not null default '#64748b',
  ordem int not null default 0,
  -- 'ganho' e 'perdido' alimentam a taxa de conversão; as demais são 'aberta'
  tipo text not null default 'aberta' check (tipo in ('aberta','ganho','perdido')),
  criado_em timestamptz not null default now()
);

alter table public.etapas enable row level security;
create policy "etapas_select" on public.etapas for select to authenticated using (true);
create policy "etapas_insert_admin" on public.etapas for insert to authenticated with check (public.is_admin());
create policy "etapas_update_admin" on public.etapas for update to authenticated using (public.is_admin());
create policy "etapas_delete_admin" on public.etapas for delete to authenticated using (public.is_admin());

insert into public.etapas (nome, cor, ordem, tipo) values
  ('Qualificação',      '#64748b', 1, 'aberta'),
  ('Necessita Análise', '#0891b2', 2, 'aberta'),
  ('Apresentação',      '#2E78A8', 3, 'aberta'),
  ('Proposta',          '#7c3aed', 4, 'aberta'),
  ('Ganho',             '#16a34a', 5, 'ganho'),
  ('Perdido',           '#dc2626', 6, 'perdido');

-- Migra oportunidades do enum fixo para a coluna configurável
alter table public.oportunidades add column etapa_id uuid references public.etapas(id) on delete restrict;
update public.oportunidades o set etapa_id = e.id
from public.etapas e
where e.nome = case o.etapa
  when 'qualificacao' then 'Qualificação'
  when 'necessita_analise' then 'Necessita Análise'
  when 'apresentacao' then 'Apresentação'
  when 'proposta' then 'Proposta'
  when 'ganho' then 'Ganho'
  when 'perdido' then 'Perdido'
end;

-- Sem etapa informada (ex.: obra inserida pelo Cowork), entra na 1ª coluna aberta
create or replace function public.definir_etapa_padrao()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.etapa_id is null then
    select id into new.etapa_id from public.etapas where tipo = 'aberta' order by ordem limit 1;
    if new.etapa_id is null then
      select id into new.etapa_id from public.etapas order by ordem limit 1;
    end if;
  end if;
  return new;
end; $$;
revoke execute on function public.definir_etapa_padrao() from public, anon, authenticated;

create trigger trg_oport_etapa_padrao before insert on public.oportunidades
  for each row execute function public.definir_etapa_padrao();

alter table public.oportunidades alter column etapa_id set not null;
create index idx_oport_etapa_id on public.oportunidades(etapa_id);

-- A coluna antiga "etapa" (enum etapa_funil) é mantida até a versão nova do app
-- estar publicada; depois: alter table oportunidades drop column etapa; drop type etapa_funil;

alter publication supabase_realtime add table public.etapas;

-- ---------- Ficha da obra: dados que importam para concreto ----------
create type fase_obra as enum ('projeto','terraplanagem','fundacao','estrutura','alvenaria','acabamento');

alter table public.obras
  add column fase_obra fase_obra,
  add column previsao_concretagem date,
  add column pavimentos int,
  add column area_m2 numeric,
  add column fornecedor_atual text default '';

alter table public.relatorios_visita add column fase_obra fase_obra;
