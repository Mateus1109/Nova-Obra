-- Versão de produção de registrar_historico_oport (aplicada junto com a 0008):
-- além de etapa, responsável e valor, registra ganho/perdido/restaurado e lixeira.
-- Guardada aqui para que um banco recriado pelas migrações tenha o mesmo histórico.
create or replace function public.registrar_historico_oport() returns trigger
language plpgsql security definer set search_path = public as $$
declare de text; para text; nome_v text; motivo text;
begin
  if tg_op = 'INSERT' then
    select nome into para from public.etapas where id = new.etapa_id;
    insert into public.historico (oportunidade_id, lead_id, acao, detalhe)
    values (new.id, new.lead_id, 'Negócio criado', coalesce('Na coluna ' || para, ''));
    return new;
  end if;
  if new.etapa_id is distinct from old.etapa_id then
    select nome into de from public.etapas where id = old.etapa_id;
    select nome into para from public.etapas where id = new.etapa_id;
    insert into public.historico (oportunidade_id, lead_id, acao, detalhe)
    values (new.id, new.lead_id, 'Mudou de etapa', coalesce(de, '?') || ' → ' || coalesce(para, '?'));
  end if;
  if new.status is distinct from old.status then
    if new.status = 'perdido' then
      select nome into motivo from public.motivos_perda where id = new.motivo_perda_id;
    end if;
    insert into public.historico (oportunidade_id, lead_id, acao, detalhe)
    values (new.id, new.lead_id,
      case new.status when 'ganho' then 'Negócio ganho' when 'perdido' then 'Negócio perdido' else 'Status restaurado' end,
      case
        when new.status = 'ganho' then 'Valor: R$ ' || to_char(coalesce(new.valor_estimado,0), 'FM999G999G990D00')
        when new.status = 'perdido' then concat_ws(' · ', motivo, nullif(new.motivo_perda, ''))
        else 'Voltou para em aberto'
      end);
  end if;
  if new.excluido_em is distinct from old.excluido_em then
    insert into public.historico (oportunidade_id, lead_id, acao, detalhe)
    values (new.id, new.lead_id, case when new.excluido_em is null then 'Restaurado da lixeira' else 'Enviado para a lixeira' end, '');
  end if;
  if new.vendedor_id is distinct from old.vendedor_id then
    select nome into nome_v from public.profiles where id = new.vendedor_id;
    insert into public.historico (oportunidade_id, lead_id, acao, detalhe)
    values (new.id, new.lead_id, 'Responsável alterado', coalesce(nome_v, 'Sem responsável'));
  end if;
  if new.valor_estimado is distinct from old.valor_estimado then
    insert into public.historico (oportunidade_id, lead_id, acao, detalhe)
    values (new.id, new.lead_id, 'Valor alterado',
      'R$ ' || to_char(coalesce(old.valor_estimado,0), 'FM999G999G990D00') || ' → R$ ' || to_char(coalesce(new.valor_estimado,0), 'FM999G999G990D00'));
  end if;
  return new;
end; $$;
