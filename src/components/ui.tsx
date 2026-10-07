import { useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Building, Pencil, User } from "lucide-react";
import { corAvatar, cx, iniciais } from "@/lib/utils";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-aco-500 text-white hover:bg-aco-600 shadow-sm",
    secondary: "border border-slate-200 bg-white text-marinho-800 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-green-600 text-white hover:bg-green-700",
  };
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm", lg: "px-5 py-2.5 text-[0.9375rem]" };
  return <button className={cx(base, variants[variant], sizes[size], className)} {...p} />;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-lg bg-white shadow-card border border-slate-200", className)}>
      {children}
    </div>
  );
}

export function Badge({ children, bg, fg }: { children: ReactNode; bg?: string; fg?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: bg ?? "#e2e8f0", color: fg ?? "#475569" }}
    >
      {children}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-marinho-800">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-[#D7DBDF] bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-aco-500 focus:ring-2 focus:ring-aco-100";

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}
export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, "min-h-[80px] resize-y", p.className)} />;
}
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, "appearance-none bg-white", p.className)} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-marinho-900/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className={cx(
          "w-full rounded-t-2xl sm:rounded-lg bg-white shadow-cardhover max-h-[92vh] overflow-y-auto",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h3 className="text-lg font-bold text-marinho-800">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon, titulo, texto }: { icon: ReactNode; titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center">
      <div className="mb-3 text-aco-500">{icon}</div>
      <p className="font-bold text-marinho-800">{titulo}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{texto}</p>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-10">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-aco-100 border-t-aco-500" />
    </div>
  );
}

export function Avatar({ nome, size = 36, className }: { nome: string; size?: number; className?: string }) {
  const c = corAvatar(nome);
  return (
    <div
      className={cx("grid flex-shrink-0 place-items-center rounded-full font-semibold", className)}
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.42 }}
    >
      {iniciais(nome)}
    </div>
  );
}

/** Selo "Empresa" / "Pessoa" no padrão do CRM */
export function SeloTipo({ tipo }: { tipo: "pessoa" | "empresa" }) {
  return tipo === "empresa" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[0.6875rem] font-medium text-purple-700">
      <Building size={11} /> Empresa
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[0.6875rem] font-medium text-sky-700">
      <User size={11} /> Pessoa
    </span>
  );
}

/** Tag; com `cor` usa a cor configurada em Configurações → Tags */
export function Tag({ children, onRemover, cor }: { children: ReactNode; onRemover?: () => void; cor?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
        !cor && "bg-slate-100 text-slate-600"
      )}
      style={cor ? { background: `${cor}1f`, color: cor } : undefined}
    >
      {children}
      {onRemover && (
        <button onClick={onRemover} className="text-slate-400 hover:text-red-500" aria-label="Remover tag">
          ×
        </button>
      )}
    </span>
  );
}

/** Opção do CampoEditavel: texto simples ou valor gravado + rótulo exibido */
export type OpcaoCampo = string | { valor: string; rotulo: string };

type ElCampo = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * Campo exibido como texto e editado no lugar, como nos dados cadastrais do CRM:
 * clique no valor (ou no lápis) para editar; Enter ou sair do campo salva, Esc cancela.
 * Em texto longo (textarea) o Enter quebra linha e Ctrl+Enter salva.
 * `onSalvar` recebe o texto já sem espaços nas pontas (números e datas também chegam como texto).
 */
export function CampoEditavel({
  label,
  valor,
  onSalvar,
  tipo = "text",
  opcoes,
  obrigatorio,
  link,
  sufixo,
  icone,
  destaque,
  podeEditar = true,
}: {
  label: string;
  valor: string | number | null | undefined;
  onSalvar: (v: string) => void;
  tipo?: "text" | "date" | "email" | "tel" | "url" | "number" | "textarea";
  /** vira uma lista; aceita ["A", "B"] ou [{ valor: "a", rotulo: "A" }] */
  opcoes?: OpcaoCampo[];
  /** lista sem a opção "Não informado" */
  obrigatorio?: boolean;
  link?: string | null;
  /** unidade exibida depois do valor (ex.: "m³") */
  sufixo?: string;
  icone?: ReactNode;
  /** caixinha cinza com rótulo em caixa alta (destaques da obra) */
  destaque?: boolean;
  podeEditar?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const atual = valor == null ? "" : String(valor);
  const ops = opcoes?.map((o) => (typeof o === "string" ? { valor: o, rotulo: o } : o));
  // valor antigo que saiu da configuração continua aparecendo na lista
  if (ops && atual && !ops.some((o) => o.valor === atual)) ops.unshift({ valor: atual, rotulo: atual });

  // cada edição termina uma vez só (Enter seguido do blur não salva duas vezes; Esc não salva)
  const terminar = (el: ElCampo, gravar: boolean, novo = el.value) => {
    if (el.dataset.fim) return;
    el.dataset.fim = "1";
    setEditando(false);
    if (gravar && novo.trim() !== atual.trim()) onSalvar(novo.trim());
  };
  const teclas = (e: React.KeyboardEvent<ElCampo>) => {
    if (e.key === "Escape") {
      e.stopPropagation(); // não fecha o painel/modal em volta
      terminar(e.currentTarget, false);
    } else if (e.key === "Enter" && (tipo !== "textarea" || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      terminar(e.currentTarget, true);
    }
  };
  // já abre o calendário / a lista (no celular evita um segundo toque)
  const abrirSeletor = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    try {
      (e.currentTarget as HTMLInputElement).showPicker?.();
    } catch {
      /* navegador sem suporte */
    }
  };

  let exibido = "";
  if (atual) {
    const rotulo = ops?.find((o) => o.valor === atual)?.rotulo;
    exibido =
      rotulo ??
      (tipo === "date"
        ? new Date(atual.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR")
        : tipo === "number" && !isNaN(Number(atual))
          ? Number(atual).toLocaleString("pt-BR")
          : atual);
    if (sufixo) exibido += ` ${sufixo}`;
  }

  const cls = cx(
    "mt-1 w-full rounded-md border border-[#D7DBDF] bg-white py-1.5 text-base outline-none focus:border-aco-500 focus:ring-2 focus:ring-aco-100 lg:text-sm",
    destaque ? "px-2" : "px-3"
  );
  const editor = ops ? (
    <select
      autoFocus
      defaultValue={atual}
      onChange={(e) => terminar(e.currentTarget, true)}
      onBlur={() => setEditando(false)}
      onKeyDown={teclas}
      onFocus={abrirSeletor}
      className={cx(cls, "appearance-none")}
    >
      {!obrigatorio && <option value="">Não informado</option>}
      {ops.map((o) => (
        <option key={o.valor} value={o.valor}>{o.rotulo}</option>
      ))}
    </select>
  ) : tipo === "textarea" ? (
    <textarea
      autoFocus
      defaultValue={atual}
      rows={4}
      onBlur={(e) => terminar(e.currentTarget, true)}
      onKeyDown={teclas}
      className={cx(cls, "min-h-[5rem] resize-y")}
    />
  ) : (
    <input
      autoFocus
      type={tipo}
      defaultValue={atual}
      inputMode={tipo === "number" ? "decimal" : undefined}
      step={tipo === "number" ? "any" : undefined}
      onBlur={(e) => terminar(e.currentTarget, true)}
      onKeyDown={teclas}
      onFocus={tipo === "date" ? abrirSeletor : undefined}
      className={cls}
    />
  );

  const conteudo = exibido ? (
    <span
      className={cx(
        "min-w-0 text-marinho-800 [overflow-wrap:anywhere]",
        destaque ? "font-bold" : "font-medium",
        tipo === "textarea" && "whitespace-pre-wrap"
      )}
    >
      {exibido}
    </span>
  ) : destaque ? (
    <span className="font-bold text-slate-400">—</span>
  ) : (
    <span className="italic text-slate-400">Não informado</span>
  );

  return (
    <div className={cx("group min-w-0", destaque && "rounded-lg border border-slate-200 bg-slate-50 p-2.5 sm:p-3")}>
      <p
        className={cx(
          "flex items-center gap-1 text-slate-500",
          destaque ? "text-[0.6875rem] font-bold uppercase tracking-wide" : "text-[0.8125rem]"
        )}
      >
        {icone}
        {label}
      </p>
      {editando ? (
        editor
      ) : (
        <div className="mt-0.5 flex min-h-[2rem] items-center gap-1.5">
          {link && exibido ? (
            <>
              <a href={link} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium text-aco-600 hover:underline">
                {exibido}
              </a>
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="flex-shrink-0 text-slate-300 opacity-60 hover:text-aco-600 group-hover:opacity-100"
                  aria-label={`Editar ${label}`}
                >
                  <Pencil size={13} />
                </button>
              )}
            </>
          ) : podeEditar ? (
            <button
              type="button"
              onClick={() => setEditando(true)}
              title="Clique para editar"
              className={cx(
                "-mx-1.5 flex min-w-0 max-w-[calc(100%+0.75rem)] gap-1.5 rounded-md px-1.5 py-0.5 text-left transition",
                destaque ? "hover:bg-white" : "hover:bg-slate-100",
                tipo === "textarea" ? "items-start" : "items-center"
              )}
            >
              {conteudo}
              <Pencil
                size={13}
                className={cx("flex-shrink-0 text-slate-300 opacity-60 group-hover:text-aco-600 group-hover:opacity-100", tipo === "textarea" && "mt-1")}
                aria-label={`Editar ${label}`}
              />
            </button>
          ) : (
            conteudo
          )}
        </div>
      )}
    </div>
  );
}
