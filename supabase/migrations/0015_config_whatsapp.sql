-- Configurações gerais do sistema (chave/valor). Começa com o provedor de WhatsApp.
create table public.config (
  chave text primary key,
  valor text not null default '',
  atualizado_em timestamptz not null default now()
);
insert into public.config (chave, valor) values ('whatsapp_provedor', 'openwa');

alter table public.config enable row level security;
create policy config_select on public.config for select to authenticated using (usuario_ativo());
create policy config_admin on public.config for all to authenticated using (is_admin()) with check (is_admin());

alter publication supabase_realtime add table public.config;
