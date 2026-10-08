import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowDownUp, CircleDot, MoreVertical, Plus, PlusCircle, Search } from "lucide-react";
import { tituloCard, useData, type Card as TCard } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { faltandoParaSair } from "@/lib/requisitos";
import type { Etapa, Pipeline, StatusNegocio } from "@/lib/types";
import { Button, Field, Input, Select, Spinner } from "@/components/ui";
import PainelLead from "@/components/PainelLead";
import { NovoNegocioModal } from "@/components/NovoNegocio";
import { ConfirmarModal, PerderModal } from "@/components/StatusNegocio";
import { BotaoTopo, Chip, ItemMenu, Pop, qtdNegocios, statusDe } from "@/components/pipeline/pecas";
import { CartaoNegocio } from "@/components/pipeline/CartaoNegocio";
import { Coluna, ExcluirColuna, MoverTodos, NovaColuna } from "@/components/pipeline/Coluna";
import { ListaNegocios } from "@/components/pipeline/ListaNegocios";
import { ZONA_EXCLUIR, ZONA_GANHAR, ZONA_PERDER, ZonasStatus, ehZona } from "@/components/pipeline/ZonasStatus";
import { MenuPipeline, type AcaoMassa, type ModalPipeline, type Vista } from "@/components/pipeline/MenuPipeline";
import { AcoesEmMassa } from "@/components/pipeline/AcoesEmMassa";
import { DuplicarPipeline, EditarPipeline } from "@/components/pipeline/EditarPipeline";
import { PermissoesPipeline } from "@/components/pipeline/PermissoesPipeline";
import { ConfigEtapas } from "@/components/pipeline/ConfigEtapas";
import { FaltandoModal } from "@/components/pipeline/FaltandoModal";

type Ordem = "recentes" | "antigos" | "valor" | "nome" | "atualizados";
type Intervalo = "7" | "30" | "90" | "365" | "tudo";
type FiltroStatus = StatusNegocio | "todos";

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
const ROTULO_STATUS: Record<FiltroStatus, string> = {
  aberto: "Em aberto",
  ganho: "Ganhos",
  perdido: "Perdidos",
  todos: "Todos",
};

/** Ponteiro em cima da barra Ganhar/Perder/Excluir tem prioridade; senão, a coluna sob o ponteiro */
const colisao: CollisionDetection = (args) => {
  const sob = pointerWithin(args);
  const zona = sob.find((c) => ehZona(c.id));
  if (zona) return [zona];
  if (sob.length) return sob;
  // soltar fora de qualquer coluna ou bloco cancela o arraste
  if (args.pointerCoordinates) return [];
  return rectIntersection(args).filter((c) => !ehZona(c.id));
};

// a barra do topo aparece só durante o arraste: mede as áreas de soltar o tempo todo
const MEDICAO = { droppable: { strategy: MeasuringStrategy.Always } };

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
  const { cards, etapas, vendedores, moverEtapa, ganharNegocios, excluirNegocios, avisar } = useData();
  const { isAdmin, pode } = useAuth();
  const podeMover = pode("mover_funil");
  const podeExcluir = pode("excluir_obras") && podeMover;

  const colunas = useMemo(() => etapas.filter((e) => e.pipeline_id === pipeline.id), [etapas, pipeline.id]);
  const idsColunas = useMemo(() => new Set(colunas.map((c) => c.id)), [colunas]);
  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);

  const [vista, setVista] = useState<Vista>(() => {
    try {
      return (localStorage.getItem("vista") as Vista) || "quadro";
    } catch {
      return "quadro";
    }
  });
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [intervalo, setIntervalo] = useState<Intervalo>("tudo");
  const [fStatus, setFStatus] = useState<FiltroStatus>("aberto");
  const [fVendedor, setFVendedor] = useState("");
  const [fTag, setFTag] = useState("");
  const [menu, setMenu] = useState<"filtros" | "ordem" | "intervalo" | "status" | "mais" | null>(null);

  const [painel, setPainel] = useState<string | null>(null);
  const [novoNegocio, setNovoNegocio] = useState<string | null>(null);
  const [excluindoColuna, setExcluindoColuna] = useState<Etapa | null>(null);
  const [movendoTodos, setMovendoTodos] = useState<Etapa | null>(null);
  const [modal, setModal] = useState<ModalPipeline | null>(null);
  const [massa, setMassa] = useState<AcaoMassa | null>(null);

  // arraste e confirmações que ele pode abrir
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [perder, setPerder] = useState<{ card: TCard; etapaId?: string } | null>(null);
  const [excluir, setExcluir] = useState<TCard | null>(null);
  const [faltando, setFaltando] = useState<{ card: TCard; etapa: Etapa; falta: string[] } | null>(null);

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

  const todasTags = useMemo(() => Array.from(new Set(cards.flatMap((c) => c.tags ?? []))).sort(), [cards]);

  // todos os filtros menos o de status (serve para contar ganhos/perdidos ocultos)
  const semStatus = useMemo(() => {
    const q = busca.toLowerCase();
    const desde = intervalo === "tudo" ? 0 : Date.now() - Number(intervalo) * 86400000;
    const lista = cards.filter((c) => {
      if (!idsColunas.has(c.etapa_id)) return false;
      if (desde && new Date(c.criado_em).getTime() < desde) return false;
      if (fVendedor === "_sem" ? c.vendedor_id : fVendedor && c.vendedor_id !== fVendedor) return false;
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
  }, [cards, idsColunas, busca, intervalo, fVendedor, fTag, ordem]);

  const filtrados = useMemo(
    () => (fStatus === "todos" ? semStatus : semStatus.filter((c) => statusDe(c) === fStatus)),
    [semStatus, fStatus]
  );
  const contagem = useMemo(() => {
    const n: Record<FiltroStatus, number> = { aberto: 0, ganho: 0, perdido: 0, todos: semStatus.length };
    for (const c of semStatus) n[statusDe(c)]++;
    return n;
  }, [semStatus]);

  const sensors = useSensors(
    // MouseSensor (e não PointerSensor): no celular o toque fica com o TouchSensor (segurar e arrastar)
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } })
  );

  /** Troca de etapa (quadro, lista e painel): confere as condições da etapa atual e o tipo da coluna de destino */
  function irParaEtapa(card: TCard, etapaId: string) {
    const destino = etapaPorId.get(etapaId);
    if (!podeMover || !destino || card.etapa_id === etapaId) return;
    const atual = etapaPorId.get(card.etapa_id);
    const falta = faltandoParaSair(card, atual);
    if (falta.length && atual) return setFaltando({ card, etapa: atual, falta });
    if (destino.tipo === "ganho" && statusDe(card) !== "ganho") {
      moverEtapa(card.id, etapaId, { status: "ganho", status_em: new Date().toISOString(), motivo_perda_id: null });
      avisar("Negócio ganho! 🎉", "ok");
      return;
    }
    if (destino.tipo === "perdido" && statusDe(card) !== "perdido") return setPerder({ card, etapaId });
    moverEtapa(card.id, etapaId);
  }

  function onDragStart(e: DragStartEvent) {
    setArrastando(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setArrastando(null);
    const card = cards.find((c) => c.id === e.active.id);
    if (!card || !e.over) return;
    const alvo = String(e.over.id);
    if (alvo === ZONA_GANHAR) {
      if (statusDe(card) === "ganho") return avisar("Este negócio já está ganho.", "ok");
      ganharNegocios([card.id]);
    } else if (alvo === ZONA_PERDER) {
      if (statusDe(card) === "perdido") return avisar("Este negócio já está perdido.", "ok");
      setPerder({ card });
    } else if (alvo === ZONA_EXCLUIR) {
      if (podeExcluir) setExcluir(card);
    } else irParaEtapa(card, alvo);
  }

  const cardArrastado = arrastando ? cards.find((c) => c.id === arrastando) : undefined;
  const filtrosAtivos = [fVendedor, fTag].filter(Boolean).length;

  /** Coluna vazia porque o filtro de status escondeu os negócios dela */
  function dicaColuna(et: Etapa) {
    if (fStatus === "todos") return undefined;
    const ocultos = semStatus.filter((c) => c.etapa_id === et.id && statusDe(c) !== fStatus).length;
    if (!ocultos) return undefined;
    return (
      <>
        {qtdNegocios(ocultos)} fora do filtro “{ROTULO_STATUS[fStatus]}”.
        <button onClick={() => setFStatus("todos")} className="mt-1 block w-full font-medium text-aco-600 hover:underline">
          Ver todos
        </button>
      </>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[1.75rem] font-semibold leading-tight text-marinho-800">{pipeline.nome}</h1>
          <p className="truncate text-slate-500">{pipeline.descricao || "Funil de vendas"}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input placeholder="Pesquisar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="py-2 pl-9" />
          </div>
          <div className="relative">
            <BotaoTopo onClick={() => setMenu(menu === "filtros" ? null : "filtros")}>
              <PlusCircle size={16} /> Filtros{filtrosAtivos ? ` (${filtrosAtivos})` : ""}
            </BotaoTopo>
            {menu === "filtros" && (
              <Pop onClose={() => setMenu(null)} largura="w-72" esquerda>
                <div className="space-y-3 p-3">
                  <Field label="Status">
                    <Select value={fStatus} onChange={(e) => setFStatus(e.target.value as FiltroStatus)}>
                      {(Object.keys(ROTULO_STATUS) as FiltroStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {ROTULO_STATUS[s]} ({contagem[s]})
                        </option>
                      ))}
                    </Select>
                  </Field>
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
                      setFTag("");
                      setFStatus("aberto");
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
          <div className="relative ml-auto sm:ml-0">
            <button
              onClick={() => setMenu(menu === "mais" ? null : "mais")}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label="Opções do pipeline"
            >
              <MoreVertical size={17} />
            </button>
            {menu === "mais" && (
              <MenuPipeline vista={vista} onVista={setVista} onModal={setModal} onMassa={setMassa} onClose={() => setMenu(null)} />
            )}
          </div>
        </div>
      </header>

      {/* Chips: status, ordenação, intervalo e filtros ativos */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Chip rotulo="Status" valor={`${ROTULO_STATUS[fStatus]} (${contagem[fStatus]})`} onClick={() => setMenu(menu === "status" ? null : "status")} />
          {menu === "status" && (
            <Pop onClose={() => setMenu(null)} esquerda>
              {(Object.keys(ROTULO_STATUS) as FiltroStatus[]).map((s) => (
                <ItemMenu
                  key={s}
                  ativo={fStatus === s}
                  icon={<CircleDot size={14} className={s === "ganho" ? "text-green-600" : s === "perdido" ? "text-red-500" : s === "aberto" ? "text-aco-500" : "text-slate-400"} />}
                  onClick={() => { setFStatus(s); setMenu(null); }}
                >
                  {ROTULO_STATUS[s]} <span className="text-slate-400">({contagem[s]})</span>
                </ItemMenu>
              ))}
            </Pop>
          )}
        </div>
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
        <DndContext
          sensors={podeMover ? sensors : []}
          collisionDetection={colisao}
          measuring={MEDICAO}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setArrastando(null)}
        >
          {arrastando && <ZonasStatus podeExcluir={podeExcluir} />}
          <div className="-mx-4 mt-4 flex flex-1 gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
            {colunas.map((et, i) => (
              <Coluna
                key={et.id}
                etapa={et}
                primeira={i === 0}
                ultima={i === colunas.length - 1}
                podeEditar={isAdmin}
                arrastavel={podeMover}
                cards={filtrados.filter((c) => c.etapa_id === et.id)}
                numero={numero}
                dica={dicaColuna(et)}
                onOpen={setPainel}
                onExcluir={() => setExcluindoColuna(et)}
                onMoverTodos={() => setMovendoTodos(et)}
                onNovoNegocio={() => setNovoNegocio(et.id)}
              />
            ))}
            {isAdmin && <NovaColuna pipelineId={pipeline.id} />}
          </div>
          <DragOverlay dropAnimation={null}>
            {cardArrastado && (
              // menor enquanto arrasta, para não cobrir a barra Ganhar / Perder / Excluir
              <div className="w-[min(19.75rem,78vw)] origin-center scale-[0.6] opacity-95 sm:scale-75">
                <CartaoNegocio card={cardArrastado} numero={numero.get(cardArrastado.id) ?? 0} sobreposto />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <ListaNegocios cards={filtrados} etapas={colunas} podeMover={podeMover} onOpen={setPainel} onEtapa={irParaEtapa} />
      )}

      {painel && <PainelLead cardId={painel} onClose={() => setPainel(null)} onMudarEtapa={irParaEtapa} />}
      {novoNegocio && (
        <NovoNegocioModal
          pipelineId={pipeline.id}
          etapaId={novoNegocio}
          onClose={() => setNovoNegocio(null)}
          onCriado={(id) => setPainel(id)}
        />
      )}
      {perder && (
        <PerderModal
          ids={[perder.card.id]}
          onClose={() => setPerder(null)}
          onPerdido={() => {
            if (perder.etapaId) moverEtapa(perder.card.id, perder.etapaId);
          }}
        />
      )}
      {excluir && (
        <ConfirmarModal
          titulo="Excluir negócio"
          texto={`"${tituloCard(excluir)}" vai para a lixeira. Dá para restaurar depois em Configurações → Lixeira.`}
          rotulo="Excluir"
          perigo
          onClose={() => setExcluir(null)}
          onConfirmar={async () => {
            await excluirNegocios([excluir.id]);
          }}
        />
      )}
      {faltando && (
        <FaltandoModal
          card={faltando.card}
          etapa={faltando.etapa}
          falta={faltando.falta}
          onClose={() => setFaltando(null)}
          onAbrir={() => {
            setPainel(faltando.card.id);
            setFaltando(null);
          }}
        />
      )}

      {excluindoColuna && <ExcluirColuna etapa={excluindoColuna} colunas={colunas} onClose={() => setExcluindoColuna(null)} />}
      {movendoTodos && <MoverTodos etapa={movendoTodos} onClose={() => setMovendoTodos(null)} />}
      {modal === "editar" && <EditarPipeline pipeline={pipeline} onClose={() => setModal(null)} />}
      {modal === "permissoes" && <PermissoesPipeline pipeline={pipeline} onClose={() => setModal(null)} />}
      {modal === "etapas" && <ConfigEtapas pipeline={pipeline} onClose={() => setModal(null)} />}
      {modal === "duplicar" && <DuplicarPipeline pipeline={pipeline} onClose={() => setModal(null)} />}
      {massa && <AcoesEmMassa acao={massa} pipeline={pipeline} onClose={() => setMassa(null)} />}
    </div>
  );
}
