import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Search,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Plus,
  Check,
  X,
  PlusCircle,
  ArrowDownUp,
  CircleUserRound,
  Banknote,
  CalendarDays,
  CalendarClock,
  Tags,
  LayoutGrid,
  List as ListIcon,
  MoveRight,
} from "lucide-react";
import { tituloCard, useData, type Card as TCard } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { CLASSIFICACOES, CORES_ETAPA, FASE_LABEL, type Classificacao, type Etapa, type Pipeline } from "@/lib/types";
import { Avatar, Button, Field, Input, Modal, Select, SeloTipo, Spinner, Tag } from "@/components/ui";
import PainelLead from "@/components/PainelLead";
import { NovoNegocioModal } from "@/components/NovoNegocio";
import { NovaAtividadeModal, atrasada, quandoAtividade, ICONE_ATIVIDADE } from "@/components/Atividades";
import { CampoTags } from "@/components/NovoLead";
import { brl, cx, dataBR } from "@/lib/utils";

type Vista = "quadro" | "lista";
type Ordem = "recentes" | "antigos" | "valor" | "nome" | "atualizados";
type Intervalo = "7" | "30" | "90" | "365" | "tudo";

const ROTULO_ORDEM: Record<Ordem, string> = {
  recentes: "Mais recentes",
  antigos: "Mais antigos",
  atualizados: "Atualizados recentemente",
  valor: "Maior valor",
  nome: "Nome (A-Z)",
};
const ROTULO_INTERVALO: Record<Intervalo, string> = {
  "7": "Últimos 7 dias",
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  "365": "Último ano",
  tudo: "Todo o período",
};

export default function Kanban() {
  const { pipelineId } = useParams();
  const { pipelines, loading } = useData();
  if (loading) return <Spinner />;
  const pipe = pipelines.find((p) => p.id === pipelineId);
  if (!pipe) return pipelines[0] ? <Navigate to={`/pipelines/${pipelines[0].id}`} replace /> : <SemPipeline />;
  return <Quadro key={pipe.id} pipeline={pipe} />;
}

function SemPipeline() {
  const { criarPipeline } = useData();
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  return (
    <div className="mx-auto mt-20 max-w-sm text-center">
      <p className="text-lg font-semibold text-marinho-800">Nenhum pipeline ainda</p>
      {isAdmin && (
        <Button
          className="mt-4"
          onClick={async () => {
            const id = await criarPipeline("Vendas", "Funil básico de vendas");
            if (id) nav(`/pipelines/${id}`);
          }}
        >
          <Plus size={16} /> Criar pipeline
        </Button>
      )}
    </div>
  );
}

function Quadro({ pipeline }: { pipeline: Pipeline }) {
  const { cards, etapas, vendedores, moverEtapa, setClassificacao, atividades } = useData();
  const { isAdmin, pode } = useAuth();
  const podeMover = pode("mover_funil");

  const colunas = useMemo(() => etapas.filter((e) => e.pipeline_id === pipeline.id), [etapas, pipeline.id]);
  const idsColunas = useMemo(() => new Set(colunas.map((c) => c.id)), [colunas]);

  const [vista, setVista] = useState<Vista>(() => (localStorage.getItem("vista") as Vista) || "quadro");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [intervalo, setIntervalo] = useState<Intervalo>("365");
  const [fVendedor, setFVendedor] = useState("");
  const [fClass, setFClass] = useState("");
  const [fTag, setFTag] = useState("");
  const [painel, setPainel] = useState<string | null>(null);
  const [novoNegocio, setNovoNegocio] = useState<string | null>(null);
  const [atividadePara, setAtividadePara] = useState<TCard | null>(null);
  const [pendente, setPendente] = useState<{ card: TCard; etapa: Etapa } | null>(null);
  const [excluindo, setExcluindo] = useState<Etapa | null>(null);
  const [movendoTodos, setMovendoTodos] = useState<Etapa | null>(null);
  const [menu, setMenu] = useState<"filtros" | "ordem" | "intervalo" | "mais" | null>(null);
  const [editandoPipe, setEditandoPipe] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("vista", vista);
    } catch {
      /* navegação privada */
    }
  }, [vista]);

  // número sequencial do negócio (#1, #2...) pela ordem de criação
  const numero = useMemo(() => {
    const m = new Map<string, number>();
    [...cards].sort((a, b) => a.criado_em.localeCompare(b.criado_em)).forEach((c, i) => m.set(c.id, i + 1));
    return m;
  }, [cards]);

  const proxAtividade = useMemo(() => {
    const m = new Map<string, (typeof atividades)[number]>();
    for (const a of atividades) if (a.oportunidade_id && !m.has(a.oportunidade_id)) m.set(a.oportunidade_id, a);
    return m;
  }, [atividades]);

  const todasTags = useMemo(() => Array.from(new Set(cards.flatMap((c) => c.tags ?? []))).sort(), [cards]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    const desde = intervalo === "tudo" ? 0 : Date.now() - Number(intervalo) * 86400000;
    const lista = cards.filter((c) => {
      if (!idsColunas.has(c.etapa_id)) return false;
      if (desde && new Date(c.criado_em).getTime() < desde) return false;
      if (fVendedor === "_sem" ? c.vendedor_id : fVendedor && c.vendedor_id !== fVendedor) return false;
      if (fClass && c.classificacao !== fClass) return false;
      if (fTag && !(c.tags ?? []).includes(fTag)) return false;
      if (
        q &&
        !`${tituloCard(c)} ${c.obra?.nome_obra ?? ""} ${c.obra?.bairro ?? ""} ${c.lead?.telefone ?? ""} ${c.vendedor?.nome ?? ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
    const cmp: Record<Ordem, (a: TCard, b: TCard) => number> = {
      recentes: (a, b) => b.criado_em.localeCompare(a.criado_em),
      antigos: (a, b) => a.criado_em.localeCompare(b.criado_em),
      atualizados: (a, b) => b.atualizado_em.localeCompare(a.atualizado_em),
      valor: (a, b) => (b.valor_estimado || 0) - (a.valor_estimado || 0),
      nome: (a, b) => tituloCard(a).localeCompare(tituloCard(b)),
    };
    return lista.sort(cmp[ordem]);
  }, [cards, idsColunas, busca, intervalo, fVendedor, fClass, fTag, ordem]);

  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  function irParaEtapa(card: TCard, etapaId: string) {
    const destino = etapaPorId.get(etapaId);
    if (!podeMover || !destino || card.etapa_id === etapaId) return;
    if (destino.tipo !== "aberta") setPendente({ card, etapa: destino });
    else moverEtapa(card.id, etapaId);
  }

  function onDragEnd(e: DragEndEvent) {
    const card = cards.find((c) => c.id === e.active.id);
    if (card && e.over) irParaEtapa(card, String(e.over.id));
  }

  const filtrosAtivos = [fVendedor, fClass, fTag].filter(Boolean).length;

  return (
    <div className="flex h-full flex-col">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[1.75rem] font-semibold leading-tight text-marinho-800">{pipeline.nome}</h1>
          <p className="truncate text-slate-500">{pipeline.descricao || "Funil de vendas"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input placeholder="Pesquisar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="py-2 pl-9" />
          </div>
          <div className="relative">
            <BotaoTopo onClick={() => setMenu(menu === "filtros" ? null : "filtros")}>
              <PlusCircle size={16} /> Filtros{filtrosAtivos ? ` (${filtrosAtivos})` : ""}
            </BotaoTopo>
            {menu === "filtros" && (
              <Pop onClose={() => setMenu(null)} largura="w-72">
                <div className="space-y-3 p-3">
                  <Field label="Atendente">
                    <Select value={fVendedor} onChange={(e) => setFVendedor(e.target.value)} disabled={!isAdmin && !pode("ver_todas_obras")}>
                      <option value="">Todos</option>
                      <option value="_sem">Sem atendente</option>
                      {vendedores.map((v) => (
                        <option key={v.id} value={v.id}>{v.nome}</option>
                      ))}
                    </Select>
                  </Field>
                  {todasTags.length > 0 && (
                    <Field label="Tag">
                      <Select value={fTag} onChange={(e) => setFTag(e.target.value)}>
                        <option value="">Todas</option>
                        {todasTags.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setFVendedor("");
                      setFClass("");
                      setFTag("");
                    }}
                  >
                    Limpar filtros
                  </Button>
                </div>
              </Pop>
            )}
          </div>
          <div className="relative">
            <BotaoTopo onClick={() => setMenu(menu === "ordem" ? null : "ordem")}>
              <ArrowDownUp size={16} /> Ordenação
            </BotaoTopo>
            {menu === "ordem" && (
              <Pop onClose={() => setMenu(null)}>
                {(Object.keys(ROTULO_ORDEM) as Ordem[]).map((k) => (
                  <ItemMenu key={k} ativo={ordem === k} onClick={() => { setOrdem(k); setMenu(null); }}>
                    {ROTULO_ORDEM[k]}
                  </ItemMenu>
                ))}
              </Pop>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setMenu(menu === "mais" ? null : "mais")}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label="Mais opções"
            >
              <MoreVertical size={17} />
            </button>
            {menu === "mais" && (
              <Pop onClose={() => setMenu(null)}>
                <ItemMenu icon={<LayoutGrid size={15} />} ativo={vista === "quadro"} onClick={() => { setVista("quadro"); setMenu(null); }}>
                  Ver em quadro
                </ItemMenu>
                <ItemMenu icon={<ListIcon size={15} />} ativo={vista === "lista"} onClick={() => { setVista("lista"); setMenu(null); }}>
                  Ver em lista
                </ItemMenu>
                {isAdmin && (
                  <ItemMenu icon={<Pencil size={15} />} onClick={() => { setEditandoPipe(true); setMenu(null); }}>
                    Editar pipeline
                  </ItemMenu>
                )}
              </Pop>
            )}
          </div>
        </div>
      </header>

      {/* Chips de ordenação e intervalo */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip rotulo="Ordenação" valor={ROTULO_ORDEM[ordem]} onClick={() => setMenu(menu === "ordem" ? null : "ordem")} />
        <div className="relative">
          <Chip rotulo="Intervalo" valor={ROTULO_INTERVALO[intervalo]} onClick={() => setMenu(menu === "intervalo" ? null : "intervalo")} />
          {menu === "intervalo" && (
            <Pop onClose={() => setMenu(null)} esquerda>
              {(Object.keys(ROTULO_INTERVALO) as Intervalo[]).map((k) => (
                <ItemMenu key={k} ativo={intervalo === k} onClick={() => { setIntervalo(k); setMenu(null); }}>
                  {ROTULO_INTERVALO[k]}
                </ItemMenu>
              ))}
            </Pop>
          )}
        </div>
        {fVendedor && (
          <Chip
            rotulo="Atendente"
            valor={fVendedor === "_sem" ? "Sem atendente" : vendedores.find((v) => v.id === fVendedor)?.nome ?? ""}
            onRemover={() => setFVendedor("")}
          />
        )}
        {fTag && <Chip rotulo="Tag" valor={fTag} onRemover={() => setFTag("")} />}
      </div>

      {vista === "quadro" ? (
        <DndContext sensors={podeMover ? sensors : []} onDragEnd={onDragEnd}>
          <div className="-mx-4 mt-4 flex flex-1 gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
            {colunas.map((et, i) => (
              <Coluna
                key={et.id}
                etapa={et}
                primeira={i === 0}
                ultima={i === colunas.length - 1}
                podeEditar={isAdmin}
                cards={filtrados.filter((c) => c.etapa_id === et.id)}
                numero={numero}
                proxAtividade={proxAtividade}
                onOpen={setPainel}
                onExcluir={() => setExcluindo(et)}
                onMoverTodos={() => setMovendoTodos(et)}
                onNovoNegocio={() => setNovoNegocio(et.id)}
                onAtividade={setAtividadePara}
              />
            ))}
            {isAdmin && <NovaColuna pipelineId={pipeline.id} />}
          </div>
        </DndContext>
      ) : (
        <ListaView
          cards={filtrados}
          etapas={colunas}
          onOpen={setPainel}
          onEtapa={irParaEtapa}
          onClass={(id, cl) => podeMover && setClassificacao(id, cl)}
        />
      )}

      {painel && (
        <PainelLead cardId={painel} onClose={() => setPainel(null)} onMudarEtapa={(c, e) => irParaEtapa(c, e)} />
      )}
      {novoNegocio && (
        <NovoNegocioModal
          pipelineId={pipeline.id}
          etapaId={novoNegocio}
          onClose={() => setNovoNegocio(null)}
          onCriado={(id) => setPainel(id)}
        />
      )}
      {atividadePara && (
        <NovaAtividadeModal
          oportunidadeId={atividadePara.id}
          leadId={atividadePara.lead_id}
          onClose={() => setAtividadePara(null)}
        />
      )}
      {pendente && (
        <ConfirmarEtapa
          info={pendente}
          onClose={() => setPendente(null)}
          onConfirm={(extra) => {
            moverEtapa(pendente.card.id, pendente.etapa.id, extra);
            setPendente(null);
          }}
        />
      )}
      {excluindo && <ExcluirColuna etapa={excluindo} colunas={colunas} onClose={() => setExcluindo(null)} />}
      {movendoTodos && <MoverTodos etapa={movendoTodos} onClose={() => setMovendoTodos(null)} />}
      {editandoPipe && <EditarPipeline pipeline={pipeline} onClose={() => setEditandoPipe(false)} />}
    </div>
  );
}

/* ---------------- Peças do topo ---------------- */

function BotaoTopo({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 items-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-3.5 text-sm font-medium text-marinho-800 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function Chip({ rotulo, valor, onClick, onRemover }: { rotulo: string; valor: string; onClick?: () => void; onRemover?: () => void }) {
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

function Pop({ children, onClose, largura = "w-56", esquerda }: { children: React.ReactNode; onClose: () => void; largura?: string; esquerda?: boolean }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className={cx("absolute top-11 z-40 rounded-lg border border-slate-200 bg-white p-1 shadow-cardhover", largura, esquerda ? "left-0" : "right-0")}>
        {children}
      </div>
    </>
  );
}

function ItemMenu({
  icon,
  children,
  onClick,
  perigo,
  ativo,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
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

/* ---------------- QUADRO ---------------- */

function Coluna({
  etapa,
  primeira,
  ultima,
  podeEditar,
  cards,
  numero,
  proxAtividade,
  onOpen,
  onExcluir,
  onMoverTodos,
  onNovoNegocio,
  onAtividade,
}: {
  etapa: Etapa;
  primeira: boolean;
  ultima: boolean;
  podeEditar: boolean;
  cards: TCard[];
  numero: Map<string, number>;
  proxAtividade: Map<string, import("@/lib/types").Atividade>;
  onOpen: (id: string) => void;
  onExcluir: () => void;
  onMoverTodos: () => void;
  onNovoNegocio: () => void;
  onAtividade: (c: TCard) => void;
}) {
  const { atualizarEtapa, moverColuna } = useData();
  const { pode } = useAuth();
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  const [menu, setMenu] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [nome, setNome] = useState(etapa.nome);
  const soma = cards.reduce((s, c) => s + (c.valor_estimado || 0), 0);

  function salvarNome() {
    const n = nome.trim();
    if (n && n !== etapa.nome) atualizarEtapa(etapa.id, { nome: n });
    else setNome(etapa.nome);
    setRenomeando(false);
  }

  return (
    <div
      className={cx(
        "flex w-[min(21.25rem,85vw)] flex-shrink-0 flex-col rounded-lg border border-slate-200 bg-white transition",
        isOver && "ring-2 ring-aco-500"
      )}
      style={{ borderTop: `4px solid ${etapa.cor}` }}
    >
      <div className="relative px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          {renomeando ? (
            <div className="flex flex-1 items-center gap-1">
              <Input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarNome();
                  if (e.key === "Escape") {
                    setNome(etapa.nome);
                    setRenomeando(false);
                  }
                }}
                className="py-1.5"
              />
              <button onClick={salvarNome} className="rounded-md p-1.5 text-green-600 hover:bg-green-50" aria-label="Salvar">
                <Check size={16} />
              </button>
            </div>
          ) : (
            <button
              className="flex min-w-0 items-center gap-2"
              onDoubleClick={() => {
                if (podeEditar) {
                  setNome(etapa.nome);
                  setRenomeando(true);
                }
              }}
              title={podeEditar ? "Clique duas vezes para renomear" : undefined}
            >
              <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: etapa.cor }} />
              <span className="truncate font-semibold text-marinho-800">{etapa.nome}</span>
            </button>
          )}
          {podeEditar && !renomeando && (
            <button
              onClick={() => setMenu((m) => !m)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Opções da coluna"
            >
              <MoreHorizontal size={20} />
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between pl-5 text-sm text-slate-500">
          <span>{brl(soma)}</span>
          <span>{cards.length === 0 ? "Nenhum negócio" : `${cards.length} negócio${cards.length > 1 ? "s" : ""}`}</span>
        </div>

        {menu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
            <div className="absolute right-3 top-11 z-40 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-cardhover">
              <ItemMenu icon={<Pencil size={15} />} onClick={() => { setMenu(false); setNome(etapa.nome); setRenomeando(true); }}>
                Renomear
              </ItemMenu>
              <div className="flex flex-wrap gap-1.5 px-2.5 py-2">
                {CORES_ETAPA.map((cor) => (
                  <button
                    key={cor}
                    onClick={() => atualizarEtapa(etapa.id, { cor })}
                    className={cx("h-6 w-6 rounded-full border-2", etapa.cor === cor ? "border-marinho-800" : "border-white")}
                    style={{ background: cor }}
                    aria-label={`Cor ${cor}`}
                  />
                ))}
              </div>
              {!primeira && (
                <ItemMenu icon={<ArrowLeft size={15} />} onClick={() => { setMenu(false); moverColuna(etapa.id, -1); }}>
                  Mover para a esquerda
                </ItemMenu>
              )}
              {!ultima && (
                <ItemMenu icon={<ArrowRight size={15} />} onClick={() => { setMenu(false); moverColuna(etapa.id, 1); }}>
                  Mover para a direita
                </ItemMenu>
              )}
              {cards.length > 0 && (
                <ItemMenu icon={<MoveRight size={15} />} onClick={() => { setMenu(false); onMoverTodos(); }}>
                  Mover todos os negócios
                </ItemMenu>
              )}
              <ItemMenu icon={<Trash2 size={15} />} perigo onClick={() => { setMenu(false); onExcluir(); }}>
                Excluir coluna
              </ItemMenu>
            </div>
          </>
        )}
      </div>

      <div ref={setNodeRef} className="flex min-h-[160px] flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3" style={{ maxHeight: "calc(100vh - 330px)" }}>
        {cards.map((c) => (
          <KanbanCard key={c.id} card={c} numero={numero.get(c.id) ?? 0} atividade={proxAtividade.get(c.id)} onOpen={onOpen} onAtividade={onAtividade} />
        ))}
      </div>

      {pode("cadastrar_obras") && (
        <button
          onClick={onNovoNegocio}
          className="flex items-center justify-center gap-1.5 border-t border-slate-200 py-3 text-[0.9375rem] text-marinho-800 hover:bg-slate-50"
        >
          <Plus size={17} /> Novo negócio
        </button>
      )}
    </div>
  );
}

function KanbanCard({
  card,
  numero,
  atividade,
  onOpen,
  onAtividade,
}: {
  card: TCard;
  numero: number;
  atividade?: import("@/lib/types").Atividade;
  onOpen: (id: string) => void;
  onAtividade: (c: TCard) => void;
}) {
  const { atualizarOportunidade } = useData();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined;
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();
  const [tags, setTags] = useState(false);
  const nome = tituloCard(card);
  const Icone = atividade ? ICONE_ATIVIDADE[atividade.tipo] : CalendarClock;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(card.id)}
      className={cx(
        "cursor-grab touch-none select-none rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-card active:cursor-grabbing",
        isDragging && "opacity-70 shadow-cardhover"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar nome={nome} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[1.0625rem] font-semibold text-marinho-800">{nome}</p>
            {card.lead && <SeloTipo tipo={card.lead.tipo} />}
          </div>
          <p className={cx("truncate text-sm underline-offset-2", card.obra ? "text-aco-600 underline" : "text-aco-600 underline")}>
            {card.obra?.nome_obra ?? "Sem obra"}
          </p>
        </div>
        <span className="text-xs text-slate-400">#{numero}</span>
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
          {card.obra?.fase_obra && <span className="ml-auto rounded bg-slate-100 px-1.5 text-[0.6875rem] text-slate-600">{FASE_LABEL[card.obra.fase_obra]}</span>}
        </p>
        <div className="flex items-center gap-2.5 text-slate-500">
          <Icone size={16} className="flex-shrink-0" />
          {atividade ? (
            <span className={cx("min-w-0 flex-1 truncate", atrasada(atividade) ? "font-medium text-red-600" : "text-marinho-800")}>
              {atividade.titulo} · {quandoAtividade(atividade.data_hora)}
            </span>
          ) : (
            <span className="flex-1">Sem atividades</span>
          )}
          <button
            onPointerDown={stop}
            onClick={(e) => {
              stop(e);
              onAtividade(card);
            }}
            className="rounded-full text-slate-500 hover:text-aco-600"
            aria-label="Nova atividade"
          >
            <PlusCircle size={19} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5" onPointerDown={stop} onClick={stop}>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {(card.tags ?? []).map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
        <button onClick={() => setTags((v) => !v)} className="text-slate-500 hover:text-aco-600" aria-label="Tags">
          <Tags size={18} />
        </button>
      </div>
      {tags && (
        <div className="mt-2" onPointerDown={stop} onClick={stop} onKeyDown={(e) => e.stopPropagation()}>
          <CampoTags tags={card.tags ?? []} onChange={(t) => atualizarOportunidade(card.id, { tags: t })} />
        </div>
      )}
    </div>
  );
}

function NovaColuna({ pipelineId }: { pipelineId: string }) {
  const { criarEtapa } = useData();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");

  async function criar() {
    if (!nome.trim()) return;
    await criarEtapa(nome.trim(), pipelineId);
    setNome("");
    setAberto(false);
  }

  return (
    <div className="w-[min(21.25rem,85vw)] flex-shrink-0">
      {aberto ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <Input
            autoFocus
            placeholder="Nome da coluna"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") criar();
              if (e.key === "Escape") setAberto(false);
            }}
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="flex-1" onClick={criar}>Criar coluna</Button>
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)} aria-label="Cancelar">
              <X size={16} />
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAberto(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 py-3.5 text-[0.9375rem] text-slate-500 hover:bg-slate-200 hover:text-marinho-800"
        >
          <Plus size={17} /> Nova coluna
        </button>
      )}
    </div>
  );
}

function ExcluirColuna({ etapa, colunas, onClose }: { etapa: Etapa; colunas: Etapa[]; onClose: () => void }) {
  const { cards, excluirEtapa } = useData();
  const qtd = cards.filter((c) => c.etapa_id === etapa.id).length;
  const outras = colunas.filter((e) => e.id !== etapa.id);
  const [destino, setDestino] = useState(outras[0]?.id ?? "");
  const [excluindo, setExcluindo] = useState(false);

  return (
    <Modal open onClose={onClose} title={`Excluir a coluna "${etapa.nome}"`}>
      {outras.length === 0 ? (
        <p className="text-sm text-slate-600">O pipeline precisa ter pelo menos uma coluna.</p>
      ) : (
        <div className="space-y-4">
          {qtd > 0 ? (
            <Field label={`Esta coluna tem ${qtd} negócio(s). Mover para:`}>
              <Select value={destino} onChange={(e) => setDestino(e.target.value)}>
                {outras.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="text-sm text-slate-600">A coluna está vazia e será removida.</p>
          )}
          {etapa.tipo !== "aberta" && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Esta coluna conta como <b>{etapa.tipo === "ganho" ? "ganho" : "perdido"}</b> na conversão do painel.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button
              variant="danger"
              disabled={excluindo}
              onClick={async () => {
                setExcluindo(true);
                await excluirEtapa(etapa.id, qtd > 0 ? destino : null);
                onClose();
              }}
            >
              <Trash2 size={16} /> Excluir coluna
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Move todos os negócios de uma coluna para outra (inclusive de outro pipeline). */
function MoverTodos({ etapa, onClose }: { etapa: Etapa; onClose: () => void }) {
  const { cards, etapas, pipelines, moverTodosDaColuna } = useData();
  const qtd = cards.filter((c) => c.etapa_id === etapa.id).length;
  const destinos = pipelines.flatMap((p) =>
    etapas.filter((e) => e.pipeline_id === p.id && e.id !== etapa.id).map((e) => ({ ...e, pipelineNome: p.nome }))
  );
  const [destino, setDestino] = useState(destinos.find((d) => d.pipeline_id === etapa.pipeline_id)?.id ?? destinos[0]?.id ?? "");
  const [movendo, setMovendo] = useState(false);
  const multi = pipelines.length > 1;

  return (
    <Modal open onClose={onClose} title={`Mover negócios de "${etapa.nome}"`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {qtd} negócio{qtd === 1 ? "" : "s"} desta coluna ser{qtd === 1 ? "á movido" : "ão movidos"} de uma vez. Os filtros da tela não se aplicam: entram todos.
        </p>
        <Field label="Mover para">
          <Select value={destino} onChange={(e) => setDestino(e.target.value)}>
            {multi
              ? pipelines.map((p) => (
                  <optgroup key={p.id} label={p.nome}>
                    {destinos
                      .filter((d) => d.pipeline_id === p.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                  </optgroup>
                ))
              : destinos.map((d) => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!destino || movendo}
            onClick={async () => {
              setMovendo(true);
              const ok = await moverTodosDaColuna(etapa.id, destino);
              setMovendo(false);
              if (ok) onClose();
            }}
          >
            <MoveRight size={16} /> {movendo ? "Movendo..." : "Mover todos"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditarPipeline({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const { atualizarPipeline, excluirPipeline, pipelines } = useData();
  const nav = useNavigate();
  const [nome, setNome] = useState(pipeline.nome);
  const [descricao, setDescricao] = useState(pipeline.descricao);
  const [grupo, setGrupo] = useState(pipeline.grupo);
  return (
    <Modal open onClose={onClose} title="Editar pipeline">
      <div className="space-y-4">
        <Field label="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Descrição">
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Funil básico de vendas" />
        </Field>
        <Field label="Grupo">
          <Input value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Padrão" />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          {pipelines.length > 1 && (
            <Button
              variant="ghost"
              className="mr-auto text-red-600 hover:bg-red-50"
              onClick={async () => {
                if (!window.confirm(`Excluir o pipeline "${pipeline.nome}" e suas colunas?`)) return;
                if (await excluirPipeline(pipeline.id)) {
                  onClose();
                  nav("/");
                }
              }}
            >
              <Trash2 size={15} /> Excluir
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={async () => {
              if (!nome.trim()) return;
              await atualizarPipeline(pipeline.id, { nome: nome.trim(), descricao: descricao.trim(), grupo: grupo.trim() || "Padrão" });
              onClose();
            }}
          >
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- LISTA ---------------- */

function ListaView({
  cards,
  etapas,
  onOpen,
  onEtapa,
  onClass,
}: {
  cards: TCard[];
  etapas: Etapa[];
  onOpen: (id: string) => void;
  onEtapa: (c: TCard, etapaId: string) => void;
  onClass: (id: string, cl: Classificacao) => void;
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
          return (
            <div key={c.id} className="grid grid-cols-2 items-center gap-2 px-4 py-3 lg:grid-cols-12">
              <button onClick={() => onOpen(c.id)} className="col-span-2 flex items-center gap-3 text-left lg:col-span-4">
                <Avatar nome={tituloCard(c)} size={32} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-marinho-800 hover:text-aco-600">{tituloCard(c)}</p>
                  <p className="truncate text-xs text-slate-500">{c.obra?.nome_obra ?? "Sem obra"}</p>
                </div>
              </button>
              <p className="truncate text-sm text-marinho-800 lg:col-span-2">{c.vendedor?.nome ?? "Sem atendente"}</p>
              <div className="lg:col-span-4">
                <Select value={c.etapa_id} onChange={(e) => onEtapa(c, e.target.value)} className="py-1.5 text-sm">
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

/* ---------------- Confirmar ganho / perda ---------------- */

function ConfirmarEtapa({
  info,
  onClose,
  onConfirm,
}: {
  info: { card: TCard; etapa: Etapa };
  onClose: () => void;
  onConfirm: (extra: Record<string, unknown>) => void;
}) {
  const ganho = info.etapa.tipo === "ganho";
  const [valor, setValor] = useState(String(info.card.valor_estimado || 0));
  const [motivo, setMotivo] = useState("");
  const [concorrente, setConcorrente] = useState("");

  return (
    <Modal open onClose={onClose} title={`Mover para "${info.etapa.nome}"`}>
      {ganho ? (
        <Field label="Valor fechado (R$)">
          <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Field>
      ) : (
        <div className="space-y-4">
          <Field label="Motivo da perda">
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: preço, prazo..." />
          </Field>
          <Field label="Concorrente (opcional)">
            <Input value={concorrente} onChange={(e) => setConcorrente(e.target.value)} />
          </Field>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button
          variant={ganho ? "success" : "danger"}
          onClick={() =>
            onConfirm(
              ganho ? { valor_estimado: Number(valor) || 0 } : { motivo_perda: motivo || "Não informado", concorrente: concorrente || null }
            )
          }
        >
          Confirmar
        </Button>
      </div>
    </Modal>
  );
}
