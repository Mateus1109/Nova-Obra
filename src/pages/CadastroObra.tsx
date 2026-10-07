import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, MapPin, CheckCircle2 } from "lucide-react";
import { useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { extrairCoords } from "@/lib/utils";
import { FASE_OBRA, type Classificacao, type Obra } from "@/lib/types";

const vazio = {
  nome_obra: "",
  construtora: "",
  tipo: "vertical",
  status_obra: "lancamento",
  bairro: "",
  cidade: "São Luís",
  uf: "MA",
  endereco: "",
  latitude: "" as string | number,
  longitude: "" as string | number,
  produto_alvo: "concreto_usinado",
  volume_estimado_m3: "",
  contato_nome: "",
  contato_cargo: "",
  contato_telefone: "",
  contato_email: "",
  origem: "levantamento",
  observacoes: "",
  fase_obra: "",
  previsao_concretagem: "",
  pavimentos: "",
  area_m2: "",
  fornecedor_atual: "",
};

export default function CadastroObra() {
  const { criarObra, vendedores } = useData();
  const { profile, isAdmin } = useAuth();
  const nav = useNavigate();

  const [f, setF] = useState({ ...vazio });
  const [linkMaps, setLinkMaps] = useState("");
  const [vendedorId, setVendedorId] = useState(isAdmin ? "" : profile?.id ?? "");
  const [valor, setValor] = useState("");
  const [classificacao, setClassificacao] = useState<Classificacao>("frio");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const set = (k: string, v: string | number) => setF((s) => ({ ...s, [k]: v }));

  function aplicarLink() {
    const c = extrairCoords(linkMaps);
    if (c) {
      set("latitude", c.lat);
      set("longitude", c.lng);
      setErro(null);
    } else setErro("Não foi possível extrair coordenadas desse link. Cole lat/long manualmente.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!f.nome_obra || !f.bairro) { setErro("Preencha pelo menos nome da obra e bairro."); return; }
    setSalvando(true);
    const payload: Partial<Obra> = {
      ...f,
      latitude: f.latitude === "" ? null : Number(f.latitude),
      longitude: f.longitude === "" ? null : Number(f.longitude),
      volume_estimado_m3: Number(f.volume_estimado_m3) || 0,
      fase_obra: f.fase_obra || null,
      previsao_concretagem: f.previsao_concretagem || null,
      pavimentos: f.pavimentos === "" ? null : Number(f.pavimentos),
      area_m2: f.area_m2 === "" ? null : Number(f.area_m2),
      fornecedor_atual: f.fornecedor_atual.trim(),
    } as Partial<Obra>;
    const { error } = await criarObra(payload, vendedorId, Number(valor) || 0, classificacao);
    setSalvando(false);
    if (error) { setErro(error); return; }
    setOk(true);
    setTimeout(() => nav("/"), 1100);
  }

  if (ok)
    return (
      <div className="grid place-items-center py-20">
        <Card className="flex flex-col items-center p-10 text-center">
          <CheckCircle2 className="text-green-500" size={52} />
          <h2 className="mt-3 text-xl font-black text-marinho-800">Obra cadastrada!</h2>
          <p className="mt-1 text-sm text-slate-500">
            Uma oportunidade foi criada na etapa <b>Qualificação</b>.
          </p>
        </Card>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-aco-50 text-aco-600">
          <Building2 size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-marinho-800">Cadastrar nova obra</h1>
          <p className="text-sm text-slate-500">Ao salvar, criamos a oportunidade no funil automaticamente.</p>
        </div>
      </header>

      <form onSubmit={submit} className="space-y-5">
        <Card className="space-y-4 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Identificação</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da obra *">
              <Input value={f.nome_obra} onChange={(e) => set("nome_obra", e.target.value)} required />
            </Field>
            <Field label="Construtora">
              <Input value={f.construtora} onChange={(e) => set("construtora", e.target.value)} />
            </Field>
            <Field label="Tipo">
              <Select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
                <option value="vertical">Vertical</option>
                <option value="condominio">Condomínio</option>
                <option value="comercial">Comercial</option>
                <option value="galpao">Galpão</option>
                <option value="publica">Pública</option>
              </Select>
            </Field>
            <Field label="Status da obra (foco em concreto)">
              <Select value={f.status_obra} onChange={(e) => set("status_obra", e.target.value)}>
                <option value="lancamento">Lançamento</option>
                <option value="em_andamento">Em andamento</option>
              </Select>
            </Field>
            <Field label="Produto-alvo">
              <Select value={f.produto_alvo} onChange={(e) => set("produto_alvo", e.target.value)}>
                <option value="concreto_usinado">Concreto usinado</option>
                <option value="bombeado">Bombeado</option>
                <option value="bomba_lanca">Bomba lança</option>
                <option value="locacao_bomba">Locação de bomba</option>
              </Select>
            </Field>
            <Field label="Volume estimado (m³)">
              <Input type="number" value={f.volume_estimado_m3} onChange={(e) => set("volume_estimado_m3", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Andamento da obra</p>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-marinho-800">Fase atual</p>
            <div className="flex flex-wrap gap-1.5">
              {FASE_OBRA.map((fa) => (
                <button
                  key={fa.key}
                  type="button"
                  onClick={() => set("fase_obra", f.fase_obra === fa.key ? "" : fa.key)}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition " +
                    (f.fase_obra === fa.key
                      ? "border-marinho-700 bg-marinho-700 text-white"
                      : "border-slate-200 bg-white text-slate-600")
                  }
                >
                  {fa.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Concretagem prevista">
              <Input type="date" value={f.previsao_concretagem} onChange={(e) => set("previsao_concretagem", e.target.value)} />
            </Field>
            <Field label="Fornecedor atual de concreto">
              <Input value={f.fornecedor_atual} onChange={(e) => set("fornecedor_atual", e.target.value)} placeholder="Concorrente que atende hoje" />
            </Field>
            <Field label="Pavimentos">
              <Input type="number" value={f.pavimentos} onChange={(e) => set("pavimentos", e.target.value)} />
            </Field>
            <Field label="Área construída (m²)">
              <Input type="number" value={f.area_m2} onChange={(e) => set("area_m2", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Localização</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Bairro *">
              <Input value={f.bairro} onChange={(e) => set("bairro", e.target.value)} required />
            </Field>
            <Field label="Cidade">
              <Input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} />
            </Field>
            <Field label="UF">
              <Input value={f.uf} onChange={(e) => set("uf", e.target.value)} maxLength={2} />
            </Field>
          </div>
          <Field label="Endereço">
            <Input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} />
          </Field>

          <div className="rounded-xl bg-aco-50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-aco-600">
              <MapPin size={15} /> Coordenadas (para a rota no Maps)
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Cole o link do Google Maps aqui..."
                value={linkMaps}
                onChange={(e) => setLinkMaps(e.target.value)}
              />
              <Button type="button" variant="secondary" onClick={aplicarLink}>Extrair</Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input placeholder="Latitude" value={f.latitude} onChange={(e) => set("latitude", e.target.value)} />
              <Input placeholder="Longitude" value={f.longitude} onChange={(e) => set("longitude", e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Contato na obra</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome"><Input value={f.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} /></Field>
            <Field label="Cargo"><Input value={f.contato_cargo} onChange={(e) => set("contato_cargo", e.target.value)} /></Field>
            <Field label="Telefone"><Input value={f.contato_telefone} onChange={(e) => set("contato_telefone", e.target.value)} /></Field>
            <Field label="E-mail"><Input type="email" value={f.contato_email} onChange={(e) => set("contato_email", e.target.value)} /></Field>
          </div>
          <Field label="Origem">
            <Select value={f.origem} onChange={(e) => set("origem", e.target.value)}>
              <option value="levantamento">Levantamento de obra</option>
              <option value="indicacao">Indicação</option>
              <option value="licitacao">Licitação</option>
              <option value="outro">Outro</option>
            </Select>
          </Field>
          <Field label="Observações">
            <Textarea value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </Field>
        </Card>

        <Card className="space-y-4 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Atribuição no funil</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Vendedor responsável">
              <Select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} disabled={!isAdmin}>
                {isAdmin && <option value="">Selecione...</option>}
                {vendedores.map((v) => (<option key={v.id} value={v.id}>{v.nome}</option>))}
                {!isAdmin && profile && <option value={profile.id}>{profile.nome}</option>}
              </Select>
            </Field>
            <Field label="Valor estimado (R$)">
              <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
            </Field>
            <Field label="Classificação inicial">
              <Select value={classificacao} onChange={(e) => setClassificacao(e.target.value as Classificacao)}>
                <option value="frio">Frio</option>
                <option value="morno">Morno</option>
                <option value="quente">Quente</option>
              </Select>
            </Field>
          </div>
        </Card>

        {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erro}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={() => nav("/")}>Cancelar</Button>
          <Button type="submit" size="lg" className="flex-1" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar obra"}
          </Button>
        </div>
      </form>
    </div>
  );
}
