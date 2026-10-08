import type { Card } from "./data";
import { REQUISITOS_ETAPA, type Etapa, type RequisitoEtapa } from "./types";

/** O negócio cumpre a condição? */
function cumpre(req: RequisitoEtapa, card: Card): boolean {
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
    default:
      return true;
  }
}

/**
 * Condições da etapa ATUAL que o negócio ainda não cumpre para poder sair dela
 * (Configurações de etapa). Lista vazia = pode mover.
 */
export function faltandoParaSair(card: Card, etapaAtual: Etapa | undefined): string[] {
  const reqs = etapaAtual?.requisitos ?? [];
  return reqs
    .filter((r) => !cumpre(r, card))
    .map((r) => REQUISITOS_ETAPA.find((x) => x.key === r)?.label ?? r);
}
