import type { Card } from "./data";
import { REQUISITOS_ETAPA, type Atividade, type Etapa, type RequisitoEtapa } from "./types";

/** O negócio cumpre a condição? */
function cumpre(req: RequisitoEtapa, card: Card, atividades: Atividade[]): boolean {
  switch (req) {
    case "valor":
      return (card.valor_estimado ?? 0) > 0;
    case "atendente":
      return !!card.vendedor_id;
    case "obra":
      return !!card.obra_id;
    case "previsao_fechamento":
      return !!card.previsao_fechamento;
    case "telefone_lead":
      return !!(card.lead?.telefone || card.obra?.contato_telefone);
    case "fase_obra":
      return !!card.obra?.fase_obra;
    case "atividade_pendente":
      return atividades.some((a) => a.oportunidade_id === card.id && !a.concluida);
    default:
      return true;
  }
}

/**
 * Condições da etapa ATUAL que o negócio ainda não cumpre para poder sair dela
 * (Configurações de etapa). Lista vazia = pode mover.
 */
export function faltandoParaSair(card: Card, etapaAtual: Etapa | undefined, atividades: Atividade[]): string[] {
  const reqs = etapaAtual?.requisitos ?? [];
  return reqs
    .filter((r) => !cumpre(r, card, atividades))
    .map((r) => REQUISITOS_ETAPA.find((x) => x.key === r)?.label ?? r);
}
