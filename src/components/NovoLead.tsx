import { useMemo, useState } from "react";
import { Building2, User, X } from "lucide-react";
import { useData } from "@/lib/data";
import { Button, Field, Input, Select, Textarea } from "./ui";
import { ORIGENS, SEGMENTOS, type Lead, type TipoLead } from "@/lib/types";
import { cx } from "@/lib/utils";

type Aba = "dados" | "endereco" | "notas";

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
  const [txt, setTxt] = useState("");
  const add = (t: string) => {
    const v = t.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setTxt("");
  };
  const restantes = sugestoes.filter((s) => !tags.includes(s) && s.toLowerCase().includes(txt.toLowerCase())).slice(0, 6);
  return (
    <div>
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-md border border-[#D7DBDF] bg-white px-2 py-1.5 focus-within:border-aco-500 focus-within:ring-2 focus-within:ring-aco-100">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-aco-50 px-2 py-0.5 text-xs font-medium text-aco-700">
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
          onBlur={() => txt && add(txt)}
          placeholder={tags.length ? "" : "Selecione ou digite as tags"}
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      {txt && restantes.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {restantes.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
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
  const { leads, criarLead, atualizarLead, avisar } = useData();
  const [tipo, setTipo] = useState<TipoLead>(tipoInicial);
  const [aba, setAba] = useState<Aba>("dados");
  const [f, setF] = useState({
    nome: nomeInicial,
    nome_exibicao: "",
    telefone: "",
    email: "",
    documento: "",
    segmento: tipoInicial === "empresa" ? "Construtora" : "",
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
  const [contatoId, setContatoId] = useState<string>("");
  const [abrir, setAbrir] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const empresas = useMemo(() => leads.filter((l) => l.tipo === "empresa"), [leads]);
  const pessoas = useMemo(() => leads.filter((l) => l.tipo === "pessoa"), [leads]);
  const todasTags = useMemo(() => Array.from(new Set(leads.flatMap((l) => l.tags ?? []))).sort(), [leads]);

  async function aoMudarCep(v: string) {
    set("cep", v);
    const end = await buscarCep(v);
    if (end) setF((s) => ({ ...s, ...Object.fromEntries(Object.entries(end).filter(([, x]) => x)) }));
  }

  async function salvar() {
    setErro(null);
    if (!f.nome.trim()) {
      setAba("dados");
      return setErro(tipo === "empresa" ? "Informe a razão social." : "Informe o nome do lead.");
    }
    setSalvando(true);
    const lead = await criarLead({
      ...f,
      tipo,
      nome: f.nome.trim(),
      nome_exibicao: f.nome_exibicao.trim(),
      data_referencia: f.data_referencia || null,
      tags,
      empresa_id: tipo === "pessoa" ? empresaId || null : null,
      contato_principal_id: tipo === "empresa" ? contatoId || null : null,
    });
    setSalvando(false);
    if (!lead) return;
    // empresa recém-ligada a uma pessoa: se ainda não tem contato principal, vira ela
    if (tipo === "pessoa" && empresaId) {
      const emp = empresas.find((e) => e.id === empresaId);
      if (emp && !emp.contato_principal_id) atualizarLead(emp.id, { contato_principal_id: lead.id });
    }
    avisar(`Lead ${lead.nome} criado com sucesso`, "ok");
    onCriado?.(lead, abrir);
    onClose();
  }

  const empresa = tipo === "empresa";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-marinho-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-white shadow-cardhover sm:max-w-3xl sm:rounded-lg"
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
            {(["pessoa", "empresa"] as TipoLead[]).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
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
          <div className="mt-4 inline-flex rounded-lg bg-slate-100 p-1">
            {(
              [
                ["dados", "Dados Pessoais"],
                ["endereco", "Endereço"],
                ["notas", "Notas"],
              ] as [Aba, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setAba(k)}
                className={cx(
                  "rounded-md px-3.5 py-1.5 text-sm font-medium",
                  aba === k ? "bg-white text-marinho-800 shadow-sm" : "text-slate-500"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {aba === "dados" && (
            <>
              <Field label={empresa ? "Razão social *" : "Nome *"}>
                <Input
                  autoFocus
                  value={f.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  placeholder={empresa ? "Ex.: Mota Machado Construções Ltda" : "Informe o nome do lead"}
                />
              </Field>
              <Field label={empresa ? "Nome fantasia" : "Nome de exibição"}>
                <Input
                  value={f.nome_exibicao}
                  onChange={(e) => set("nome_exibicao", e.target.value)}
                  placeholder={empresa ? "Ex.: Mota Machado" : "Nome de exibição do lead"}
                />
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-medium text-marinho-800">Tags</p>
                <CampoTags tags={tags} onChange={setTags} sugestoes={todasTags} />
              </div>

              <p className="pt-1 font-semibold text-marinho-800">Contatos</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telefone">
                  <CampoTelefone value={f.telefone} onChange={(v) => set("telefone", v)} />
                </Field>
                <Field label="E-mail">
                  <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="E-mail" />
                </Field>
              </div>
              {empresa ? (
                <Field label="Contato principal">
                  <Select value={contatoId} onChange={(e) => setContatoId(e.target.value)}>
                    <option value="">Nenhum contato principal definido</option>
                    {pessoas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field label="Empresa associada">
                  <Select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                    <option value="">Buscar empresa...</option>
                    {empresas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome_exibicao || p.nome}</option>
                    ))}
                  </Select>
                </Field>
              )}

              <p className="pt-1 font-semibold text-marinho-800">Dados adicionais</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {!empresa && (
                  <Field label="Data de nascimento">
                    <Input type="date" value={f.data_referencia} onChange={(e) => set("data_referencia", e.target.value)} />
                  </Field>
                )}
                <Field label="Documento">
                  <Input value={f.documento} onChange={(e) => set("documento", e.target.value)} placeholder="Informe o CPF ou CNPJ" />
                </Field>
                {empresa ? (
                  <Field label="Segmento">
                    <Select value={f.segmento} onChange={(e) => set("segmento", e.target.value)}>
                      <option value="">Selecione o segmento</option>
                      {SEGMENTOS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <Field label="Cargo">
                    <Input value={f.cargo} onChange={(e) => set("cargo", e.target.value)} placeholder="Ex.: Engenheiro, Comprador" />
                  </Field>
                )}
                {empresa && (
                  <Field label="Data de fundação">
                    <Input type="date" value={f.data_referencia} onChange={(e) => set("data_referencia", e.target.value)} />
                  </Field>
                )}
                <Field label="Origem">
                  <Select value={f.origem} onChange={(e) => set("origem", e.target.value)}>
                    <option value="">Selecione a origem</option>
                    {ORIGENS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Instagram">
                  <Input value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@perfil ou link" />
                </Field>
                {empresa && (
                  <Field label="Site">
                    <Input value={f.site} onChange={(e) => set("site", e.target.value)} placeholder="www.empresa.com.br" />
                  </Field>
                )}
              </div>
            </>
          )}

          {aba === "endereco" && (
            <div className="grid gap-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <Field label="CEP">
                  <Input inputMode="numeric" value={f.cep} onChange={(e) => aoMudarCep(e.target.value)} placeholder="00000-000" />
                </Field>
              </div>
              <div className="sm:col-span-4">
                <Field label="Logradouro">
                  <Input value={f.logradouro} onChange={(e) => set("logradouro", e.target.value)} placeholder="Rua, avenida..." />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Número">
                  <Input value={f.numero} onChange={(e) => set("numero", e.target.value)} />
                </Field>
              </div>
              <div className="sm:col-span-4">
                <Field label="Complemento">
                  <Input value={f.complemento} onChange={(e) => set("complemento", e.target.value)} />
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field label="Bairro">
                  <Input value={f.bairro} onChange={(e) => set("bairro", e.target.value)} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Cidade">
                  <Input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} />
                </Field>
              </div>
              <div className="sm:col-span-1">
                <Field label="UF">
                  <Input value={f.uf} maxLength={2} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
                </Field>
              </div>
            </div>
          )}

          {aba === "notas" && (
            <Field label="Notas">
              <Textarea
                value={f.notas}
                onChange={(e) => set("notas", e.target.value)}
                className="min-h-[180px]"
                placeholder="Como chegou até nós, histórico, observações..."
              />
            </Field>
          )}

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
