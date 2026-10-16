-- OpenWA integrado ao CRM: URL/chave do gateway, sessão e token do webhook configurados
-- pela tela Configurações → WhatsApp (só o administrador lê e grava).
create table public.integracoes_segredos (
  chave text primary key,
  valor text not null default '',
  atualizado_em timestamptz not null default now()
);

alter table public.integracoes_segredos enable row level security;
create policy integracoes_segredos_admin on public.integracoes_segredos for all to authenticated
  using (is_admin()) with check (is_admin());
