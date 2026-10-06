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
import { MapPin, Navigation, Search, GripVertical, Flame } from "lucide-react";
import { useData, type Card as TCard } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import {
  ETAPAS,
  CLASSIFICACOES,
  PRODUTO_LABEL,
  STATUS_OBRA_LABEL,
  type Etapa,
  type Classificacao,
} from "@/lib/types";
import { brl, cx, dataBR, mapsLink } from "@/lib/utils";
import { Badge, Button, Field, Input, Modal, Select, Spinner } from "@/components/ui";

export default function Kanban() {
  const { cards, vendedores, loading, moverEtapa, setClassificacao } = useData();
  const { isAdmin } = useAuth();

  const [busca, setBusca] = useState("");
  const [fVendedor, setFVendedor] = useState("");
  const [fBairro, setFBairro] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fClass, setFClass] = useState("");
  const [detalhe, setDetalhe] = useState<TCard | null>(null);
  const [pendente, setPendente] = useState<{ card: TCard; etapa: Etapa } | null>(null);

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
        if (fVendedor && c.vendedor_id !== fVendedor) return false;
        if (fBairro && c.obra.bairro !== fBairro) return false;
        if (fStatus && c.obra.status_obra !== fStatus) return false;
        if (fClass && c.classificacao !== fClass) return false;
        return true;
      }),
    [cards, busca, fVendedor, fBairro, fStatus, fClass]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  function onDragEnd(e: DragEndEvent) {
    const card = cards.find((c) => c.id === e.active.id);
    const destino = e.over?.id as Etapa | undefined;
    if (!card || !destino || card.etapa === destino) return;
    if (destino === "perdido" || destino === "ganho") {
      setPendente({ card, etapa: destino });
      return;
    }
    moverEtapa(card.id, destino);
  }

  if (loading) return <Spinner />;

  const totalValor = filtrados
    .filter((c) => c.etapa !== "perdido")
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
        {isAdmin && (
          <Select value={fVendedor} onChange={(e) => setFVendedor(e.target.value)}>
            <option value="">Todos vendedores</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
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

      {/* Board */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ETAPAS.map((et) => (
            <Coluna
              key={et.key}
              etapa={et}
              cards={filtrados.filter((c) => c.etapa === et.key)}
              onOpen={setDetalhe}
            />
          ))}
        </div>
      </DndContext>

      {detalhe && (
        <DetalheModal
          card={detalhe}
          onClose={() => setDetalhe(null)}
          onClass={(c) => setClassificacao(detalhe.id, c)}
        />
      )}

      {pendente && (
        <ConfirmarEtapa
          info={pendente}
          onClose={() => setPendente(null)}
          onConfirm={(extra) => {
            moverEtapa(pendente.card.id, pendente.etapa, extra);
            setPendente(null);
          }}
        />
      )}
    </div>
  );
}

function Coluna({
  etapa,
  cards,
  onOpen,
}: {
  etapa: (typeof ETAPAS)[number];
  cards: TCard[];
  onOpen: (c: TCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.key });
  const soma = cards.reduce((s, c) => s + (c.valor_estimado || 0), 0);
  return (
    <div className="flex w-[290px] flex-shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: etapa.cor }} />
          <span className="font-bold text-marinho-800">{etapa.label}</span>
          <span className="rounded-full bg-slate-200 px-2 text-xs font-bold text-slate-600">
            {cards.length}
          </span>
        </div>
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
        {cards.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-slate-400">Arraste cards para cá</p>
        )}
        {soma > 0 && (
          <p className="mt-auto px-1 pt-1 text-[11px] font-semibold text-slate-400">
            {brl(soma)}
          </p>
        )}
      </div>
    </div>
  );
}

function KanbanCard({ card, onOpen }: { card: TCard; onOpen: (c: TCard) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const cl = CLASSIFICACOES[card.classificacao];
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(
        "group rounded-xl border border-slate-100 bg-white p-3 shadow-card",
        isDragging && "opacity-60 shadow-cardhover"
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          aria-label="Arrastar"
        >
          <GripVertical size={16} />
        </button>
        <button onClick={() => onOpen(card)} className="min-w-0 flex-1 text-left">
          <p className="truncate font-bold text-marinho-800">{card.obra?.nome_obra}</p>
          <p className="truncate text-xs text-slate-500">{card.obra?.construtora}</p>
        </button>
        <Badge bg={cl.bg} fg={cl.fg}>{cl.label}</Badge>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
        <MapPin size={13} /> {card.obra?.bairro}
        <span className="text-slate-300">·</span>
        {PRODUTO_LABEL[card.obra?.produto_alvo]}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="font-bold text-marinho-700">{brl(card.valor_estimado)}</span>
        {card.proxima_etapa_data && (
          <span className="text-[11px] font-medium text-slate-400">
            próx. {dataBR(card.proxima_etapa_data)}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
        <span className="truncate text-[11px] font-semibold text-slate-500">
          {card.vendedor?.nome ?? "Sem responsável"}
        </span>
        <a
          href={mapsLink(card.obra?.latitude, card.obra?.longitude, card.obra?.endereco)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 rounded-lg bg-aco-50 px-2 py-1 text-[11px] font-bold text-aco-600 hover:bg-aco-100"
        >
          <Navigation size={12} /> Rota
        </a>
      </div>
    </div>
  );
}

function DetalheModal({
  card,
  onClose,
  onClass,
}: {
  card: TCard;
  onClose: () => void;
  onClass: (c: Classificacao) => void;
}) {
  const o = card.obra;
  return (
    <Modal open onClose={onClose} title={o?.nome_obra ?? "Obra"} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Info label="Construtora" valor={o?.construtora} />
        <Info label="Status da obra" valor={STATUS_OBRA_LABEL[o?.status_obra]} />
        <Info label="Produto-alvo" valor={PRODUTO_LABEL[o?.produto_alvo]} />
        <Info label="Volume estimado" valor={`${o?.volume_estimado_m3 ?? 0} m³`} />
        <Info label="Bairro" valor={`${o?.bairro} · ${o?.cidade}/${o?.uf}`} />
        <Info label="Endereço" valor={o?.endereco} />
        <Info label="Contato" valor={`${o?.contato_nome} (${o?.contato_cargo})`} />
        <Info label="Telefone" valor={o?.contato_telefone} />
        <Info label="Responsável" valor={card.vendedor?.nome} />
        <Info label="Valor estimado" valor={brl(card.valor_estimado)} />
        <Info label="Previsão de fechamento" valor={dataBR(card.previsao_fechamento)} />
        <Info label="Próxima etapa" valor={dataBR(card.proxima_etapa_data)} />
      </div>

      {o?.observacoes && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{o.observacoes}</div>
      )}

      {card.motivo_perda && (
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <b>Motivo da perda:</b> {card.motivo_perda}
          {card.concorrente ? ` · Concorrente: ${card.concorrente}` : ""}
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-marinho-800">
          <Flame size={15} /> Classificação (temperatura)
        </p>
        <div className="flex gap-2">
          {(["frio", "morno", "quente"] as Classificacao[]).map((c) => (
            <button
              key={c}
              onClick={() => onClass(c)}
              className={cx(
                "flex-1 rounded-xl border-2 py-2 text-sm font-bold capitalize transition",
                card.classificacao === c ? "border-aco-500" : "border-transparent"
              )}
              style={{ background: CLASSIFICACOES[c].bg, color: CLASSIFICACOES[c].fg }}
            >
              {CLASSIFICACOES[c].label}
            </button>
          ))}
        </div>
      </div>

      <a
        href={mapsLink(o?.latitude, o?.longitude, o?.endereco)}
        target="_blank"
        rel="noreferrer"
        className="mt-5 block"
      >
        <Button className="w-full" size="lg">
          <Navigation size={18} /> Abrir rota no Google Maps
        </Button>
      </a>
    </Modal>
  );
}

function Info({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-medium text-marinho-800">{valor || "—"}</p>
    </div>
  );
}

function ConfirmarEtapa({
  info,
  onClose,
  onConfirm,
}: {
  info: { card: TCard; etapa: Etapa };
  onClose: () => void;
  onConfirm: (extra: Record<string, unknown>) => void;
}) {
  const ganho = info.etapa === "ganho";
  const [valor, setValor] = useState(String(info.card.valor_estimado || 0));
  const [motivo, setMotivo] = useState("");
  const [concorrente, setConcorrente] = useState("");

  return (
    <Modal open onClose={onClose} title={ganho ? "Marcar como Ganho 🎉" : "Marcar como Perdido"}>
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
