import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Navigation,
  Phone,
  MessageCircle,
  ClipboardList,
  Pencil,
  ImageIcon,
  CalendarClock,
  Truck,
  Layers,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useData, type Card as TCard } from "@/lib/data";
import { useUrls } from "@/lib/fotos";
import { Badge, Button, Field, Input, Select, Textarea } from "./ui";
import {
  FASE_LABEL,
  FASE_OBRA,
  PRODUTO_LABEL,
  RESULTADO_VISITA,
  STATUS_OBRA_LABEL,
  TIPO_RELATORIO,
  type FaseObra,
  type Obra,
  type ProdutoAlvo,
  type RelatorioVisita,
  type StatusObra,
} from "@/lib/types";
import { cx, dataBR, linkWhatsApp, mapsLink } from "@/lib/utils";

/** Dados da obra do negócio: destaques, ações rápidas, edição e visitas registradas. */
export function SecaoObra({ card, obra: o }: { card: TCard; obra: Obra }) {
  const { pode } = useAuth();
  const podeMover = pode("mover_funil");
  const { atualizarObra, atualizarOportunidade } = useData();
  const [editando, setEditando] = useState(false);
  const historico = useVisitasDaObra(o.id);
  const wa = linkWhatsApp(o.contato_telefone);

  return (
    <div>
      {/* Ações rápidas */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <a href={mapsLink(o.latitude, o.longitude, o.endereco || o.bairro)} target="_blank" rel="noreferrer">
          <Button variant="secondary" className="w-full"><Navigation size={16} /> Rota</Button>
        </a>
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full"><MessageCircle size={16} /> WhatsApp</Button>
          </a>
        ) : (
          <Button variant="secondary" className="w-full" disabled><MessageCircle size={16} /> WhatsApp</Button>
        )}
        {o.contato_telefone ? (
          <a href={`tel:${o.contato_telefone.replace(/\s/g, "")}`}>
            <Button variant="secondary" className="w-full"><Phone size={16} /> Ligar</Button>
          </a>
        ) : (
          <Button variant="secondary" className="w-full" disabled><Phone size={16} /> Ligar</Button>
        )}
        <Link to={`/relatorios?obra=${o.id}`}>
          <Button className="w-full"><ClipboardList size={16} /> Registrar visita</Button>
        </Link>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h4 className="font-semibold text-marinho-800">{o.nome_obra}</h4>
        {!editando && podeMover && (
          <Button size="sm" variant="ghost" onClick={() => setEditando(true)}>
            <Pencil size={14} /> Editar
          </Button>
        )}
      </div>

      {editando ? (
        <EditarFicha
          card={card}
          obra={o}
          onCancelar={() => setEditando(false)}
          onSalvar={async (obraPatch, opPatch) => {
            const ok = await atualizarObra(o.id, obraPatch);
            await atualizarOportunidade(card.id, opPatch);
            if (ok) setEditando(false);
          }}
        />
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Destaque icon={<Layers size={15} />} label="Fase" valor={o.fase_obra ? FASE_LABEL[o.fase_obra] : "—"} />
            <Destaque
              icon={<CalendarClock size={15} />}
              label="Concretagem prevista"
              valor={o.previsao_concretagem ? dataBR(o.previsao_concretagem) : "—"}
            />
            <Destaque label="Volume estimado" valor={o.volume_estimado_m3 ? `${o.volume_estimado_m3} m³` : "—"} />
            <Destaque icon={<Truck size={15} />} label="Fornecedor atual" valor={o.fornecedor_atual || "—"} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Info label="Construtora" valor={o.construtora} />
            <Info label="Situação" valor={STATUS_OBRA_LABEL[o.status_obra]} />
            <Info label="Produto-alvo" valor={PRODUTO_LABEL[o.produto_alvo]} />
            <Info label="Pavimentos" valor={o.pavimentos ? String(o.pavimentos) : ""} />
            <Info label="Área construída" valor={o.area_m2 ? `${o.area_m2} m²` : ""} />
            <Info label="Bairro" valor={o.bairro} />
            <Info label="Endereço" valor={o.endereco} />
            <Info
              label="Contato na obra"
              valor={[o.contato_nome, o.contato_cargo && `(${o.contato_cargo})`].filter(Boolean).join(" ")}
            />
            <Info label="Telefone" valor={o.contato_telefone} />
          </div>
          {o.observacoes && (
            <div className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              {o.observacoes}
            </div>
          )}
        </>
      )}

      <h4 className="mt-6 font-semibold text-marinho-800">
        Visitas nesta obra {historico && historico.length > 0 && `(${historico.length})`}
      </h4>
      <ListaVisitas historico={historico} />
    </div>
  );
}

export function useVisitasDaObra(obraId: string | null | undefined) {
  const [historico, setHistorico] = useState<RelatorioVisita[] | null>(null);
  useEffect(() => {
    let vivo = true;
    if (!obraId) {
      setHistorico([]);
      return;
    }
    supabase
      .from("relatorios_visita")
      .select("*, vendedor:profiles(nome)")
      .eq("obra_id", obraId)
      .order("data_visita", { ascending: false })
      .order("criado_em", { ascending: false })
      .then(({ data }) => vivo && setHistorico((data as RelatorioVisita[]) ?? []));
    return () => {
      vivo = false;
    };
  }, [obraId]);
  return historico;
}

export function ListaVisitas({ historico }: { historico: RelatorioVisita[] | null }) {
  if (historico === null) return <p className="mt-2 text-sm text-slate-400">Carregando...</p>;
  if (historico.length === 0)
    return (
      <p className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
        Nenhuma visita registrada ainda.
      </p>
    );
  return (
    <div className="mt-2 space-y-2">
      {historico.map((r) => (
        <ItemHistorico key={r.id} r={r} />
      ))}
    </div>
  );
}

function ItemHistorico({ r }: { r: RelatorioVisita }) {
  const urls = useUrls((r.fotos ?? []).slice(0, 4));
  const rs = RESULTADO_VISITA[r.resultado];
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-bold text-marinho-800">{dataBR(r.data_visita)}</span>
        <span className="text-xs text-slate-400">· {r.vendedor?.nome ?? "—"}</span>
        <Badge bg={TIPO_RELATORIO[r.tipo].bg} fg={TIPO_RELATORIO[r.tipo].fg}>{TIPO_RELATORIO[r.tipo].curto}</Badge>
        <Badge bg={rs.bg} fg={rs.fg}>{rs.label}</Badge>
        {r.fase_obra && <Badge>{FASE_LABEL[r.fase_obra]}</Badge>}
      </div>
      {r.resumo && <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600">{r.resumo}</p>}
      {r.fotos?.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {r.fotos.slice(0, 4).map((p) =>
            urls[p] ? (
              <a key={p} href={urls[p]} target="_blank" rel="noreferrer" className="h-14 w-14 overflow-hidden rounded-lg">
                <img src={urls[p]} alt="" className="h-full w-full object-cover" loading="lazy" />
              </a>
            ) : (
              <div key={p} className="grid h-14 w-14 place-items-center rounded-lg bg-slate-100 text-slate-300">
                <ImageIcon size={16} />
              </div>
            )
          )}
          {r.fotos.length > 4 && (
            <span className="self-center text-xs font-semibold text-slate-400">+{r.fotos.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}

function EditarFicha({
  card,
  obra: o,
  onCancelar,
  onSalvar,
}: {
  card: TCard;
  obra: Obra;
  onCancelar: () => void;
  onSalvar: (obra: Record<string, unknown>, op: Record<string, unknown>) => Promise<void>;
}) {
  const [f, setF] = useState({
    construtora: o.construtora ?? "",
    status_obra: o.status_obra,
    fase_obra: (o.fase_obra ?? "") as FaseObra | "",
    previsao_concretagem: o.previsao_concretagem ?? "",
    volume_estimado_m3: o.volume_estimado_m3 ? String(o.volume_estimado_m3) : "",
    produto_alvo: o.produto_alvo,
    pavimentos: o.pavimentos ? String(o.pavimentos) : "",
    area_m2: o.area_m2 ? String(o.area_m2) : "",
    fornecedor_atual: o.fornecedor_atual ?? "",
    bairro: o.bairro ?? "",
    endereco: o.endereco ?? "",
    contato_nome: o.contato_nome ?? "",
    contato_cargo: o.contato_cargo ?? "",
    contato_telefone: o.contato_telefone ?? "",
    observacoes: o.observacoes ?? "",
    valor_estimado: card.valor_estimado ? String(card.valor_estimado) : "",
    proxima_etapa_data: card.proxima_etapa_data ?? "",
    previsao_fechamento: card.previsao_fechamento ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => (v === "" ? null : Number(v));

  async function salvar() {
    setSalvando(true);
    await onSalvar(
      {
        construtora: f.construtora.trim(),
        status_obra: f.status_obra,
        fase_obra: f.fase_obra || null,
        previsao_concretagem: f.previsao_concretagem || null,
        volume_estimado_m3: num(f.volume_estimado_m3) ?? 0,
        produto_alvo: f.produto_alvo,
        pavimentos: num(f.pavimentos),
        area_m2: num(f.area_m2),
        fornecedor_atual: f.fornecedor_atual.trim(),
        bairro: f.bairro.trim(),
        endereco: f.endereco.trim(),
        contato_nome: f.contato_nome.trim(),
        contato_cargo: f.contato_cargo.trim(),
        contato_telefone: f.contato_telefone.trim(),
        observacoes: f.observacoes,
      },
      {
        valor_estimado: num(f.valor_estimado) ?? 0,
        proxima_etapa_data: f.proxima_etapa_data || null,
        previsao_fechamento: f.previsao_fechamento || null,
      }
    );
    setSalvando(false);
  }

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="mb-1.5 text-sm font-semibold text-marinho-800">Fase da obra</p>
        <div className="flex flex-wrap gap-1.5">
          {FASE_OBRA.map((fa) => (
            <button
              key={fa.key}
              type="button"
              onClick={() => set("fase_obra", f.fase_obra === fa.key ? "" : fa.key)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                f.fase_obra === fa.key
                  ? "border-marinho-700 bg-marinho-700 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              )}
            >
              {fa.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Concretagem prevista">
          <Input type="date" value={f.previsao_concretagem} onChange={(e) => set("previsao_concretagem", e.target.value)} />
        </Field>
        <Field label="Volume estimado (m³)">
          <Input type="number" inputMode="decimal" value={f.volume_estimado_m3} onChange={(e) => set("volume_estimado_m3", e.target.value)} />
        </Field>
        <Field label="Fornecedor atual">
          <Input value={f.fornecedor_atual} onChange={(e) => set("fornecedor_atual", e.target.value)} placeholder="Concorrente que atende hoje" />
        </Field>
        <Field label="Construtora">
          <Input value={f.construtora} onChange={(e) => set("construtora", e.target.value)} />
        </Field>
        <Field label="Situação">
          <Select value={f.status_obra} onChange={(e) => set("status_obra", e.target.value as StatusObra)}>
            <option value="lancamento">Lançamento</option>
            <option value="em_andamento">Em andamento</option>
          </Select>
        </Field>
        <Field label="Produto-alvo">
          <Select value={f.produto_alvo} onChange={(e) => set("produto_alvo", e.target.value as ProdutoAlvo)}>
            {(Object.keys(PRODUTO_LABEL) as ProdutoAlvo[]).map((k) => (<option key={k} value={k}>{PRODUTO_LABEL[k]}</option>))}
          </Select>
        </Field>
        <Field label="Pavimentos">
          <Input type="number" inputMode="numeric" value={f.pavimentos} onChange={(e) => set("pavimentos", e.target.value)} />
        </Field>
        <Field label="Área construída (m²)">
          <Input type="number" inputMode="decimal" value={f.area_m2} onChange={(e) => set("area_m2", e.target.value)} />
        </Field>
        <Field label="Valor estimado (R$)">
          <Input type="number" inputMode="decimal" value={f.valor_estimado} onChange={(e) => set("valor_estimado", e.target.value)} />
        </Field>
        <Field label="Bairro">
          <Input value={f.bairro} onChange={(e) => set("bairro", e.target.value)} />
        </Field>
        <Field label="Endereço">
          <Input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} />
        </Field>
        <Field label="Próximo contato">
          <Input type="date" value={f.proxima_etapa_data} onChange={(e) => set("proxima_etapa_data", e.target.value)} />
        </Field>
        <Field label="Contato">
          <Input value={f.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} />
        </Field>
        <Field label="Cargo">
          <Input value={f.contato_cargo} onChange={(e) => set("contato_cargo", e.target.value)} />
        </Field>
        <Field label="Telefone / WhatsApp">
          <Input value={f.contato_telefone} onChange={(e) => set("contato_telefone", e.target.value)} />
        </Field>
        <Field label="Previsão de fechamento">
          <Input type="date" value={f.previsao_fechamento} onChange={(e) => set("previsao_fechamento", e.target.value)} />
        </Field>
      </div>
      <Field label="Observações">
        <Textarea value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Button>
        <Button className="flex-1" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar dados"}
        </Button>
      </div>
    </div>
  );
}

function Destaque({ icon, label, valor }: { icon?: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
        {icon} {label}
      </p>
      <p className="mt-0.5 truncate font-bold text-marinho-800">{valor}</p>
    </div>
  );
}

export function Info({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-medium text-marinho-800">{valor || "—"}</p>
    </div>
  );
}
