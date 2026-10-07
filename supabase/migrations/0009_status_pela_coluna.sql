-- Negócio em aberto que entra numa coluna de ganho/perda recebe o status da coluna,
-- seja qual for o caminho (arrastar, "mover todos", excluir coluna, painel na página Leads).
-- O nome do gatilho ordena antes de trg_oport_status_guarda, que então preenche status_em.
create or replace function public.oport_status_pela_coluna() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id then return new; end if;
  if new.status is distinct from 'aberto' then return new; end if;
  select tipo into t from public.etapas where id = new.etapa_id;
  if t in ('ganho', 'perdido') then
    new.status := t;
    if tg_op = 'INSERT' then new.status_em := now(); end if;
  end if;
  return new;
end; $$;

create trigger trg_oport_coluna_status before insert or update of etapa_id on public.oportunidades
  for each row execute function public.oport_status_pela_coluna();
