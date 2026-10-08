import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navigation, Phone, MessageCircle, ClipboardList, ImageIcon, CalendarClock, Truck, Layers, Boxes } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useData, type Card as TCard } from "@/lib/data";
import { useUrls } from "@/lib/fotos";
import { Badge, Button, CampoEditavel } from "./ui";
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
import { dataBR, linkWhatsApp, rotaObra } from "@/lib/utils";

const OPCOES_FASE = FASE_OBRA.map((f) => ({ valor: f.key, rotulo: f.label }));
const OPCOES_SITUACAO = (Object.keys(STATUS_OBRA_LABEL) as StatusObra[]).map((k) => ({ valor: k, rotulo: STATUS_OBRA_LABEL[k] }));
const OPCOES_PRODUTO = (Object.keys(PRODUTO_LABEL) as ProdutoAlvo[]).map((k) => ({ valor: k, rotulo: PRODUTO_LABEL[k] }));

/** texto do campo → número (vazio ou inválido = null) */
const numero = (v: string) => {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return isNaN(n) ? null : n;
};

/**
 * Dados da obra do negócio: destaques, ações rápidas e visitas registradas.
 * Cada informação é editada clicando direto em cima dela (quem pode mover o funil).
 */
export function SecaoObra({ obra: o }: { card: TCard; obra: Obra }) {
  const { pode } = useAuth();
  const podeEditar = pode("mover_funil");
  const { atualizarObra } = useData();
  const historico = useVisitasDaObra(o.id);
  const wa = linkWhatsApp(o.contato_telefone);
  const salvar = (patch: Partial<Obra>) => atualizarObra(o.id, patch);
  const campo = { podeEditar };

  return (
    <div>
      {/* Ações rápidas */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <a href={rotaObra(o)} target="_blank" rel="noreferrer">
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

      {/* Destaques */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CampoEditavel
          {...campo}
          destaque
          icone={<Layers size={13} />}
          label="Fase"
          valor={o.fase_obra}
          opcoes={OPCOES_FASE}
          onSalvar={(v) => salvar({ fase_obra: (v || null) as FaseObra | null })}
        />
        <CampoEditavel
          {...campo}
          destaque
          icone={<CalendarClock size={13} />}
          label="Concretagem prevista"
          valor={o.previsao_concretagem}
          tipo="date"
          onSalvar={(v) => salvar({ previsao_concretagem: v || null })}
        />
        <CampoEditavel
          {...campo}
          destaque
          icone={<Boxes size={13} />}
          label="Volume estimado"
          valor={o.volume_estimado_m3 || ""}
          tipo="number"
          sufixo="m³"
          onSalvar={(v) => salvar({ volume_estimado_m3: numero(v) ?? 0 })}
        />
        <CampoEditavel
          {...campo}
          destaque
          icone={<Truck size={13} />}
          label="Fornecedor atual"
          valor={o.fornecedor_atual}
          onSalvar={(v) => salvar({ fornecedor_atual: v })}
        />
      </div>

      {/* Ficha da obra */}
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <div className="col-span-2">
          <CampoEditavel {...campo} label="Nome da obra" valor={o.nome_obra} onSalvar={(v) => v && salvar({ nome_obra: v })} />
        </div>
        <CampoEditavel {...campo} label="Construtora" valor={o.construtora} onSalvar={(v) => salvar({ construtora: v })} />
        <CampoEditavel
          {...campo}
          label="Situação"
          valor={o.status_obra}
          opcoes={OPCOES_SITUACAO}
          obrigatorio
          onSalvar={(v) => v && salvar({ status_obra: v as StatusObra })}
        />
        <CampoEditavel
          {...campo}
          label="Produto-alvo"
          valor={o.produto_alvo}
          opcoes={OPCOES_PRODUTO}
          obrigatorio
          onSalvar={(v) => v && salvar({ produto_alvo: v as ProdutoAlvo })}
        />
        <CampoEditavel {...campo} label="Pavimentos" valor={o.pavimentos} tipo="number" onSalvar={(v) => salvar({ pavimentos: numero(v) })} />
        <CampoEditavel
          {...campo}
          label="Área construída"
          valor={o.area_m2}
          tipo="number"
          sufixo="m²"
          onSalvar={(v) => salvar({ area_m2: numero(v) })}
        />
        <CampoEditavel {...campo} label="Bairro" valor={o.bairro} onSalvar={(v) => salvar({ bairro: v })} />
        <div className="col-span-2 sm:col-span-1">
          <CampoEditavel {...campo} label="Endereço" valor={o.endereco} onSalvar={(v) => salvar({ endereco: v })} />
        </div>
        <div className="col-span-2">
          <CampoEditavel
            {...campo}
            label="Link do mapa (Google Maps / Waze)"
            valor={o.maps_url}
            tipo="url"
            link={o.maps_url || null}
            onSalvar={(v) => salvar({ maps_url: v || null })}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <CampoEditavel {...campo} label="Contato na obra" valor={o.contato_nome} onSalvar={(v) => salvar({ contato_nome: v })} />
        </div>
        <CampoEditavel {...campo} label="Cargo" valor={o.contato_cargo} onSalvar={(v) => salvar({ contato_cargo: v })} />
        <CampoEditavel {...campo} label="Telefone" valor={o.contato_telefone} tipo="tel" onSalvar={(v) => salvar({ contato_telefone: v })} />
        <div className="col-span-2 sm:col-span-3">
          <CampoEditavel {...campo} label="Observações" valor={o.observacoes} tipo="textarea" onSalvar={(v) => salvar({ observacoes: v })} />
        </div>
      </div>

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

export function Info({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-medium text-marinho-800">{valor || "—"}</p>
    </div>
  );
}
