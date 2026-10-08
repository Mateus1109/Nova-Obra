import { useState, type SyntheticEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Banknote, CalendarDays, CircleUserRound, Tags } from "lucide-react";
import { tituloCard, useData, type Card } from "@/lib/data";
import { FASE_LABEL } from "@/lib/types";
import { Avatar, SeloTipo, Tag } from "@/components/ui";
import { SeloStatus } from "@/components/StatusNegocio";
import { CampoTags } from "@/components/NovoLead";
import { useAuth } from "@/lib/auth";
import { brl, cx, dataBR } from "@/lib/utils";
import { statusDe } from "./pecas";

// Botões dentro do card não podem iniciar o arraste nem abrir o painel
const parar = (e: SyntheticEvent) => e.stopPropagation();
const naoArrasta = { onPointerDown: parar, onMouseDown: parar, onTouchStart: parar, onClick: parar, onKeyDown: parar };

interface Props {
  card: Card;
  numero: number;
}

/** Card do quadro, arrastável entre colunas e para a barra Ganhar / Perder / Excluir */
export function KanbanCard({ arrastavel, onOpen, ...p }: Props & { arrastavel: boolean; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.card.id, disabled: !arrastavel });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(p.card.id)}
      // touch-manipulation: no celular dá para rolar a coluna deslizando; segurar o dedo inicia o arraste
      className={cx(
        "touch-manipulation select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-aco-500",
        arrastavel ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-40"
      )}
      style={{ WebkitTouchCallout: "none" }}
    >
      <CartaoNegocio {...p} />
    </div>
  );
}

/** Aparência do card (também usada na cópia que segue o cursor durante o arraste) */
export function CartaoNegocio({ card, numero, sobreposto }: Props & { sobreposto?: boolean }) {
  const { atualizarOportunidade, corTag } = useData();
  // editar tags é alterar o negócio: só quem pode mover no funil (mesma regra do banco)
  const podeEditar = useAuth().pode("mover_funil");
  const [tags, setTags] = useState(false);
  const nome = tituloCard(card);
  const status = statusDe(card);

  return (
    <div
      className={cx(
        "rounded-lg border border-slate-200 bg-white p-4 transition",
        status === "ganho" && "border-l-4 border-l-green-500",
        status === "perdido" && "border-l-4 border-l-red-500",
        sobreposto ? "rotate-[2deg] cursor-grabbing shadow-[0_16px_40px_rgba(2,8,23,0.22)]" : "hover:border-slate-300 hover:shadow-card"
      )}
      title={status === "perdido" && card.motivo_perda ? `Perdido: ${card.motivo_perda}` : undefined}
    >
      <div className="flex items-start gap-3">
        <Avatar nome={nome} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[1.0625rem] font-semibold text-marinho-800">{nome}</p>
            {card.lead && <SeloTipo tipo={card.lead.tipo} />}
          </div>
          <p className="truncate text-sm text-aco-600 underline underline-offset-2">{card.obra?.nome_obra ?? "Sem obra"}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-slate-400">#{numero}</span>
          <SeloStatus status={status} />
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <p className="flex items-center gap-2.5 text-slate-500">
          <CircleUserRound size={16} className="flex-shrink-0" />
          <span className={card.vendedor ? "text-marinho-800" : "text-aco-600 underline underline-offset-2"}>
            {card.vendedor?.nome ?? "Sem atendente"}
          </span>
        </p>
        <p className="flex items-center gap-2.5 text-slate-500">
          <Banknote size={16} className="flex-shrink-0" />
          <span className="text-aco-600 underline underline-offset-2">{brl(card.valor_estimado || 0)}</span>
        </p>
        <p className="flex items-center gap-2.5 text-slate-500">
          <CalendarDays size={16} className="flex-shrink-0" />
          {dataBR(card.criado_em)}
          {card.obra?.fase_obra && (
            <span className="ml-auto rounded bg-slate-100 px-1.5 text-[0.6875rem] text-slate-600">{FASE_LABEL[card.obra.fase_obra]}</span>
          )}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5" {...naoArrasta}>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {(card.tags ?? []).map((t) => (
            <Tag key={t} cor={corTag(t)}>
              {t}
            </Tag>
          ))}
        </div>
        {podeEditar && (
          <button onClick={() => setTags((v) => !v)} className="text-slate-500 hover:text-aco-600" aria-label="Tags">
            <Tags size={18} />
          </button>
        )}
      </div>
      {tags && podeEditar && !sobreposto && (
        <div className="mt-2" {...naoArrasta}>
          <CampoTags tags={card.tags ?? []} onChange={(t) => atualizarOportunidade(card.id, { tags: t })} />
        </div>
      )}
    </div>
  );
}
