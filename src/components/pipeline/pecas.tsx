import type { ReactNode } from "react";
import { Check, Minus, X } from "lucide-react";
import type { Card } from "@/lib/data";
import type { StatusNegocio } from "@/lib/types";
import { cx } from "@/lib/utils";

/** Status do negócio (linhas antigas sem a coluna contam como "em aberto") */
export const statusDe = (c: Pick<Card, "status">): StatusNegocio => c.status ?? "aberto";

/** "1 negócio" / "3 negócios" */
export const qtdNegocios = (n: number) => `${n} negócio${n === 1 ? "" : "s"}`;

/** Botão tracejado do topo do quadro (Filtros, Ordenação) */
export function BotaoTopo({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 items-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-3.5 text-sm font-medium text-marinho-800 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

/** Chip "Rótulo | valor" dos filtros ativos */
export function Chip({ rotulo, valor, onClick, onRemover }: { rotulo: string; valor: string; onClick?: () => void; onRemover?: () => void }) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white text-sm">
      <button onClick={onClick} className="flex items-center gap-1.5 px-2.5 py-1">
        <span className="text-marinho-800">{rotulo}</span>
        <span className="h-4 w-px bg-slate-200" />
        <span className="text-aco-600">{valor}</span>
      </button>
      {onRemover && (
        <button onClick={onRemover} className="pr-2 text-slate-400 hover:text-red-500" aria-label={`Remover filtro ${rotulo}`}>
          <X size={14} />
        </button>
      )}
    </span>
  );
}

/** Menu suspenso simples, ancorado no botão que o abriu */
export function Pop({
  children,
  onClose,
  largura = "w-56",
  esquerda,
}: {
  children: ReactNode;
  onClose: () => void;
  largura?: string;
  esquerda?: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className={cx("absolute top-11 z-40 rounded-lg border border-slate-200 bg-white p-1 shadow-cardhover", largura, esquerda ? "left-0" : "right-0")}>
        {children}
      </div>
    </>
  );
}

/**
 * Menu largo: no computador abre como popover sob o botão; no celular vira uma
 * gaveta que sobe de baixo (cabe melhor em 390px e fica perto do polegar).
 */
export function Folha({ children, onClose, titulo, largura }: { children: ReactNode; onClose: () => void; titulo: string; largura: string }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-marinho-900/40 sm:z-30 sm:bg-transparent" onClick={onClose} />
      <div
        className={cx(
          "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-cardhover",
          "sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-12 sm:z-40 sm:max-h-[calc(100vh-8rem)] sm:rounded-lg sm:border sm:border-slate-200 sm:pb-0",
          largura
        )}
        role="menu"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 sm:hidden">
          <span className="font-semibold text-marinho-800">{titulo}</span>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export function ItemMenu({
  icon,
  children,
  onClick,
  perigo,
  ativo,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  perigo?: boolean;
  ativo?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
        perigo ? "text-red-600 hover:bg-red-50" : ativo ? "bg-aco-50 font-medium text-aco-700" : "text-marinho-800 hover:bg-slate-50"
      )}
    >
      {icon} <span className="flex-1">{children}</span>
      {ativo && <Check size={15} />}
    </button>
  );
}

/** Caixa de seleção no padrão do CRM (aceita estado "parcial" para o selecionar todos) */
export function Caixa({
  marcada,
  parcial,
  onChange,
  disabled,
  rotulo,
}: {
  marcada: boolean;
  parcial?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  rotulo?: string;
}) {
  const cheia = marcada || parcial;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={parcial && !marcada ? "mixed" : marcada}
      aria-label={rotulo}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!marcada);
      }}
      className={cx(
        "grid h-[1.125rem] w-[1.125rem] flex-shrink-0 place-items-center rounded border transition",
        cheia ? "border-aco-500 bg-aco-500 text-white" : "border-slate-300 bg-white hover:border-aco-500",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {marcada ? <Check size={12} strokeWidth={3} /> : parcial ? <Minus size={12} strokeWidth={3} /> : null}
    </button>
  );
}

/** Interruptor liga/desliga */
export function Interruptor({ ligado, onChange, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => onChange(!ligado)}
      className={cx("relative h-6 w-11 flex-shrink-0 rounded-full transition-colors", ligado ? "bg-aco-500" : "bg-slate-300")}
    >
      <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", ligado ? "left-[1.375rem]" : "left-0.5")} />
    </button>
  );
}

/** Título de seção em caixa alta (PRINCIPAIS AÇÕES, OUTROS...) */
export function TituloSecao({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("px-3 pb-1.5 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400", className)}>{children}</p>;
}
