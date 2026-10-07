import { useMemo, useState } from "react";
import { AlertTriangle, MoveRight, RotateCcw, Search, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import { tituloCard, useData, type Card } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { faltandoParaSair } from "@/lib/requisitos";
import { STATUS_NEGOCIO, type Pipeline, type StatusNegocio } from "@/lib/types";
import { Avatar, Button, Input, Select } from "@/components/ui";
import { ConfirmarModal, PerderModal, SeloStatus } from "@/components/StatusNegocio";
import { brl, cx } from "@/lib/utils";
import type { AcaoMassa } from "./MenuPipeline";
import { Caixa, qtdNegocios, statusDe } from "./pecas";

const TODOS: StatusNegocio[] = ["aberto", "ganho", "perdido"];

const ACOES: Record<
  AcaoMassa,
  {
    titulo: string;
    desc: string;
    verbo: string;
    Icone: typeof MoveRight;
    variante: "primary" | "success" | "danger";
    cor: string;
    /** status que podem receber a ação */
    status: StatusNegocio[];
  }
> = {
  mover: {
    titulo: "Mover negócios",
    desc: "Selecione os negócios e escolha para qual coluna levá-los.",
    verbo: "Mover",
    Icone: MoveRight,
    variante: "primary",
    cor: "bg-aco-50 text-aco-600",
    status: TODOS,
  },
  ganhar: {
    titulo: "Ganhar negócios",
    desc: "Marca como ganhos os negócios em aberto selecionados.",
    verbo: "Ganhar",
    Icone: ThumbsUp,
    variante: "success",
    cor: "bg-green-50 text-green-600",
    status: ["aberto"],
  },
  perder: {
    titulo: "Perder negócios",
    desc: "Marca como perdidos os negócios em aberto selecionados (pede o motivo).",
    verbo: "Perder",
    Icone: ThumbsDown,
    variante: "danger",
    cor: "bg-amber-50 text-amber-600",
    status: ["aberto"],
  },
  restaurar: {
    titulo: "Restaurar status",
    desc: "Reabre negócios ganhos ou perdidos: eles voltam para “Em aberto”.",
    verbo: "Restaurar",
    Icone: RotateCcw,
    variante: "primary",
    cor: "bg-aco-50 text-aco-600",
    status: ["ganho", "perdido"],
  },
  excluir: {
    titulo: "Excluir negócios",
    desc: "Os negócios selecionados vão para a lixeira (dá para restaurar em Configurações → Lixeira).",
    verbo: "Excluir",
    Icone: Trash2,
    variante: "danger",
    cor: "bg-red-50 text-red-600",
    status: TODOS,
  },
};

/**
 * Ações em massa do pipeline (menu ⋮ → Outros): mover, ganhar, perder, restaurar status e excluir
 * vários negócios de uma vez, com busca e filtros por coluna e status.
 */
export function AcoesEmMassa({ acao, pipeline, onClose }: { acao: AcaoMassa; pipeline: Pipeline; onClose: () => void }) {
  const { cards, etapas, pipelines, atividades, moverNegocios, ganharNegocios, restaurarStatus, excluirNegocios } = useData();
  const { isAdmin } = useAuth();
  const cfg = ACOES[acao];

  const colunas = useMemo(() => etapas.filter((e) => e.pipeline_id === pipeline.id), [etapas, pipeline.id]);
  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);
  // negócios do pipeline que podem receber esta ação (os filtros da tela do quadro não se aplicam)
  const base = useMemo(() => {
    const ids = new Set(colunas.map((c) => c.id));
    const ordem = new Map(colunas.map((c, i) => [c.id, i]));
    return cards
      .filter((c) => ids.has(c.etapa_id) && cfg.status.includes(statusDe(c)))
      .sort((a, b) => (ordem.get(a.etapa_id) ?? 0) - (ordem.get(b.etapa_id) ?? 0) || tituloCard(a).localeCompare(tituloCard(b)));
  }, [cards, colunas, cfg.status]);

  const [busca, setBusca] = useState("");
  const [fColuna, setFColuna] = useState("");
  const [fStatus, setFStatus] = useState<StatusNegocio | "">("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [destPipe, setDestPipe] = useState(pipeline.id);
  const [destEtapa, setDestEtapa] = useState(colunas[0]?.id ?? "");
  const [perder, setPerder] = useState<{ ids: string[]; depois?: () => Promise<unknown> } | null>(null);
  const [excluir, setExcluir] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const q = busca.trim().toLowerCase();
  const visiveis = base.filter((c) => {
    if (fColuna && c.etapa_id !== fColuna) return false;
    if (fStatus && statusDe(c) !== fStatus) return false;
    if (
      q &&
      !`${tituloCard(c)} ${c.obra?.nome_obra ?? ""} ${c.vendedor?.nome ?? ""} ${c.lead?.telefone ?? ""}`.toLowerCase().includes(q)
    )
      return false;
    return true;
  });
  const selecionados = base.filter((c) => sel.has(c.id));
  const marcadosVisiveis = visiveis.filter((c) => sel.has(c.id)).length;
  const todosVisiveis = visiveis.length > 0 && marcadosVisiveis === visiveis.length;

  // Mover: destino e condições de saída da etapa atual
  const colunasDestino = etapas.filter((e) => e.pipeline_id === destPipe);
  const destino = etapaPorId.get(destEtapa);
  const bloqueados = acao === "mover" ? selecionados.filter((c) => c.etapa_id !== destEtapa && faltandoParaSair(c, etapaPorId.get(c.etapa_id), atividades).length > 0) : [];
  // o administrador pode mover mesmo assim; os demais só levam quem cumpre as condições
  const aMover = acao === "mover" ? selecionados.filter((c) => c.etapa_id !== destEtapa && (isAdmin || !bloqueados.includes(c))) : selecionados;
  const qtd = aMover.length;

  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const alternarTodos = () =>
    setSel((s) => {
      const n = new Set(s);
      visiveis.forEach((c) => (todosVisiveis ? n.delete(c.id) : n.add(c.id)));
      return n;
    });

  async function confirmar() {
    const ids = aMover.map((c) => c.id);
    if (!ids.length) return;
    if (acao === "perder") return setPerder({ ids });
    if (acao === "excluir") return setExcluir(true);
    if (acao === "mover") {
      if (!destino) return;
      // coluna de perda: pede o motivo antes e só então move
      if (destino.tipo === "perdido") {
        const abertos = aMover.filter((c) => statusDe(c) !== "perdido").map((c) => c.id);
        if (abertos.length) return setPerder({ ids: abertos, depois: () => moverNegocios(ids, destino.id) });
      }
    }
    setOcupado(true);
    let ok = false;
    if (acao === "mover" && destino) {
      ok = await moverNegocios(ids, destino.id);
      // coluna de ganho: os negócios movidos também ficam ganhos
      const ganhar = aMover.filter((c) => statusDe(c) !== "ganho").map((c) => c.id);
      if (ok && destino.tipo === "ganho" && ganhar.length) await ganharNegocios(ganhar);
    } else if (acao === "ganhar") ok = await ganharNegocios(ids);
    else if (acao === "restaurar") ok = await restaurarStatus(ids);
    setOcupado(false);
    if (ok) onClose();
  }

  const statusFiltraveis = cfg.status.length > 1 ? cfg.status : [];
  const rotuloBotao = `${cfg.verbo} ${qtd > 0 ? qtdNegocios(qtd) : "negócios"}`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-marinho-900/50 sm:items-center sm:p-4" onClick={onClose} aria-modal="true">
        <div
          className="flex h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-cardhover sm:h-auto sm:max-h-[88vh] sm:max-w-5xl sm:rounded-lg"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={cfg.titulo}
        >
          {/* Cabeçalho */}
          <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
            <span className={cx("grid h-10 w-10 flex-shrink-0 place-items-center rounded-md", cfg.cor)}>
              <cfg.Icone size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-marinho-800">{cfg.titulo}</h3>
              <p className="text-sm text-slate-500">
                {cfg.desc} <span className="hidden sm:inline">Pipeline: {pipeline.nome}.</span>
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, obra ou atendente..." className="py-2 pl-9" />
            </div>
            <div className="flex gap-2">
              <Select value={fColuna} onChange={(e) => setFColuna(e.target.value)} className="py-2 sm:w-44" aria-label="Filtrar por coluna">
                <option value="">Todas as colunas</option>
                {colunas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </Select>
              {statusFiltraveis.length > 0 ? (
                <Select value={fStatus} onChange={(e) => setFStatus(e.target.value as StatusNegocio | "")} className="py-2 sm:w-40" aria-label="Filtrar por status">
                  <option value="">Todos os status</option>
                  {statusFiltraveis.map((s) => (
                    <option key={s} value={s}>{STATUS_NEGOCIO[s].label}</option>
                  ))}
                </Select>
              ) : (
                <span className="flex flex-shrink-0 items-center whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                  Só em aberto
                </span>
              )}
            </div>
          </div>

          {/* Destino (mover) */}
          {acao === "mover" && (
            <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <span className="text-sm font-medium text-marinho-800 sm:w-24">Mover para</span>
              <div className="flex flex-1 gap-2">
                {pipelines.length > 1 && (
                  <Select
                    value={destPipe}
                    onChange={(e) => {
                      setDestPipe(e.target.value);
                      setDestEtapa(etapas.find((x) => x.pipeline_id === e.target.value)?.id ?? "");
                    }}
                    className="py-2"
                    aria-label="Pipeline de destino"
                  >
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </Select>
                )}
                <Select value={destEtapa} onChange={(e) => setDestEtapa(e.target.value)} className="py-2" aria-label="Coluna de destino">
                  {colunasDestino.length === 0 && <option value="">Sem colunas</option>}
                  {colunasDestino.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                      {c.tipo === "ganho" ? " (ganho)" : c.tipo === "perdido" ? " (perdido)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {/* Selecionar todos */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_11rem_8rem_6rem] sm:px-5">
            <Caixa
              marcada={todosVisiveis}
              parcial={marcadosVisiveis > 0}
              onChange={alternarTodos}
              disabled={visiveis.length === 0}
              rotulo="Selecionar todos"
            />
            <button onClick={alternarTodos} disabled={visiveis.length === 0} className="text-left uppercase">
              Selecionar todos <span className="font-normal normal-case text-slate-400">({visiveis.length})</span>
            </button>
            <span className="hidden sm:block">Coluna</span>
            <span className="hidden text-right sm:block">Valor</span>
            <span className="hidden sm:block">Status</span>
          </div>

          {/* Lista */}
          <div className="min-h-[12rem] flex-1 overflow-y-auto bg-slate-50 p-3 sm:bg-white sm:p-0">
            {visiveis.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-slate-500">
                {base.length === 0
                  ? acao === "restaurar"
                    ? "Nenhum negócio ganho ou perdido neste pipeline."
                    : acao === "ganhar" || acao === "perder"
                      ? "Nenhum negócio em aberto neste pipeline."
                      : "Este pipeline ainda não tem negócios."
                  : "Nenhum negócio com esses filtros."}
              </p>
            ) : (
              <div className="space-y-2 sm:space-y-0 sm:divide-y sm:divide-slate-100">
                {visiveis.map((c) => (
                  <Linha
                    key={c.id}
                    card={c}
                    marcado={sel.has(c.id)}
                    coluna={etapaPorId.get(c.etapa_id)}
                    alerta={acao === "mover" && sel.has(c.id) && bloqueados.includes(c)}
                    onToggle={() => alternar(c.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Avisos e rodapé */}
          {bloqueados.length > 0 && (
            <p className="flex items-start gap-2 border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 sm:px-5">
              <AlertTriangle size={14} className="mt-px flex-shrink-0 text-amber-600" />
              {isAdmin
                ? `${qtdNegocios(bloqueados.length)} não cumpre${bloqueados.length === 1 ? "" : "m"} as condições para sair da etapa atual. Como administrador, você pode mover mesmo assim.`
                : `${qtdNegocios(bloqueados.length)} não cumpre${bloqueados.length === 1 ? "" : "m"} as condições para sair da etapa atual e ficará${bloqueados.length === 1 ? "" : "ão"} onde está${bloqueados.length === 1 ? "" : "ão"}.`}
            </p>
          )}
          {acao === "mover" && destino && destino.tipo !== "aberta" && qtd > 0 && (
            <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600 sm:px-5">
              “{destino.nome}” é uma coluna de {destino.tipo === "ganho" ? "ganho: os negócios também serão marcados como ganhos." : "perda: vamos pedir o motivo antes de mover."}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3 sm:px-5">
            <p className="mr-auto text-sm text-slate-600">
              <b className="text-marinho-800">{selecionados.length}</b> selecionado{selecionados.length === 1 ? "" : "s"}
              {selecionados.length > 0 && (
                <button onClick={() => setSel(new Set())} className="ml-2 text-aco-600 hover:underline">
                  Limpar
                </button>
              )}
            </p>
            <Button variant="secondary" onClick={onClose} className="hidden sm:inline-flex">
              Cancelar
            </Button>
            <Button
              variant={cfg.variante}
              disabled={qtd === 0 || ocupado || (acao === "mover" && !destino)}
              onClick={confirmar}
              className="flex-1 sm:flex-none"
            >
              <cfg.Icone size={16} /> {ocupado ? "Aguarde..." : rotuloBotao}
            </Button>
          </div>
        </div>
      </div>

      {perder && (
        <PerderModal
          ids={perder.ids}
          onClose={() => setPerder(null)}
          onPerdido={async () => {
            if (perder.depois) await perder.depois();
            onClose();
          }}
        />
      )}
      {excluir && (
        <ConfirmarModal
          titulo={`Excluir ${qtdNegocios(qtd)}`}
          texto={`${qtd === 1 ? "O negócio selecionado vai" : `Os ${qtd} negócios selecionados vão`} para a lixeira. Dá para restaurar depois em Configurações → Lixeira.`}
          rotulo="Excluir"
          perigo
          onClose={() => setExcluir(false)}
          onConfirmar={async () => {
            if (await excluirNegocios(aMover.map((c) => c.id))) onClose();
          }}
        />
      )}
    </>
  );
}

function Linha({
  card,
  marcado,
  coluna,
  alerta,
  onToggle,
}: {
  card: Card;
  marcado: boolean;
  coluna?: { nome: string; cor: string };
  alerta: boolean;
  onToggle: () => void;
}) {
  const nome = tituloCard(card);
  const status = statusDe(card);
  return (
    <div
      onClick={onToggle}
      className={cx(
        // celular: cartão; computador: linha de tabela
        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition",
        "sm:grid sm:grid-cols-[auto_minmax(0,1fr)_11rem_8rem_6rem] sm:rounded-none sm:border-0 sm:px-5 sm:py-2.5",
        marcado ? "border-aco-200 bg-aco-50" : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <Caixa marcada={marcado} onChange={onToggle} rotulo={`Selecionar ${nome}`} />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar nome={nome} size={32} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-marinho-800">
            <span className="truncate">{nome}</span>
            {alerta && <AlertTriangle size={13} className="flex-shrink-0 text-amber-500" aria-label="Não cumpre as condições da etapa" />}
          </p>
          <p className="truncate text-xs text-slate-500">
            {card.obra?.nome_obra ?? "Sem obra"}
            {card.vendedor ? ` · ${card.vendedor.nome}` : ""}
          </p>
          {/* no celular, coluna/valor/status ficam numa linha embaixo */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:hidden">
            {coluna && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: coluna.cor }} /> {coluna.nome}
              </span>
            )}
            <span className="font-semibold text-marinho-800">{brl(card.valor_estimado || 0)}</span>
            <SeloStatus status={status} mostrarAberto />
          </div>
        </div>
      </div>
      <span className="hidden min-w-0 items-center gap-1.5 text-sm text-marinho-800 sm:flex">
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: coluna?.cor ?? "#94a3b8" }} />
        <span className="truncate">{coluna?.nome ?? "—"}</span>
      </span>
      <span className="hidden text-right text-sm font-medium text-marinho-800 sm:block">{brl(card.valor_estimado || 0)}</span>
      <span className="hidden sm:block">
        <SeloStatus status={status} mostrarAberto />
      </span>
    </div>
  );
}
