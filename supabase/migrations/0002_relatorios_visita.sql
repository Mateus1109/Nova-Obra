-- ============================================================================
-- Nova Obra · Relatórios de visita (com fotos)
-- ============================================================================

create type tipo_relatorio as enum ('cliente','aquisicao');
create type resultado_visita as enum ('pedido_fechado','proposta_solicitada','em_negociacao','retornar','sem_interesse');

create table public.relatorios_visita (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete set null,
  oportunidade_id uuid references public.oportunidades(id) on delete set null,
  tipo tipo_relatorio not null,
  nome_obra text not null,
  construtora text default '',
  contato_nome text default '',
  contato_cargo text default '',
  contato_telefone text default '',
  bairro text default '',
  endereco text default '',
  latitude numeric,
  longitude numeric,
  data_visita date not null default current_date,
  hora_inicio time,
  hora_fim time,
  objetivo text default '',
  resumo text not null default '',
  resultado resultado_visita not null default 'em_negociacao',
  interesse classificacao not null default 'morno',
  produto_interesse produto_alvo,
  volume_estimado_m3 numeric default 0,
  concorrente text default '',
  proximo_passo text default '',
  data_retorno date,
  fotos text[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_rel_vendedor on public.relatorios_visita(vendedor_id);
create index idx_rel_data on public.relatorios_visita(data_visita desc);

create trigger trg_rel_touch before update on public.relatorios_visita
  for each row execute function public.touch_atualizado_em();

alter table public.relatorios_visita enable row level security;

create policy "rel_select" on public.relatorios_visita for select to authenticated
  using (public.is_admin() or vendedor_id = auth.uid());
create policy "rel_insert" on public.relatorios_visita for insert to authenticated
  with check (public.is_admin() or vendedor_id = auth.uid());
create policy "rel_update" on public.relatorios_visita for update to authenticated
  using (public.is_admin() or vendedor_id = auth.uid());
create policy "rel_delete" on public.relatorios_visita for delete to authenticated
  using (public.is_admin() or vendedor_id = auth.uid());

alter publication supabase_realtime add table public.relatorios_visita;

-- ---------- Storage: fotos dos relatórios (bucket privado) ----------
-- Cada vendedor grava em <uid>/...; o diretor (admin) lê tudo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('relatorios-fotos', 'relatorios-fotos', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "fotos_insert_proprio" on storage.objects for insert to authenticated
  with check (bucket_id = 'relatorios-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos_select" on storage.objects for select to authenticated
  using (bucket_id = 'relatorios-fotos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'relatorios-fotos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
