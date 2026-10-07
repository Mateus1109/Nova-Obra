-- Arquivos anexados a leads e negócios (propostas, plantas, contratos, fotos...)
create table public.arquivos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  oportunidade_id uuid references public.oportunidades(id) on delete cascade,
  nome text not null,
  caminho text not null unique,
  tamanho bigint not null default 0,
  tipo text not null default '',
  criado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  check (lead_id is not null or oportunidade_id is not null)
);
create index arquivos_lead_idx on public.arquivos (lead_id);
create index arquivos_oport_idx on public.arquivos (oportunidade_id);

alter table public.arquivos enable row level security;
-- vê quem enxerga o lead ou o negócio (as subconsultas seguem as regras de acesso de quem consulta)
create policy arquivos_select on public.arquivos for select to authenticated using (
  usuario_ativo() and (
    exists (select 1 from public.oportunidades o where o.id = arquivos.oportunidade_id)
    or exists (select 1 from public.leads l where l.id = arquivos.lead_id)));
create policy arquivos_insert on public.arquivos for insert to authenticated
  with check (usuario_ativo() and criado_por = auth.uid());
create policy arquivos_delete on public.arquivos for delete to authenticated
  using (is_admin() or criado_por = auth.uid());

alter publication supabase_realtime add table public.arquivos;

-- Armazenamento privado (até 25 MB por arquivo); download por link assinado
insert into storage.buckets (id, name, public, file_size_limit)
values ('arquivos', 'arquivos', false, 26214400)
on conflict (id) do nothing;

create policy arquivos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'arquivos' and usuario_ativo());
create policy arquivos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'arquivos' and usuario_ativo());
create policy arquivos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'arquivos' and (owner = auth.uid() or is_admin()));
