-- 0006 · Cadastro sem confirmação por e-mail
-- Quem controla o acesso é o administrador (status 'pendente' → 'ativo'), então o e-mail
-- é confirmado automaticamente e a pessoa já entra direto na tela "aguardando liberação".
create or replace function public.auto_confirmar_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end; $$;

create trigger trg_auto_confirmar_email before insert on auth.users
  for each row execute function public.auto_confirmar_email();

-- E-mail do dono como administrador (já entra liberado ao se cadastrar)
insert into public.admin_emails(email) values ('mateus.klein@megamixconstrucoes.com.br') on conflict do nothing;
