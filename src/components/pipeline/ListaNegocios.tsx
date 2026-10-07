import { tituloCard, type Card } from "@/lib/data";
import type { Etapa } from "@/lib/types";
import { Avatar, Select } from "@/components/ui";
import { SeloStatus } from "@/components/StatusNegocio";
import { brl, cx } from "@/lib/utils";
import { statusDe } from "./pecas";

/** Visão em lista do pipeline (troca de etapa pelo seletor, com as mesmas regras do quadro) */
export function ListaNegocios({
  cards,
  etapas,
  podeMover,
  onOpen,
  onEtapa,
}: {
  cards: Card[];
  etapas: Etapa[];
  podeMover: boolean;
  onOpen: (id: string) => void;
  onEtapa: (c: Card, etapaId: string) => void;
}) {
  if (cards.length === 0)
    return (
      <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Nenhum negócio com os filtros atuais.
      </div>
    );
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="hidden grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
        <div className="col-span-4">Lead / obra</div>
        <div className="col-span-2">Atendente</div>
        <div className="col-span-4">Etapa</div>
        <div className="col-span-2 text-right">Valor</div>
      </div>
      <div className="divide-y divide-slate-100">
        {cards.map((c) => {
          const status = statusDe(c);
          return (
            <div
              key={c.id}
              className={cx(
                "grid grid-cols-2 items-center gap-2 px-4 py-3 lg:grid-cols-12",
                status === "ganho" && "border-l-4 border-l-green-500",
                status === "perdido" && "border-l-4 border-l-red-500"
              )}
            >
              <button onClick={() => onOpen(c.id)} className="col-span-2 flex items-center gap-3 text-left lg:col-span-4">
                <Avatar nome={tituloCard(c)} size={32} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-medium text-marinho-800 hover:text-aco-600">{tituloCard(c)}</p>
                    <SeloStatus status={status} />
                  </div>
                  <p className="truncate text-xs text-slate-500">{c.obra?.nome_obra ?? "Sem obra"}</p>
                </div>
              </button>
              <p className="truncate text-sm text-marinho-800 lg:col-span-2">{c.vendedor?.nome ?? "Sem atendente"}</p>
              <div className="lg:col-span-4">
                <Select value={c.etapa_id} onChange={(e) => onEtapa(c, e.target.value)} disabled={!podeMover} className="py-1.5 text-sm">
                  {etapas.map((et) => (
                    <option key={et.id} value={et.id}>{et.nome}</option>
                  ))}
                </Select>
              </div>
              <p className="text-right font-semibold text-marinho-800 lg:col-span-2">{brl(c.valor_estimado || 0)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
