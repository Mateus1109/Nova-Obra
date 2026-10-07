-- Renomear uma tag troca o nome em todos os leads e negócios (inclusive os da lixeira),
-- sem diferenciar maiúsculas e sem duplicar a tag quando o novo nome já estava na lista.
create or replace function public.trocar_tag(lista text[], antigo text, novo text) returns text[]
language sql immutable as $$
  select coalesce(array(
    select x from (
      select case when lower(t) = lower(antigo) then novo else t end as x, min(i) as i
        from unnest(lista) with ordinality as u(t, i)
       group by 1
    ) s order by i
  ), '{}');
$$;

create or replace function public.renomear_tag(antigo text, novo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem renomear tags.';
  end if;
  if coalesce(trim(novo), '') = '' then return; end if;
  update public.leads set tags = public.trocar_tag(tags, antigo, trim(novo))
   where exists (select 1 from unnest(tags) t where lower(t) = lower(antigo));
  update public.oportunidades set tags = public.trocar_tag(tags, antigo, trim(novo))
   where exists (select 1 from unnest(tags) t where lower(t) = lower(antigo));
end; $$;

revoke all on function public.renomear_tag(text, text) from public, anon;
grant execute on function public.renomear_tag(text, text) to authenticated;
