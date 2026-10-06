import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Navigation,
  Route as RouteIcon,
  FileDown,
  Plus,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Empty, Field, Modal, Select, Spinner, Textarea } from "@/components/ui";
import {
  STATUS_VISITA_LABEL,
  type StatusVisita,
  type Visita,
  type Obra,
} from "@/lib/types";
import { agruparPorProximidade, cx, dataBR, hojeISO, mapsLink } from "@/lib/utils";

const STATUS_COR: Record<StatusVisita, { bg: string; fg: string }> = {
  agendada: { bg: "#dbeafe", fg: "#1d4ed8" },
  realizada: { bg: "#dcfce7", fg: "#15803d" },
  remarcada: { bg: "#fef3c7", fg: "#b45309" },
  cancelada: { bg: "#fee2e2", fg: "#b91c1c" },
};

export default function Visitas() {
  const { visitas, vendedores, obras, loading, salvarVisita } = useData();
  const { profile, isAdmin } = useAuth();

  const [vendedorId, setVendedorId] = useState(isAdmin ? vendedores[0]?.id ?? "" : profile?.id ?? "");
  const [data, setData] = useState(hojeISO());
  const [agendar, setAgendar] = useState(false);

  const vendedorSel = isAdmin ? vendedorId : profile?.id ?? "";

  const doDia = useMemo(() => {
    const lista = visitas.filter(
      (v) => v.vendedor_id === vendedorSel && v.data_visita === data
    );
    // ordena por proximidade (bairro)
    const obrasOrd = agruparPorProximidade(lista.map((v) => v.obra));
    const ordemId = new Map(obrasOrd.map((o, i) => [o.id, i]));
    return [...lista].sort(
      (a, b) => (ordemId.get(a.obra.id) ?? 0) - (ordemId.get(b.obra.id) ?? 0)
    );
  }, [visitas, vendedorSel, data]);

  const realizadas = doDia.filter((v) => v.status_visita === "realizada").length;

  if (loading) return <Spinner />;

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-marinho-800">Visitas do dia</h1>
          <p className="text-sm text-slate-500">
            {doDia.length} visita(s) · {realizadas} realizada(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setAgendar(true)}>
            <Plus size={16} /> Agendar visita
          </Button>
          {doDia.length > 0 && (
            <a href={`/visitas/rota/${vendedorSel}/${data}`} target="_blank" rel="noreferrer">
              <Button>
                <FileDown size={16} /> Exportar rota (PDF)
              </Button>
            </a>
          )}
        </div>
      </header>

      {/* Seletores */}
      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:max-w-xl">
        {isAdmin && (
          <div>
            <label className="mb-1 block text-sm font-semibold text-marinho-800">Vendedor</label>
            <Select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
              {vendedores.map((v) => (<option key={v.id} value={v.id}>{v.nome} — {v.zona_atuacao}</option>))}
            </Select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-semibold text-marinho-800">Dia</label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-aco-500 focus:ring-2 focus:ring-aco-100"
            />
          </div>
        </div>
      </div>

      {doDia.length > 0 && (
        <Card className="mb-4 flex items-center justify-between gap-3 bg-marinho-700 p-4 text-white">
          <div className="flex items-center gap-3">
            <RouteIcon size={22} />
            <div>
              <p className="font-bold">Rota otimizada por proximidade</p>
              <p className="text-xs text-aco-100">
                {doDia.map((v) => v.obra.bairro).filter((b, i, a) => a.indexOf(b) === i).join(" → ")}
              </p>
            </div>
          </div>
        </Card>
      )}

      {doDia.length === 0 ? (
        <Empty
          icon={<RouteIcon size={40} />}
          titulo="Nenhuma visita para este dia"
          texto="Agende visitas para montar a rota do vendedor. O padrão é 3 obras por dia, agrupadas por zona."
        />
      ) : (
        <div className="space-y-3">
          {doDia.map((v, i) => (
            <VisitaItem key={v.id} visita={v} ordem={i + 1} onSalvar={salvarVisita} />
          ))}
        </div>
      )}

      {agendar && (
        <AgendarModal
          obras={obras}
          vendedorId={vendedorSel}
          data={data}
          onClose={() => setAgendar(false)}
          onSalvar={salvarVisita}
        />
      )}
    </div>
  );
}

function VisitaItem({
  visita,
  ordem,
  onSalvar,
}: {
  visita: Visita & { obra: Obra };
  ordem: number;
  onSalvar: (v: Partial<Visita> & { id?: string }) => Promise<void>;
}) {
  const [status, setStatus] = useState<StatusVisita>(visita.status_visita);
  const [resultado, setResultado] = useState(visita.resultado);
  const [proximo, setProximo] = useState(visita.proximo_passo);
  const [salvo, setSalvo] = useState(false);
  const cor = STATUS_COR[status];
  const o = visita.obra;

  const alterado =
    status !== visita.status_visita ||
    resultado !== visita.resultado ||
    proximo !== visita.proximo_passo;

  async function salvar() {
    await onSalvar({ id: visita.id, status_visita: status, resultado, proximo_passo: proximo });
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1500);
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-marinho-700 text-sm font-bold text-white">
          {ordem}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-marinho-800">{o.nome_obra}</p>
            <Badge bg={cor.bg} fg={cor.fg}>{STATUS_VISITA_LABEL[status]}</Badge>
          </div>
          <p className="text-sm text-slate-500">
            {o.construtora} · {o.bairro} · {o.contato_nome} {o.contato_telefone && `· ${o.contato_telefone}`}
          </p>
        </div>
        <a
          href={mapsLink(o.latitude, o.longitude, o.endereco)}
          target="_blank"
          rel="noreferrer"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-aco-500 px-3 py-2 text-sm font-bold text-white hover:bg-aco-600"
        >
          <Navigation size={16} /> Rota
        </a>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusVisita)}>
            <option value="agendada">Agendada</option>
            <option value="realizada">Realizada</option>
            <option value="remarcada">Remarcada</option>
            <option value="cancelada">Cancelada</option>
          </Select>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Textarea placeholder="Resultado da visita" value={resultado} onChange={(e) => setResultado(e.target.value)} className="min-h-[44px]" />
          <Textarea placeholder="Próximo passo" value={proximo} onChange={(e) => setProximo(e.target.value)} className="min-h-[44px]" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Link to={`/relatorios?obra=${o.id}`}>
          <Button size="sm" variant="secondary">
            <ClipboardList size={15} /> Registrar relatório
          </Button>
        </Link>
        {(alterado || salvo) && (
          <Button size="sm" variant={salvo ? "success" : "primary"} onClick={salvar}>
            {salvo ? <><CheckCircle2 size={15} /> Salvo</> : "Salvar atualização"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function AgendarModal({
  obras,
  vendedorId,
  data,
  onClose,
  onSalvar,
}: {
  obras: Obra[];
  vendedorId: string;
  data: string;
  onClose: () => void;
  onSalvar: (v: Partial<Visita>) => Promise<void>;
}) {
  const [obraId, setObraId] = useState(obras[0]?.id ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!obraId) return;
    setSalvando(true);
    await onSalvar({
      obra_id: obraId,
      vendedor_id: vendedorId,
      data_visita: data,
      status_visita: "agendada",
    });
    setSalvando(false);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Agendar visita">
      <div className="space-y-4">
        <Field label="Obra">
          <Select value={obraId} onChange={(e) => setObraId(e.target.value)}>
            {obras.map((o) => (<option key={o.id} value={o.id}>{o.nome_obra} — {o.bairro}</option>))}
          </Select>
        </Field>
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Dia da visita: <b>{dataBR(data)}</b>
        </div>
        <Button className={cx("w-full")} size="lg" onClick={salvar} disabled={salvando}>
          {salvando ? "Agendando..." : "Agendar"}
        </Button>
      </div>
    </Modal>
  );
}
