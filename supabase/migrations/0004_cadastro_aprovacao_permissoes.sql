-- 0004 · Cadastro aberto com aprovação do administrador + permissões por usuário
-- Fluxo: a pessoa toca em "Criar conta" → entra como 'pendente' (não vê nada) →
-- o administrador libera em "Equipe e acessos" e escolhe o que ela pode fazer.

-- Status e permissões (linhas existentes ficaram 'ativo' com cadastrar_obras + mover_funil)
alter table public.profiles add column if not exists status text not null default 'pendente';
alter table public.profiles add constraint profiles_status_chk check (status in ('pendente','ativo','bloqueado'));
alter table public.profiles add column if not exists permissoes jsonb not null default '{}'::jsonb;
-- chaves usadas em permissoes: cadastrar_obras, mover_funil, ver_todas_obras,
-- excluir_obras, ver_relatorios_equipe, ver_painel (admin tem todas)

-- E-mails que já entram como administrador ao se cadastrar
create table if not exists public.admin_emails (email text primary key);
alter table public.admin_emails enable row level security; -- sem políticas: só o banco lê
-- insert into public.admin_emails(email) values ('<email do dono>');

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'ativo');
$$;

create or replace function public.usuario_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ativo');
$$;

create or replace function public.pode(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'ativo'
      and (role = 'admin' or coalesce((permissoes ->> p)::boolean, false))
  );
$$;

-- Só o administrador muda papel/status/permissões; sempre sobra 1 admin ativo
create or replace function public.profiles_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.ativo := (new.status = 'ativo');
  if tg_op = 'UPDATE' then
    if auth.uid() is not null and not public.is_admin() and (
         new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.permissoes is distinct from old.permissoes
      or new.email is distinct from old.email) then
      raise exception 'Somente o administrador pode alterar acessos.';
    end if;
    if old.role = 'admin' and old.status = 'ativo'
       and (new.role <> 'admin' or new.status <> 'ativo')
       and not exists (select 1 from public.profiles
                       where role = 'admin' and status = 'ativo' and id <> old.id) then
      raise exception 'É preciso manter pelo menos um administrador ativo.';
    end if;
  end if;
  return new;
end; $$;

create trigger trg_profiles_guarda before insert or update on public.profiles
  for each row execute function public.profiles_guarda();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare eh_admin boolean;
begin
  select exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) into eh_admin;
  insert into public.profiles (id, nome, email, telefone, role, status, permissoes)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'telefone', ''),
    case when eh_admin then 'admin'::app_role else 'vendedor'::app_role end,
    case when eh_admin then 'ativo' else 'pendente' end,
    '{}'::jsonb
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- RLS: pendente/bloqueado não vê nada; o resto segue as permissões
alter policy obras_select on public.obras using (is_admin() or (usuario_ativo() and (pode('ver_todas_obras') or criado_por = auth.uid() or exists (select 1 from public.oportunidades o where o.obra_id = obras.id and o.vendedor_id = auth.uid()))));
alter policy obras_insert on public.obras with check (pode('cadastrar_obras'));
alter policy obras_update on public.obras using (is_admin() or (usuario_ativo() and (criado_por = auth.uid() or exists (select 1 from public.oportunidades o where o.obra_id = obras.id and o.vendedor_id = auth.uid()) or (pode('ver_todas_obras') and pode('mover_funil')))));
alter policy obras_delete_admin on public.obras using (pode('excluir_obras'));

alter policy oport_select on public.oportunidades using (is_admin() or (usuario_ativo() and (vendedor_id = auth.uid() or pode('ver_todas_obras'))));
alter policy oport_insert on public.oportunidades with check (is_admin() or (pode('cadastrar_obras') and vendedor_id = auth.uid()));
alter policy oport_update on public.oportunidades using (is_admin() or (pode('mover_funil') and (vendedor_id = auth.uid() or pode('ver_todas_obras')))) with check (is_admin() or vendedor_id = auth.uid() or pode('ver_todas_obras'));
alter policy oport_delete_admin on public.oportunidades using (pode('excluir_obras'));

alter policy inter_select on public.interacoes using (is_admin() or (usuario_ativo() and exists (select 1 from public.oportunidades o where o.id = interacoes.oportunidade_id and (o.vendedor_id = auth.uid() or pode('ver_todas_obras')))));
alter policy inter_insert on public.interacoes with check (usuario_id = auth.uid() and usuario_ativo());

alter policy rel_select on public.relatorios_visita using (is_admin() or (usuario_ativo() and (vendedor_id = auth.uid() or pode('ver_relatorios_equipe'))));
alter policy rel_insert on public.relatorios_visita with check (is_admin() or (usuario_ativo() and vendedor_id = auth.uid()));
alter policy rel_update on public.relatorios_visita using (is_admin() or (usuario_ativo() and vendedor_id = auth.uid()));
alter policy rel_delete on public.relatorios_visita using (is_admin() or (usuario_ativo() and vendedor_id = auth.uid()));

alter policy visitas_select on public.visitas using (is_admin() or (usuario_ativo() and (vendedor_id = auth.uid() or pode('ver_relatorios_equipe'))));
alter policy visitas_insert on public.visitas with check (is_admin() or (usuario_ativo() and vendedor_id = auth.uid()));
alter policy visitas_update on public.visitas using (is_admin() or (usuario_ativo() and vendedor_id = auth.uid()));
alter policy visitas_delete on public.visitas using (is_admin() or (usuario_ativo() and vendedor_id = auth.uid()));

alter policy etapas_select on public.etapas using (usuario_ativo());
alter policy profiles_select_vendedores on public.profiles using (usuario_ativo() or id = auth.uid());

alter policy fotos_select on storage.objects using (bucket_id = 'relatorios-fotos' and ((storage.foldername(name))[1] = auth.uid()::text or pode('ver_relatorios_equipe')));
alter policy fotos_insert_proprio on storage.objects with check (bucket_id = 'relatorios-fotos' and (storage.foldername(name))[1] = auth.uid()::text and usuario_ativo());

-- Aprovação/bloqueio chegam na hora para a pessoa
alter publication supabase_realtime add table public.profiles;
