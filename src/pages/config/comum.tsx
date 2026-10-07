import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useData, type TabelaConfig } from "@/lib/data";
import { Button, Input } from "@/components/ui";
import { cx } from "@/lib/utils";

/* ---------- Texto ---------- */

/** minúsculas e sem acento, para pesquisar "orcamento" e achar "Orçamento" */
export const normalizar = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const contem = (texto: string, busca: string) => normalizar(texto).includes(normalizar(busca.trim()));

/** "07/10/2026 14:32" */
export const dataHora = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/* ---------- Cabeçalho, pesquisa e botões ---------- */

/** Título grande da seção + subtítulo + ações à direita (padrão DataCrazy) */
export function CabecalhoSecao({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-[12rem]">
        <h2 className="text-[1.375rem] font-semibold leading-tight text-marinho-800 lg:text-[1.75rem]">{titulo}</h2>
        <p className="mt-1 text-sm text-slate-500 lg:text-[0.9375rem]">{subtitulo}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function BotaoCriar({ onClick, rotulo = "Criar" }: { onClick: () => void; rotulo?: string }) {
  return (
    <Button onClick={onClick}>
      <Plus size={16} /> {rotulo}
    </Button>
  );
}

/** Campo "Pesquisar..." com a contagem de resultados ao lado; `children` fica à direita (ações em massa) */
export function BarraPesquisa({
  valor,
  onChange,
  total,
  children,
}: {
  valor: string;
  onChange: (v: string) => void;
  total: number;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <Input value={valor} onChange={(e) => onChange(e.target.value)} placeholder="Pesquisar..." className="py-2 pl-9" />
      </div>
      <span className="text-sm text-slate-500">{plural(total, "resultado", "resultados")}</span>
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Faixa que aparece quando há linhas marcadas */
export function BarraSelecao({ qtd, onLimpar, children }: { qtd: number; onLimpar: () => void; children: ReactNode }) {
  if (!qtd) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-aco-200 bg-aco-50 px-3 py-2">
      <span className="text-sm font-medium text-marinho-800">{plural(qtd, "selecionado", "selecionados")}</span>
      <button onClick={onLimpar} className="text-sm text-aco-600 hover:underline">
        Limpar
      </button>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Pílula verde "✓ Sim" / vermelha "✕ Não" */
export function PilulaSimNao({ sim, rotuloSim = "Sim", rotuloNao = "Não" }: { sim: boolean; rotuloSim?: string; rotuloNao?: string }) {
  return sim ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      <Check size={12} strokeWidth={3} /> {rotuloSim}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
      <X size={12} strokeWidth={3} /> {rotuloNao}
    </span>
  );
}

/** Interruptor liga/desliga */
export function Interruptor({
  ligado,
  onChange,
  rotulo,
  disabled,
}: {
  ligado: boolean;
  onChange: (v: boolean) => void;
  rotulo: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(!ligado);
      }}
      className={cx(
        "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition disabled:opacity-50",
        ligado ? "bg-aco-500" : "bg-slate-300"
      )}
    >
      <span
        className={cx(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          ligado ? "translate-x-[1.125rem]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

/** Linha "interruptor + texto" usada nos formulários */
export function LinhaInterruptor({
  ligado,
  onChange,
  titulo,
  desc,
}: {
  ligado: boolean;
  onChange: (v: boolean) => void;
  titulo: string;
  desc?: string;
}) {
  return (
    <div
      role="presentation"
      onClick={() => onChange(!ligado)}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-3 hover:bg-slate-50"
    >
      <div className="pt-0.5">
        <Interruptor ligado={ligado} onChange={onChange} rotulo={titulo} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-marinho-800">{titulo}</p>
        {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
      </div>
    </div>
  );
}

/** Caixa de seleção (com estado "parcial" para o marcar todos) */
export function Caixa({ marcado, parcial, onChange, rotulo }: { marcado: boolean; parcial?: boolean; onChange: () => void; rotulo: string }) {
  return (
    <input
      type="checkbox"
      aria-label={rotulo}
      checked={marcado}
      ref={(el) => {
        if (el) el.indeterminate = !!parcial && !marcado;
      }}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 align-middle accent-aco-500"
    />
  );
}

/** Botão só com ícone (editar, excluir, subir...) */
export function BotaoIcone({
  titulo,
  onClick,
  perigo,
  disabled,
  children,
}: {
  titulo: string;
  onClick: () => void;
  perigo?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cx(
        "grid h-8 w-8 flex-shrink-0 place-items-center rounded-md text-slate-500 transition disabled:pointer-events-none disabled:opacity-30",
        perigo ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-slate-100 hover:text-marinho-800"
      )}
    >
      {children}
    </button>
  );
}

export function AcoesEditarExcluir({ onEditar, onExcluir, nome }: { onEditar: () => void; onExcluir: () => void; nome: string }) {
  return (
    <>
      <BotaoIcone titulo={`Editar ${nome}`} onClick={onEditar}>
        <Pencil size={15} />
      </BotaoIcone>
      <BotaoIcone titulo={`Excluir ${nome}`} onClick={onExcluir} perigo>
        <Trash2 size={15} />
      </BotaoIcone>
    </>
  );
}

export function BotoesOrdem({
  onMover,
  primeiro,
  ultimo,
  disabled,
}: {
  onMover: (dir: -1 | 1) => void;
  primeiro: boolean;
  ultimo: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      <BotaoIcone titulo="Subir" onClick={() => onMover(-1)} disabled={primeiro || disabled}>
        <ChevronUp size={16} />
      </BotaoIcone>
      <BotaoIcone titulo="Descer" onClick={() => onMover(1)} disabled={ultimo || disabled}>
        <ChevronDown size={16} />
      </BotaoIcone>
    </>
  );
}

/** Rodapé padrão dos modais de cadastro */
export function RodapeModal({
  onCancelar,
  onSalvar,
  salvando,
  rotulo = "Salvar",
  desabilitado,
}: {
  onCancelar: () => void;
  onSalvar: () => void;
  salvando: boolean;
  rotulo?: string;
  desabilitado?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="secondary" onClick={onCancelar} disabled={salvando}>
        Cancelar
      </Button>
      <Button onClick={onSalvar} disabled={salvando || desabilitado}>
        {salvando ? "Salvando..." : rotulo}
      </Button>
    </div>
  );
}

export function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{texto}</p>;
}

/* ---------- Seleção múltipla ---------- */

export function useSelecao(visiveis: string[]) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  // só conta quem ainda aparece (pesquisa/filtro e itens já excluídos ficam de fora)
  const ids = useMemo(() => visiveis.filter((id) => sel.has(id)), [visiveis, sel]);
  const todos = visiveis.length > 0 && ids.length === visiveis.length;
  return {
    ids,
    todos,
    parcial: ids.length > 0 && !todos,
    tem: (id: string) => sel.has(id),
    alternar: (id: string) =>
      setSel((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    alternarTodos: () => setSel(todos ? new Set() : new Set(visiveis)),
    limpar: () => setSel(new Set()),
  };
}
export type Selecao = ReturnType<typeof useSelecao>;

/* ---------- Tabela (vira cartões no celular) ---------- */

export interface Coluna<T> {
  titulo: string;
  celula: (l: T) => ReactNode;
  /** classes da coluna no computador (largura, alinhamento) */
  className?: string;
  /** false = não aparece no cartão do celular */
  celular?: boolean;
}

/**
 * Tabela no computador e lista de cartões no celular.
 * A primeira coluna vira o título do cartão; as demais aparecem como "rótulo: valor".
 */
export function Tabela<T extends { id: string }>({
  linhas,
  colunas,
  selecao,
  acoes,
  vazio,
  apagada,
}: {
  linhas: T[];
  colunas: Coluna<T>[];
  selecao?: Selecao;
  acoes?: (l: T, i: number) => ReactNode;
  vazio: ReactNode;
  /** linha esmaecida (ex.: inativa) */
  apagada?: (l: T) => boolean;
}) {
  if (!linhas.length)
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
        {vazio}
      </div>
    );
  const [principal, ...resto] = colunas;
  const doCelular = resto.filter((c) => c.celular !== false);

  return (
    <>
      {/* Computador */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-[0.9375rem] text-marinho-800">
          <thead>
            <tr className="border-b border-slate-200 text-[0.8125rem] text-slate-500">
              {selecao && (
                <th className="w-10 py-3 pl-4">
                  <Caixa marcado={selecao.todos} parcial={selecao.parcial} onChange={selecao.alternarTodos} rotulo="Selecionar todos" />
                </th>
              )}
              {colunas.map((c) => (
                <th key={c.titulo} className={cx("px-4 py-3 font-medium", c.className)}>
                  {c.titulo}
                </th>
              ))}
              {acoes && (
                <th className="w-px px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l, i) => (
              <tr
                key={l.id}
                className={cx(
                  "transition hover:bg-slate-50/80",
                  selecao?.tem(l.id) && "bg-aco-50/60",
                  apagada?.(l) && "text-slate-400"
                )}
              >
                {selecao && (
                  <td className="py-2.5 pl-4">
                    <Caixa marcado={selecao.tem(l.id)} onChange={() => selecao.alternar(l.id)} rotulo="Selecionar linha" />
                  </td>
                )}
                {colunas.map((c) => (
                  <td key={c.titulo} className={cx("px-4 py-2.5 align-middle", c.className)}>
                    {c.celula(l)}
                  </td>
                ))}
                {acoes && (
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-0.5">{acoes(l, i)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular */}
      <div className="space-y-2 md:hidden">
        {selecao && linhas.length > 1 && (
          <label className="flex items-center gap-2 px-1 py-1 text-sm text-slate-600">
            <Caixa marcado={selecao.todos} parcial={selecao.parcial} onChange={selecao.alternarTodos} rotulo="Selecionar todos" />
            Selecionar todos
          </label>
        )}
        {linhas.map((l, i) => (
          <div
            key={l.id}
            className={cx(
              "rounded-lg border p-3",
              selecao?.tem(l.id) ? "border-aco-200 bg-aco-50/60" : "border-slate-200 bg-white",
              apagada?.(l) && "text-slate-400"
            )}
          >
            <div className="flex items-start gap-2.5">
              {selecao && (
                <div className="pt-1">
                  <Caixa marcado={selecao.tem(l.id)} onChange={() => selecao.alternar(l.id)} rotulo="Selecionar" />
                </div>
              )}
              <div className="min-w-0 flex-1 break-words pt-0.5 text-[0.9375rem] font-medium">{principal.celula(l)}</div>
              {acoes && <div className="-my-1 -mr-1 flex flex-shrink-0 items-center">{acoes(l, i)}</div>}
            </div>
            {doCelular.length > 0 && (
              <dl className={cx("mt-2 grid grid-cols-2 gap-x-3 gap-y-2", selecao && "pl-[1.625rem]")}>
                {doCelular.map((c) => (
                  <div key={c.titulo} className="min-w-0">
                    <dt className="text-[0.6875rem] text-slate-400">{c.titulo}</dt>
                    <dd className="mt-0.5 text-sm">{c.celula(l)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Gravações em lote ---------- */

/** Exclusão em massa e reordenação das tabelas de configuração (um recarregar no fim) */
export function useLoteConfig() {
  const { recarregar, avisar, excluirConfig } = useData();
  const [ocupado, setOcupado] = useState(false);

  /** um item usa excluirConfig; vários vão numa única exclusão */
  const excluirVarios = async (tabela: TabelaConfig, ids: string[]) => {
    if (!ids.length) return true;
    setOcupado(true);
    let ok = true;
    if (ids.length === 1) ok = await excluirConfig(tabela, ids[0]);
    else {
      const { error } = await supabase.from(tabela).delete().in("id", ids);
      if (error) {
        avisar("Não foi possível excluir.");
        ok = false;
      } else await recarregar();
    }
    setOcupado(false);
    if (ok) avisar(ids.length === 1 ? "Item excluído." : `${ids.length} itens excluídos.`, "ok");
    return ok;
  };

  /** grava a ordem 1, 2, 3... da lista recebida (só as linhas que mudaram) */
  const reordenar = async (tabela: TabelaConfig, lista: { id: string; ordem: number }[]) => {
    const mudou = lista.map((l, i) => ({ id: l.id, ordem: i + 1, antes: l.ordem })).filter((l) => l.ordem !== l.antes);
    if (!mudou.length) return;
    setOcupado(true);
    const res = await Promise.all(mudou.map((l) => supabase.from(tabela).update({ ordem: l.ordem }).eq("id", l.id)));
    if (res.some((r) => r.error)) avisar("Não foi possível reordenar.");
    await recarregar();
    setOcupado(false);
  };

  return { excluirVarios, reordenar, ocupado };
}

/** troca o item i de lugar com o vizinho (sem alterar a lista original) */
export function trocar<T>(lista: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= lista.length) return lista;
  const n = [...lista];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

/** próxima posição no fim da lista */
export const proximaOrdem = (lista: { ordem: number }[]) => lista.reduce((m, l) => Math.max(m, l.ordem ?? 0), 0) + 1;
