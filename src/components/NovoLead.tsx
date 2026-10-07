import { useMemo, useState } from "react";
import { Building2, User, X } from "lucide-react";
import { useData } from "@/lib/data";
import { Button, Field, Input, Select, Textarea } from "./ui";
import type { Lead, TipoLead } from "@/lib/types";
import { cx } from "@/lib/utils";

/** Campo de tags: digite e tecle Enter (ou vírgula) para adicionar. */
export function CampoTags({
  tags,
  onChange,
  sugestoes = [],
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  sugestoes?: string[];
}) {
  const { tagsConfig, corTag } = useData();
  const [txt, setTxt] = useState("");
  const [focado, setFocado] = useState(false);
  const add = (t: string) => {
    const v = t.trim();
    // usa a grafia da tag configurada, se existir
    const oficial = tagsConfig.find((c) => c.nome.toLowerCase() === v.toLowerCase())?.nome ?? v;
    if (oficial && !tags.includes(oficial)) onChange([...tags, oficial]);
    setTxt("");
  };
  const todas = Array.from(new Set([...tagsConfig.map((t) => t.nome), ...sugestoes]));
  const restantes = todas.filter((s) => !tags.includes(s) && s.toLowerCase().includes(txt.toLowerCase())).slice(0, 8);
  return (
    <div>
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-md border border-[#D7DBDF] bg-white px-2 py-1.5 focus-within:border-aco-500 focus-within:ring-2 focus-within:ring-aco-100">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: `${corTag(t)}1f`, color: corTag(t) }}
          >
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remover ${t}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(txt);
            }
            if (e.key === "Backspace" && !txt && tags.length) onChange(tags.slice(0, -1));
          }}
          onFocus={() => setFocado(true)}
          onBlur={() => {
            setTimeout(() => setFocado(false), 150);
            if (txt) add(txt);
          }}
          placeholder={tags.length ? "" : "Selecione ou digite as tags"}
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      {(txt || focado) && restantes.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {restantes.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
              className="rounded-full border px-2 py-0.5 text-xs hover:opacity-80"
              style={{ borderColor: `${corTag(s)}55`, color: corTag(s) }}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Telefone com a bandeira e o +55 na frente, como no CRM */
export function CampoTelefone({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-[#D7DBDF] focus-within:border-aco-500 focus-within:ring-2 focus-within:ring-aco-100">
      <span className="flex items-center gap-1 border-r border-[#D7DBDF] bg-slate-50 px-2.5 text-sm">🇧🇷</span>
      <span className="flex items-center pl-3 text-sm text-marinho-800">+55</span>
      <input
        inputMode="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="(98) 9 0000-0000"
        className="min-w-0 flex-1 border-0 bg-white px-2 py-2.5 text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  );
}

async function buscarCep(cep: string) {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (j.erro) return null;
    return { logradouro: j.logradouro ?? "", bairro: j.bairro ?? "", cidade: j.localidade ?? "", uf: j.uf ?? "" };
  } catch {
    return null;
  }
}

const titulo = (t: string) => t.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** Consulta pública da Receita (BrasilAPI) para preencher a empresa a partir do CNPJ. */
async function buscarCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
    if (!r.ok) return null;
    const j = await r.json();
    const tel = (j.ddd_telefone_1 ?? "").replace(/\D/g, "");
    return {
      nome: titulo(j.razao_social ?? ""),
      nome_exibicao: titulo(j.nome_fantasia ?? ""),
      telefone: tel.length >= 10 ? `(${tel.slice(0, 2)}) ${tel.slice(2, -4)}-${tel.slice(-4)}` : "",
      email: (j.email ?? "").toLowerCase(),
      cep: j.cep ?? "",
      logradouro: titulo(`${j.descricao_tipo_de_logradouro ?? ""} ${j.logradouro ?? ""}`.trim()),
      numero: j.numero ?? "",
      complemento: titulo(j.complemento ?? ""),
      bairro: titulo(j.bairro ?? ""),
      cidade: titulo(j.municipio ?? ""),
      uf: j.uf ?? "",
      data_referencia: j.data_inicio_atividade ?? "",
    };
  } catch {
    return null;
  }
}

/** Empresa da pessoa: escolhe uma existente ou digita o nome de uma nova (criada junto). */
function CampoEmpresa({
  empresas,
  empresaId,
  nomeNovo,
  onEscolher,
  onDigitar,
}: {
  empresas: Lead[];
  empresaId: string;
  nomeNovo: string;
  onEscolher: (id: string) => void;
  onDigitar: (nome: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const escolhida = empresas.find((e) => e.id === empresaId);
  const q = nomeNovo.toLowerCase();
  const lista = empresas.filter((e) => !q || `${e.nome} ${e.nome_exibicao}`.toLowerCase().includes(q)).slice(0, 6);
  if (escolhida)
    return (
      <div className="flex items-center justify-between rounded-md border border-[#D7DBDF] px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-marinho-800">
          <Building2 size={15} className="text-purple-600" /> {escolhida.nome_exibicao || escolhida.nome}
        </span>
        <button type="button" onClick={() => onEscolher("")} className="text-slate-400 hover:text-slate-700" aria-label="Trocar empresa">
          <X size={15} />
        </button>
      </div>
    );
  const exato = empresas.some((e) => e.nome.toLowerCase() === q || e.nome_exibicao.toLowerCase() === q);
  return (
    <div className="relative">
      <Input
        value={nomeNovo}
        onChange={(e) => {
          onDigitar(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder="Digite para buscar ou cadastrar a empresa"
      />
      {aberto && (lista.length > 0 || nomeNovo) && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-cardhover">
          {lista.map((e) => (
            <button
              key={e.id}
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => {
                onEscolher(e.id);
                onDigitar("");
                setAberto(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-marinho-800 hover:bg-slate-50"
            >
              <Building2 size={14} className="text-slate-400" /> {e.nome_exibicao || e.nome}
            </button>
          ))}
          {nomeNovo.trim() && !exato && (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-aco-600">
              “{nomeNovo.trim()}” será cadastrada como nova empresa
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function NovoLeadModal({
  tipoInicial = "empresa",
  empresaInicialId = null,
  nomeInicial = "",
  onClose,
  onCriado,
}: {
  tipoInicial?: TipoLead;
  empresaInicialId?: string | null;
  nomeInicial?: string;
  onClose: () => void;
  onCriado?: (lead: Lead, abrir: boolean) => void;
}) {
  const { leads, criarLead, atualizarLead, avisar, opcoesLista } = useData();
  const [tipo, setTipo] = useState<TipoLead>(tipoInicial);
  const [mais, setMais] = useState(false);
  // segmento padrão segue a lista de Configurações (Construtora quando existir)
  const segmentos = opcoesLista("segmento");
  const segPadrao = segmentos.find((x) => x.toLowerCase() === "construtora") ?? segmentos[0] ?? "";
  const [f, setF] = useState({
    nome: nomeInicial,
    nome_exibicao: "",
    telefone: "",
    email: "",
    documento: "",
    segmento: segPadrao,
    cargo: "",
    origem: "",
    data_referencia: "",
    instagram: "",
    site: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "São Luís",
    uf: "MA",
    notas: "",
  });
  const [tags, setTags] = useState<string[]>([]);
  const [empresaId, setEmpresaId] = useState<string>(empresaInicialId ?? "");
  const [empresaNova, setEmpresaNova] = useState("");
  const [contatoId, setContatoId] = useState<string>("");
  const [abrir, setAbrir] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cnpjMsg, setCnpjMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const empresas = useMemo(() => leads.filter((l) => l.tipo === "empresa"), [leads]);
  const pessoas = useMemo(() => leads.filter((l) => l.tipo === "pessoa"), [leads]);
  const todasTags = useMemo(() => Array.from(new Set(leads.flatMap((l) => l.tags ?? []))).sort(), [leads]);
  const empresa = tipo === "empresa";

  async function aoMudarCep(v: string) {
    set("cep", v);
    const end = await buscarCep(v);
    if (end) setF((s) => ({ ...s, ...Object.fromEntries(Object.entries(end).filter(([, x]) => x)) }));
  }

  async function aoMudarDocumento(v: string) {
    set("documento", v);
    if (!empresa) return;
    const d = v.replace(/\D/g, "");
    if (d.length !== 14) return setCnpjMsg(null);
    const ja = empresas.find((e) => e.documento.replace(/\D/g, "") === d);
    if (ja) return setCnpjMsg({ ok: false, texto: `Esse CNPJ já está cadastrado: ${ja.nome_exibicao || ja.nome}` });
    setCnpjMsg({ ok: true, texto: "Buscando dados na Receita..." });
    const dados = await buscarCnpj(d);
    if (!dados) return setCnpjMsg({ ok: false, texto: "CNPJ não encontrado — preencha os dados manualmente." });
    setF((s) => ({ ...s, ...Object.fromEntries(Object.entries(dados).filter(([, x]) => x)) }));
    setCnpjMsg({ ok: true, texto: "Dados preenchidos pela Receita. Confira e salve." });
  }

  async function salvar() {
    setErro(null);
    if (!f.nome.trim()) return setErro(empresa ? "Informe a razão social (ou digite o CNPJ)." : "Informe o nome.");
    setSalvando(true);
    // pessoa com empresa digitada que ainda não existe: cria a empresa antes
    let empresaFinal = empresaId;
    if (!empresa && !empresaFinal && empresaNova.trim()) {
      const existente = empresas.find((e) => [e.nome, e.nome_exibicao].some((n) => n.toLowerCase() === empresaNova.trim().toLowerCase()));
      if (existente) empresaFinal = existente.id;
      else {
        const nova = await criarLead({ tipo: "empresa", nome: empresaNova.trim(), segmento: segPadrao });
        if (nova) empresaFinal = nova.id;
      }
    }
    const lead = await criarLead({
      ...f,
      tipo,
      nome: f.nome.trim(),
      nome_exibicao: f.nome_exibicao.trim(),
      segmento: empresa ? f.segmento : "",
      data_referencia: f.data_referencia || null,
      tags,
      empresa_id: !empresa ? empresaFinal || null : null,
      contato_principal_id: empresa ? contatoId || null : null,
    });
    setSalvando(false);
    if (!lead) return;
    if (!empresa && empresaFinal) {
      const emp = empresas.find((e) => e.id === empresaFinal);
      if (!emp || !emp.contato_principal_id) atualizarLead(empresaFinal, { contato_principal_id: lead.id });
    }
    avisar(`Lead ${lead.nome} criado com sucesso`, "ok");
    onCriado?.(lead, abrir);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-marinho-900/50 sm:items-center sm:p-4" onClick={onClose} aria-modal="true">
      <div
        className="flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-white shadow-cardhover sm:max-w-2xl sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5">
          <div>
            <h3 className="text-lg font-semibold text-marinho-800">Novo lead</h3>
            <p className="text-sm text-slate-500">Criação rápida — complete os detalhes depois</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            {(["empresa", "pessoa"] as TipoLead[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTipo(t);
                  setErro(null);
                  setCnpjMsg(null);
                }}
                className={cx(
                  "flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition",
                  tipo === t ? "bg-white text-aco-600 shadow-sm" : "text-slate-500"
                )}
              >
                {t === "pessoa" ? <User size={15} /> : <Building2 size={15} />}
                {t === "pessoa" ? "Pessoa" : "Empresa"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {empresa ? (
            <>
              <Field label="CNPJ">
                <Input
                  autoFocus
                  inputMode="numeric"
                  value={f.documento}
                  onChange={(e) => aoMudarDocumento(e.target.value)}
                  placeholder="Digite o CNPJ e o resto é preenchido sozinho"
                />
              </Field>
              {cnpjMsg && (
                <p className={cx("-mt-2 text-xs", cnpjMsg.ok ? "text-green-700" : "text-amber-700")}>{cnpjMsg.texto}</p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Razão social *">
                  <Input value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Mota Machado Construções Ltda" />
                </Field>
                <Field label="Nome fantasia">
                  <Input value={f.nome_exibicao} onChange={(e) => set("nome_exibicao", e.target.value)} placeholder="Ex.: Mota Machado" />
                </Field>
              </div>
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome *">
                <Input autoFocus value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome da pessoa" />
              </Field>
              <Field label="Cargo">
                <Input value={f.cargo} onChange={(e) => set("cargo", e.target.value)} placeholder="Engenheiro, comprador, mestre de obras..." />
              </Field>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefone / WhatsApp">
              <CampoTelefone value={f.telefone} onChange={(v) => set("telefone", v)} />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="E-mail" />
            </Field>
          </div>

          {empresa ? (
            <Field label="Segmento">
              <Select value={f.segmento} onChange={(e) => set("segmento", e.target.value)}>
                <option value="">Selecione o segmento</option>
                {opcoesLista("segmento").map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Empresa">
              <CampoEmpresa
                empresas={empresas}
                empresaId={empresaId}
                nomeNovo={empresaNova}
                onEscolher={setEmpresaId}
                onDigitar={setEmpresaNova}
              />
            </Field>
          )}

          {/* Opcionais */}
          <div className="rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setMais((m) => !m)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-marinho-800"
            >
              Mais informações <span className="text-slate-400">{mais ? "−" : "+"} tags, origem, endereço, notas</span>
            </button>
            {mais && (
              <div className="space-y-4 border-t border-slate-100 p-4">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-marinho-800">Tags</p>
                  <CampoTags tags={tags} onChange={setTags} sugestoes={todasTags} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Origem">
                    <Select value={f.origem} onChange={(e) => set("origem", e.target.value)}>
                      <option value="">Selecione a origem</option>
                      {opcoesLista("origem").map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Instagram">
                    <Input value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@perfil" />
                  </Field>
                  {empresa ? (
                    <>
                      <Field label="Site">
                        <Input value={f.site} onChange={(e) => set("site", e.target.value)} placeholder="www.empresa.com.br" />
                      </Field>
                      <Field label="Data de fundação">
                        <Input type="date" value={f.data_referencia} onChange={(e) => set("data_referencia", e.target.value)} />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Contato principal">
                          <Select value={contatoId} onChange={(e) => setContatoId(e.target.value)}>
                            <option value="">Nenhum contato principal definido</option>
                            {pessoas.map((p) => (
                              <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                    </>
                  ) : (
                    <>
                      <Field label="CPF">
                        <Input inputMode="numeric" value={f.documento} onChange={(e) => set("documento", e.target.value)} />
                      </Field>
                      <Field label="Data de nascimento">
                        <Input type="date" value={f.data_referencia} onChange={(e) => set("data_referencia", e.target.value)} />
                      </Field>
                    </>
                  )}
                </div>
                <p className="pt-1 text-sm font-medium text-marinho-800">Endereço</p>
                <div className="grid gap-3 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <Input inputMode="numeric" value={f.cep} onChange={(e) => aoMudarCep(e.target.value)} placeholder="CEP" />
                  </div>
                  <div className="sm:col-span-3">
                    <Input value={f.logradouro} onChange={(e) => set("logradouro", e.target.value)} placeholder="Rua, avenida..." />
                  </div>
                  <div className="sm:col-span-1">
                    <Input value={f.numero} onChange={(e) => set("numero", e.target.value)} placeholder="Nº" />
                  </div>
                  <div className="sm:col-span-3">
                    <Input value={f.bairro} onChange={(e) => set("bairro", e.target.value)} placeholder="Bairro" />
                  </div>
                  <div className="sm:col-span-2">
                    <Input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Cidade" />
                  </div>
                  <div className="sm:col-span-1">
                    <Input value={f.uf} maxLength={2} onChange={(e) => set("uf", e.target.value.toUpperCase())} placeholder="UF" />
                  </div>
                </div>
                <Field label="Notas">
                  <Textarea value={f.notas} onChange={(e) => set("notas", e.target.value)} className="min-h-[70px]" />
                </Field>
              </div>
            )}
          </div>

          {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4">
          <label className="mr-auto flex cursor-pointer items-center gap-2 text-sm text-marinho-800">
            <input type="checkbox" checked={abrir} onChange={(e) => setAbrir(e.target.checked)} className="h-4 w-4 accent-[#3385FF]" />
            Abrir após criar
          </label>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Criando..." : "Criar lead"}</Button>
        </div>
      </div>
    </div>
  );
}
