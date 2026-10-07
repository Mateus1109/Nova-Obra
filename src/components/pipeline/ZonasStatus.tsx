import { useDroppable } from "@dnd-kit/core";
import { ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";

// ids das áreas de soltar (começam com "__" para não confundir com o id de uma coluna)
export const ZONA_GANHAR = "__ganhar";
export const ZONA_PERDER = "__perder";
export const ZONA_EXCLUIR = "__excluir";
export const ehZona = (id: unknown) => typeof id === "string" && id.startsWith("__");

const ZONAS = [
  { id: ZONA_GANHAR, rotulo: "Ganhar", solte: "Solte para ganhar", Icone: ThumbsUp, cor: "#22c55e", forte: "#15803d" },
  { id: ZONA_PERDER, rotulo: "Perder", solte: "Solte para perder", Icone: ThumbsDown, cor: "#f59e0b", forte: "#c2410c" },
  { id: ZONA_EXCLUIR, rotulo: "Excluir", solte: "Solte para excluir", Icone: Trash2, cor: "#ef4444", forte: "#b91c1c" },
];

/**
 * Barra que aparece no topo da tela enquanto um card é arrastado (como no DataCrazy):
 * soltar o card num dos blocos ganha, perde ou exclui o negócio.
 */
export function ZonasStatus({ podeExcluir }: { podeExcluir: boolean }) {
  const zonas = ZONAS.filter((z) => podeExcluir || z.id !== ZONA_EXCLUIR);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex justify-center px-3 lg:top-3">
      <div className="pointer-events-auto flex w-full max-w-[36rem] overflow-hidden rounded-lg shadow-[0_10px_30px_rgba(2,8,23,0.25)]">
        {zonas.map((z) => (
          <Zona key={z.id} {...z} />
        ))}
      </div>
    </div>
  );
}

function Zona({ id, rotulo, solte, Icone, cor, forte }: (typeof ZONAS)[number]) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 px-2 text-[0.9375rem] font-semibold text-white transition-colors"
      style={{
        background: isOver ? forte : cor,
        boxShadow: isOver ? "inset 0 0 0 3px rgba(255,255,255,0.75)" : undefined,
      }}
    >
      <Icone size={isOver ? 22 : 19} className="flex-shrink-0 transition-all" />
      <span className="truncate">
        {isOver ? <span className="hidden sm:inline">{solte}</span> : null}
        <span className={isOver ? "sm:hidden" : undefined}>{rotulo}</span>
      </span>
    </div>
  );
}
