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
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm", lg: "px-5 py-2.5 text-[15px]" };
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
    <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
      <Building size={11} /> Empresa
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
      <User size={11} /> Pessoa
    </span>
  );
}

export function Tag({ children, onRemover }: { children: ReactNode; onRemover?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {children}
      {onRemover && (
        <button onClick={onRemover} className="text-slate-400 hover:text-red-500" aria-label="Remover tag">
          ×
        </button>
      )}
    </span>
  );
}

/**
 * Campo exibido como texto e editado no lugar (clique no lápis), como nos dados cadastrais do CRM.
 * `onSalvar` recebe o texto já sem espaços nas pontas.
 */
export function CampoEditavel({
  label,
  valor,
  onSalvar,
  tipo = "text",
  opcoes,
  link,
  podeEditar = true,
}: {
  label: string;
  valor: string | null | undefined;
  onSalvar: (v: string) => void;
  tipo?: "text" | "date" | "email" | "tel" | "url";
  opcoes?: string[];
  link?: string | null;
  podeEditar?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor ?? "");
  const salvar = () => {
    setEditando(false);
    if ((v ?? "").trim() !== (valor ?? "")) onSalvar((v ?? "").trim());
  };
  const exibido =
    tipo === "date" && valor ? new Date(valor + "T00:00:00").toLocaleDateString("pt-BR") : valor;

  return (
    <div className="group min-w-0">
      <p className="text-[13px] text-slate-500">{label}</p>
      {editando ? (
        opcoes ? (
          <select
            autoFocus
            value={v}
            onChange={(e) => setV(e.target.value)}
            onBlur={salvar}
            className={cx(inputCls, "mt-1 py-1.5")}
          >
            <option value="">Não informado</option>
            {opcoes.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            type={tipo}
            value={v}
            onChange={(e) => setV(e.target.value)}
            onBlur={salvar}
            onKeyDown={(e) => {
              if (e.key === "Enter") salvar();
              if (e.key === "Escape") {
                setV(valor ?? "");
                setEditando(false);
              }
            }}
            className={cx(inputCls, "mt-1 py-1.5")}
          />
        )
      ) : (
        <div className="mt-0.5 flex min-h-[26px] items-center gap-1.5">
          {exibido ? (
            link ? (
              <a href={link} target="_blank" rel="noreferrer" className="truncate font-medium text-aco-600 hover:underline">
                {exibido}
              </a>
            ) : (
              <span className="truncate font-medium text-marinho-800">{exibido}</span>
            )
          ) : (
            <span className="italic text-slate-400">Não informado</span>
          )}
          {podeEditar && (
            <button
              onClick={() => {
                setV(valor ?? "");
                setEditando(true);
              }}
              className="text-slate-300 opacity-60 hover:text-aco-600 group-hover:opacity-100"
              aria-label={`Editar ${label}`}
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
