import { useMemo, useState } from "react";
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
  MapPin,
  Navigation,
  Search,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Pencil,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Plus,
  Check,
  X,
} from "lucide-react";
import { useData, type Card as TCard } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { CLASSIFICACOES, CORES_ETAPA, FASE_LABEL, PRODUTO_LABEL, type Classificacao, type Etapa } from "@/lib/types";
import { brl, cx, dataBR, mapsLink } from "@/lib/utils";
import { Badge, Button, Field, Input, Modal, Select, Spinner } from "@/components/ui";
import FichaObra from "@/components/FichaObra";

type Vista = "quadro" | "lista";

export default function Kanban() {
  const { cards, etapas, vendedores, loading, moverEtapa, setClassificacao } = useData();
  const { isAdmin, pode } = useAuth();
  const podeMover = pode("mover_funil");

  const [vista, setVista] = useState<Vista>("quadro");
  const [busca, setBusca] = useState("");
  const [fVendedor, setFVendedor] = useState("");
  const [fBairro, setFBairro] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fClass, setFClass] = useState("");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [pendente, setPendente] = useState<{ card: TCard; etapa: Etapa } | null>(null);
  const [excluindo, setExcluindo] = useState<Etapa | null>(null);

  // card "ao vivo" (reflete alterações na hora)
  const detalhe = detalheId ? cards.find((c) => c.id === detalheId) ?? null : null;
  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);

  const bairros = useMemo(
    () => Array.from(new Set(cards.map((c) => c.obra?.bairro).filter(Boolean))).sort(),
    [cards]
  );

  const filtrados = useMemo(
    () =>
      cards.filter((c) => {
        if (!c.obra) return false;
        const q = busca.toLowerCase();
        if (q && !`${c.obra.nome_obra} ${c.obra.construtora}`.toLowerCase().includes(q)) return false;
        if (fVendedor === "_sem" ? c.vendedor_id : fVendedor && c.vendedor_id !== fVendedor) return false;
        if (fBairro && c.obra.bairro !== fBairro) return false;
        if (fStatus && c.obra.status_obra !== fStatus) return false;
        if (fClass && c.classificacao !== fClass) return false;
        return true;
      }),
    [cards, busca, fVendedor, fBairro, fStatus, fClass]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // Ganho/perdido pedem confirmação (valor fechado / motivo da perda)
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

  if (loading) return <Spinner />;

  const totalValor = filtrados
    .filter((c) => etapaPorId.get(c.etapa_id)?.tipo !== "perdido")
    .reduce((s, c) => s + (c.valor_estimado || 0), 0);

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-marinho-800">Funil de obras</h1>
          <p className="text-sm text-slate-500">
            {filtrados.length} oportunidades · {brl(totalValor)} em potencial
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {(["quadro", "lista"] as Vista[]).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={cx(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition",
                vista === v ? "bg-marinho-700 text-white" : "text-slate-500 hover:text-marinho-700"
              )}
            >
              {v === "quadro" ? <LayoutGrid size={16} /> : <ListIcon size={16} />} {v}
            </button>
          ))}
        </div>
      </header>

      {/* Filtros */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="relative col-span-2 sm:col-span-1 lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            placeholder="Buscar obra ou construtora..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        {(isAdmin || pode("ver_todas_obras")) && (
          <Select value={fVendedor} onChange={(e) => setFVendedor(e.target.value)}>
            <option value="">Todos vendedores</option>
            <option value="_sem">Sem responsável</option>
            {vendedores.map((v) => (<option key={v.id} value={v.id}>{v.nome}</option>))}
          </Select>
        )}
        <Select value={fBairro} onChange={(e) => setFBairro(e.target.value)}>
          <option value="">Toda zona</option>
          {bairros.map((b) => (<option key={b} value={b}>{b}</option>))}
        </Select>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Qualquer status</option>
          <option value="lancamento">Lançamento</option>
          <option value="em_andamento">Em andamento</option>
        </Select>
        <Select value={fClass} onChange={(e) => setFClass(e.target.value)}>
          <option value="">Toda classificação</option>
          <option value="frio">Frio</option>
          <option value="morno">Morno</option>
          <option value="quente">Quente</option>
        </Select>
      </div>

      {vista === "quadro" ? (
        <DndContext sensors={podeMover ? sensors : []} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {etapas.map((et, i) => (
              <Coluna
                key={et.id}
                etapa={et}
                primeira={i === 0}
                ultima={i === etapas.length - 1}
                podeEditar={isAdmin}
                cards={filtrados.filter((c) => c.etapa_id === et.id)}
                onOpen={setDetalheId}
                onExcluir={() => setExcluindo(et)}
              />
            ))}
            {isAdmin && <NovaColuna />}
          </div>
        </DndContext>
      ) : (
        <ListaView
          cards={filtrados}
          etapas={etapas}
          onOpen={setDetalheId}
          onEtapa={irParaEtapa}
          onClass={(id, cl) => podeMover && setClassificacao(id, cl)}
        />
      )}

      {detalhe && (
        <FichaObra
          card={detalhe}
          onClose={() => setDetalheId(null)}
          onMudarEtapa={(etapaId) => irParaEtapa(detalhe, etapaId)}
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

      {excluindo && <ExcluirColuna etapa={excluindo} onClose={() => setExcluindo(null)} />}
    </div>
  );
}

/* ---------------- QUADRO ---------------- */

function Coluna({
  etapa,
  primeira,
  ultima,
  podeEditar,
  cards,
  onOpen,
  onExcluir,
}: {
  etapa: Etapa;
  primeira: boolean;
  ultima: boolean;
  podeEditar: boolean;
  cards: TCard[];
  onOpen: (id: string) => void;
  onExcluir: () => void;
}) {
  const { atualizarEtapa, moverColuna } = useData();
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
    <div className="flex w-[290px] flex-shrink-0 flex-col">
      <div className="relative mb-2 flex items-center justify-between gap-2 px-1">
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
            <button onClick={salvarNome} className="rounded-lg p-1.5 text-green-600 hover:bg-green-50" aria-label="Salvar">
              <Check size={16} />
            </button>
          </div>
        ) : (
          <button
            className="flex min-w-0 items-center gap-2"
            onDoubleClick={() => { if (podeEditar) { setNome(etapa.nome); setRenomeando(true); } }}
            title={podeEditar ? "Clique duas vezes para renomear" : undefined}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: etapa.cor }} />
            <span className="truncate font-bold text-marinho-800">{etapa.nome}</span>
            <span className="rounded-full bg-slate-200 px-2 text-xs font-bold text-slate-600">{cards.length}</span>
          </button>
        )}

        {podeEditar && !renomeando && (
          <button
            onClick={() => setMenu((m) => !m)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            aria-label="Opções da coluna"
          >
            <MoreHorizontal size={18} />
          </button>
        )}

        {menu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-8 z-40 w-56 rounded-xl border border-slate-100 bg-white p-1.5 shadow-cardhover">
              <ItemMenu icon={<Pencil size={15} />} onClick={() => { setMenu(false); setNome(etapa.nome); setRenomeando(true); }}>
                Renomear
              </ItemMenu>
              <div className="flex flex-wrap gap-1.5 px-2.5 py-2">
                {CORES_ETAPA.map((cor) => (
                  <button
                    key={cor}
                    onClick={() => atualizarEtapa(etapa.id, { cor })}
                    className={cx(
                      "h-6 w-6 rounded-full border-2",
                      etapa.cor === cor ? "border-marinho-800" : "border-white"
                    )}
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
              <ItemMenu icon={<Trash2 size={15} />} perigo onClick={() => { setMenu(false); onExcluir(); }}>
                Excluir coluna
              </ItemMenu>
            </div>
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cx(
          "flex min-h-[120px] flex-1 flex-col gap-2.5 rounded-2xl p-2 transition",
          isOver ? "bg-aco-100 ring-2 ring-aco-500" : "bg-slate-100/70"
        )}
      >
        {cards.map((c) => (
          <KanbanCard key={c.id} card={c} onOpen={onOpen} />
        ))}
        {cards.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-400">Arraste cards para cá</p>}
        {soma > 0 && <p className="mt-auto px-1 pt-1 text-[11px] font-semibold text-slate-400">{brl(soma)}</p>}
      </div>
    </div>
  );
}

function ItemMenu({
  icon,
  children,
  onClick,
  perigo,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  perigo?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold",
        perigo ? "text-red-600 hover:bg-red-50" : "text-marinho-800 hover:bg-slate-50"
      )}
    >
      {icon} {children}
    </button>
  );
}

function NovaColuna() {
  const { criarEtapa } = useData();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");

  async function criar() {
    if (!nome.trim()) return;
    await criarEtapa(nome.trim());
    setNome("");
    setAberto(false);
  }

  return (
    <div className="w-[260px] flex-shrink-0">
      {aberto ? (
        <div className="rounded-2xl bg-slate-100/70 p-3">
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
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-sm font-bold text-slate-500 hover:border-aco-500 hover:text-aco-600"
        >
          <Plus size={16} /> Nova coluna
        </button>
      )}
    </div>
  );
}

function ExcluirColuna({ etapa, onClose }: { etapa: Etapa; onClose: () => void }) {
  const { etapas, cards, excluirEtapa } = useData();
  const qtd = cards.filter((c) => c.etapa_id === etapa.id).length;
  const outras = etapas.filter((e) => e.id !== etapa.id);
  const [destino, setDestino] = useState(outras[0]?.id ?? "");
  const [excluindo, setExcluindo] = useState(false);

  return (
    <Modal open onClose={onClose} title={`Excluir a coluna "${etapa.nome}"`}>
      {outras.length === 0 ? (
        <p className="text-sm text-slate-600">O funil precisa ter pelo menos uma coluna.</p>
      ) : (
        <div className="space-y-4">
          {qtd > 0 ? (
            <Field label={`Esta coluna tem ${qtd} card(s). Mover para:`}>
              <Select value={destino} onChange={(e) => setDestino(e.target.value)}>
                {outras.map((e) => (<option key={e.id} value={e.id}>{e.nome}</option>))}
              </Select>
            </Field>
          ) : (
            <p className="text-sm text-slate-600">A coluna está vazia e será removida do funil.</p>
          )}
          {etapa.tipo !== "aberta" && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Esta coluna conta como <b>{etapa.tipo === "ganho" ? "ganho" : "perdido"}</b> na taxa de conversão do
              painel. Sem ela, essa métrica deixa de ser calculada.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              variant="danger"
              className="flex-1"
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

function KanbanCard({ card, onOpen }: { card: TCard; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const cl = CLASSIFICACOES[card.classificacao];
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined;
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();
  const o = card.obra;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(card.id)}
      className={cx(
        "group cursor-grab touch-none select-none rounded-xl border border-slate-100 bg-white p-3 shadow-card active:cursor-grabbing",
        isDragging && "opacity-60 shadow-cardhover"
      )}
    >
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-marinho-800">{o?.nome_obra}</p>
          <p className="truncate text-xs text-slate-500">{o?.construtora || "—"}</p>
        </div>
        <Badge bg={cl.bg} fg={cl.fg}>{cl.label}</Badge>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <MapPin size={13} /> {o?.bairro || "—"}
        <span className="text-slate-300">·</span>
        {o?.fase_obra ? (
          <span className="rounded-md bg-marinho-50 px-1.5 py-0.5 font-semibold text-marinho-700">
            {FASE_LABEL[o.fase_obra]}
          </span>
        ) : (
          PRODUTO_LABEL[o?.produto_alvo]
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="font-bold text-marinho-700">{card.valor_estimado ? brl(card.valor_estimado) : "—"}</span>
        {o?.previsao_concretagem ? (
          <span className="text-[11px] font-medium text-slate-400">concreta {dataBR(o.previsao_concretagem)}</span>
        ) : card.proxima_etapa_data ? (
          <span className="text-[11px] font-medium text-slate-400">próx. {dataBR(card.proxima_etapa_data)}</span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
        <span className={cx("truncate text-[11px] font-semibold", card.vendedor ? "text-slate-500" : "text-amber-600")}>
          {card.vendedor?.nome ?? "Sem responsável"}
        </span>
        <a
          href={mapsLink(o?.latitude, o?.longitude, o?.endereco || o?.bairro)}
          target="_blank"
          rel="noreferrer"
          onPointerDown={stop}
          onClick={stop}
          className="flex items-center gap-1 rounded-lg bg-aco-50 px-2 py-1 text-[11px] font-bold text-aco-600 hover:bg-aco-100"
        >
          <Navigation size={12} /> Rota
        </a>
      </div>
    </div>
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
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center text-sm text-slate-500">
        Nenhuma oportunidade com os filtros atuais.
      </div>
    );

  const proxCl: Record<Classificacao, Classificacao> = { frio: "morno", morno: "quente", quente: "frio" };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
      <div className="hidden grid-cols-12 gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400 lg:grid">
        <div className="col-span-3">Obra</div>
        <div className="col-span-2">Vendedor</div>
        <div className="col-span-2">Etapa</div>
        <div className="col-span-1">Classif.</div>
        <div className="col-span-2 text-right">Valor</div>
        <div className="col-span-2 text-right">Ações</div>
      </div>
      <div className="divide-y divide-slate-100">
        {cards.map((c) => {
          const cl = CLASSIFICACOES[c.classificacao];
          return (
            <div key={c.id} className="grid grid-cols-2 items-center gap-2 px-4 py-3 lg:grid-cols-12">
              <div className="col-span-2 lg:col-span-3">
                <button onClick={() => onOpen(c.id)} className="text-left">
                  <p className="font-bold text-marinho-800 hover:text-aco-600">{c.obra?.nome_obra}</p>
                  <p className="text-xs text-slate-500">
                    {[c.obra?.construtora, c.obra?.bairro, c.obra?.fase_obra && FASE_LABEL[c.obra.fase_obra]]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </button>
              </div>
              <div className="lg:col-span-2">
                <p className="text-xs font-bold uppercase text-slate-400 lg:hidden">Vendedor</p>
                <p className="truncate text-sm text-marinho-800">{c.vendedor?.nome ?? "—"}</p>
              </div>
              <div className="lg:col-span-2">
                <Select value={c.etapa_id} onChange={(e) => onEtapa(c, e.target.value)} className="py-1.5 text-sm">
                  {etapas.map((et) => (<option key={et.id} value={et.id}>{et.nome}</option>))}
                </Select>
              </div>
              <div className="lg:col-span-1">
                <button
                  onClick={() => onClass(c.id, proxCl[c.classificacao])}
                  title="Clique para alternar a classificação"
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: cl.bg, color: cl.fg }}
                >
                  {cl.label}
                </button>
              </div>
              <div className="text-right lg:col-span-2">
                <span className="font-bold text-marinho-700">{c.valor_estimado ? brl(c.valor_estimado) : "—"}</span>
              </div>
              <div className="col-span-2 flex justify-end gap-2 lg:col-span-2">
                <a
                  href={mapsLink(c.obra?.latitude, c.obra?.longitude, c.obra?.endereco || c.obra?.bairro)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-aco-50 px-2.5 py-1.5 text-xs font-bold text-aco-600 hover:bg-aco-100"
                >
                  <Navigation size={13} /> Maps
                </a>
                <button
                  onClick={() => onOpen(c.id)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-marinho-700 hover:bg-slate-50"
                >
                  Ficha
                </button>
              </div>
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
      <div className="mt-5 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
        <Button
          variant={ganho ? "success" : "danger"}
          className="flex-1"
          onClick={() =>
            onConfirm(
              ganho
                ? { valor_estimado: Number(valor) || 0 }
                : { motivo_perda: motivo || "Não informado", concorrente: concorrente || null }
            )
          }
        >
          Confirmar
        </Button>
      </div>
    </Modal>
  );
}
