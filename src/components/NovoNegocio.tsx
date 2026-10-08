import { useMemo, useState } from "react";
import { Building2, Plus, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { Avatar, Button, Field, Input, Select, SeloTipo } from "./ui";
import { NovoLeadModal } from "./NovoLead";
import type { Lead } from "@/lib/types";
import { cx } from "@/lib/utils";

/** Busca de lead com lista suspensa e atalho para criar um novo. */
export function BuscaLead({
  valor,
  onChange,
  onCriarNovo,
  filtro,
}: {
  valor: Lead | null;
  onChange: (l: Lead | null) => void;
  onCriarNovo: (nome: string) => void;
  filtro?: (l: Lead) => boolean;
}) {
  const { leads } = useData();
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const lista = useMemo(() => {
    const t = q.toLowerCase();
    return leads
      .filter((l) => (filtro ? filtro(l) : true))
      .filter((l) => !t || `${l.nome} ${l.nome_exibicao} ${l.telefone} ${l.email}`.toLowerCase().includes(t))
      .slice(0, 8);
  }, [leads, q, filtro]);

  if (valor)
    return (
      <div className="flex items-center gap-3 rounded-md border border-[#D7DBDF] px-3 py-2">
        <Avatar nome={valor.nome} size={30} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-marinho-800">{valor.nome_exibicao || valor.nome}</p>
          <p className="truncate text-xs text-slate-500">{valor.telefone || valor.email || "Sem contato"}</p>
        </div>
        <SeloTipo tipo={valor.tipo} />
        <button onClick={() => onChange(null)} className="text-slate-400 hover:text-slate-700" aria-label="Trocar lead">
          <X size={16} />
        </button>
      </div>
    );

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder="Buscar lead por nome, telefone ou e-mail..."
        className="pl-9"
      />
      {aberto && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-cardhover">
          {lista.map((l) => (
            <button
              key={l.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(l);
                setQ("");
                setAberto(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
            >
              <Avatar nome={l.nome} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm text-marinho-800">{l.nome_exibicao || l.nome}</span>
              <SeloTipo tipo={l.tipo} />
            </button>
          ))}
          {lista.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">Nenhum lead encontrado.</p>}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCriarNovo(q)}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-aco-600 hover:bg-aco-50"
          >
            <Plus size={16} /> Criar novo lead{q ? ` "${q}"` : ""}
          </button>
        </div>
      )}
    </div>
  );
}

export function NovoNegocioModal({
  pipelineId,
  etapaId,
  leadInicial = null,
  onClose,
  onCriado,
}: {
  pipelineId: string;
  etapaId?: string;
  leadInicial?: Lead | null;
  onClose: () => void;
  onCriado?: (oportunidadeId: string) => void;
}) {
  const { etapas, obras, vendedores, pipelines, criarNegocio, recarregar } = useData();
  const { profile, isAdmin } = useAuth();
  const [pid, setPid] = useState(pipelineId);
  const colunas = etapas.filter((e) => e.pipeline_id === pid);
  const [etapa, setEtapa] = useState(etapaId ?? colunas.find((e) => e.tipo === "aberta")?.id ?? colunas[0]?.id ?? "");
  const [lead, setLead] = useState<Lead | null>(leadInicial);
  const [criandoLead, setCriandoLead] = useState<string | null>(null);
  const [obraModo, setObraModo] = useState<"nenhuma" | "existente" | "nova">("nova");
  const [obraId, setObraId] = useState("");
  const [obraNome, setObraNome] = useState("");
  const [obraBairro, setObraBairro] = useState("");
  const [buscaObra, setBuscaObra] = useState("");
  const [obraAberta, setObraAberta] = useState(false);
  const [valor, setValor] = useState("");
  const [vendedor, setVendedor] = useState(isAdmin ? "" : profile?.id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!lead) return setErro("Escolha ou crie o lead do negócio.");
    if (!etapa) return setErro("Escolha a etapa.");
    if (obraModo === "nova" && !obraNome.trim()) return setErro("Informe o nome da obra ou escolha “Sem obra”.");
    setSalvando(true);
    let obra: string | null = obraModo === "existente" ? obraId || null : null;
    if (obraModo === "nova") {
      const { data, error } = await supabase
        .from("obras")
        .insert({
          nome_obra: obraNome.trim(),
          construtora: lead.tipo === "empresa" ? lead.nome_exibicao || lead.nome : "",
          bairro: obraBairro.trim(),
          contato_telefone: lead.telefone,
          origem: "levantamento",
          criado_por: profile?.id ?? null,
        })
        .select("id")
        .single();
      if (error || !data) {
        setSalvando(false);
        return setErro(`Não foi possível criar a obra${error?.message ? `: ${error.message}` : "."} Verifique se você pode cadastrar obras.`);
      }
      obra = data.id;
    }
    const id = await criarNegocio({
      lead_id: lead.id,
      obra_id: obra,
      etapa_id: etapa,
      valor_estimado: Number(valor) || 0,
      vendedor_id: vendedor || (isAdmin ? null : profile?.id ?? null),
    });
    setSalvando(false);
    if (id) {
      await recarregar();
      onCriado?.(id);
      onClose();
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-marinho-900/50 sm:items-center sm:p-4" onClick={onClose} aria-modal="true">
        <div className="flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-white shadow-cardhover sm:max-w-xl sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between px-6 pt-5">
            <div>
              <h3 className="text-lg font-semibold text-marinho-800">Novo negócio</h3>
              <p className="text-sm text-slate-500">Escolha o lead, a obra e onde ele entra no funil</p>
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <Field label="Lead *">
              <BuscaLead valor={lead} onChange={setLead} onCriarNovo={(nome) => setCriandoLead(nome)} />
            </Field>

            <div>
              <p className="mb-1.5 text-sm font-medium text-marinho-800">Obra (produto)</p>
              <div className="mb-2 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
                {(
                  [
                    ["nova", "Nova obra"],
                    ["existente", "Obra cadastrada"],
                    ["nenhuma", "Sem obra"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setObraModo(k)}
                    className={cx("rounded-md px-3 py-1 font-medium", obraModo === k ? "bg-white text-marinho-800 shadow-sm" : "text-slate-500")}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {obraModo === "nova" && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Input value={obraNome} onChange={(e) => setObraNome(e.target.value)} placeholder="Nome da obra / empreendimento" />
                  </div>
                  <Input value={obraBairro} onChange={(e) => setObraBairro(e.target.value)} placeholder="Bairro" />
                </div>
              )}
              {obraModo === "existente" &&
                (obraId ? (
                  (() => {
                    const o = obras.find((x) => x.id === obraId);
                    return (
                      <div className="flex items-center gap-3 rounded-xl border-2 border-aco-500 bg-aco-50 px-3 py-2.5">
                        <Building2 size={18} className="flex-shrink-0 text-aco-600" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-marinho-800">{o?.nome_obra ?? "Obra"}</p>
                          <p className="truncate text-xs text-slate-500">{[o?.construtora, o?.bairro].filter(Boolean).join(" · ") || "—"}</p>
                        </div>
                        <button type="button" onClick={() => { setObraId(""); setBuscaObra(""); }} className="text-sm font-semibold text-aco-600">
                          Trocar
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <Input
                      value={buscaObra}
                      onChange={(e) => { setBuscaObra(e.target.value); setObraAberta(true); }}
                      onFocus={() => setObraAberta(true)}
                      onBlur={() => setTimeout(() => setObraAberta(false), 150)}
                      placeholder="Pesquisar obra, construtora ou bairro..."
                      className="pl-9"
                    />
                    {obraAberta && (
                      <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-cardhover">
                        {/* obras vêm do contexto já ordenadas da mais recente para a mais antiga */}
                        {obras
                          .filter((o) => !buscaObra || `${o.nome_obra} ${o.construtora} ${o.bairro}`.toLowerCase().includes(buscaObra.toLowerCase()))
                          .slice(0, 8)
                          .map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setObraId(o.id); setObraAberta(false); }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
                            >
                              <Building2 size={15} className="flex-shrink-0 text-slate-400" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-marinho-800">{o.nome_obra}</span>
                                <span className="block truncate text-xs text-slate-500">{[o.construtora, o.bairro].filter(Boolean).join(" · ")}</span>
                              </span>
                            </button>
                          ))}
                        {obras.filter((o) => !buscaObra || `${o.nome_obra} ${o.construtora} ${o.bairro}`.toLowerCase().includes(buscaObra.toLowerCase())).length === 0 && (
                          <p className="px-3 py-3 text-center text-sm text-slate-400">Nenhuma obra encontrada.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {pipelines.length > 1 && (
                <Field label="Pipeline">
                  <Select
                    value={pid}
                    onChange={(e) => {
                      setPid(e.target.value);
                      const c = etapas.filter((x) => x.pipeline_id === e.target.value);
                      setEtapa(c.find((x) => x.tipo === "aberta")?.id ?? c[0]?.id ?? "");
                    }}
                  >
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Etapa">
                <Select value={etapa} onChange={(e) => setEtapa(e.target.value)}>
                  {colunas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Valor estimado (R$)">
                <Input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
              </Field>
              {isAdmin && (
                <Field label="Atendente responsável">
                  <Select value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
                    <option value="">Sem atendente</option>
                    {profile && <option value={profile.id}>{profile.nome} (eu)</option>}
                    {vendedores
                      .filter((v) => v.id !== profile?.id)
                      .map((v) => (
                        <option key={v.id} value={v.id}>{v.nome}</option>
                      ))}
                  </Select>
                </Field>
              )}
            </div>

            {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Criando..." : "Criar negócio"}</Button>
          </div>
        </div>
      </div>
      {criandoLead !== null && (
        <NovoLeadModal
          nomeInicial={criandoLead}
          onClose={() => setCriandoLead(null)}
          onCriado={(l) => setLead(l)}
        />
      )}
    </>
  );
}
