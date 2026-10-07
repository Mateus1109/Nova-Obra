import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Plus,
  Camera,
  X,
  MapPin,
  Navigation,
  Download,
  ImageIcon,
  Send,
  Trash2,
  Search,
  LocateFixed,
  CheckCircle2,
  Handshake,
  Building2,
  Images,
  Trophy,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BUCKET_FOTOS, useUrls } from "@/lib/fotos";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import {
  CLASSIFICACOES,
  FASE_LABEL,
  FASE_OBRA,
  PRODUTO_LABEL,
  RESULTADO_VISITA,
  TIPO_RELATORIO,
  type Classificacao,
  type FaseObra,
  type Obra,
  type ProdutoAlvo,
  type RelatorioVisita,
  type ResultadoVisita,
  type TipoRelatorio,
} from "@/lib/types";
import { comprimirImagem, cx, dataBR, hojeISO, isoLocal, mapsLink } from "@/lib/utils";

const BUCKET = BUCKET_FOTOS;
const MAX_FOTOS = 10;

/* ---------- Página ---------- */

type Periodo = "7" | "30" | "mes" | "todos";

export default function Relatorios() {
  const { profile, isAdmin } = useAuth();
  const { vendedores, obras } = useData();
  const loc = useLocation();
  const nav = useNavigate();

  const [lista, setLista] = useState<RelatorioVisita[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState<{ obra?: Obra } | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [limite, setLimite] = useState(30);

  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [fVendedor, setFVendedor] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fResultado, setFResultado] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("relatorios_visita")
      .select("*, vendedor:profiles(nome)")
      .order("data_visita", { ascending: false })
      .order("criado_em", { ascending: false })
      .limit(2000);
    setLista((data as RelatorioVisita[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("relatorios-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "relatorios_visita" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [carregar]);

  // Atalho vindo de "Visitas do dia": /relatorios?obra=<id>
  useEffect(() => {
    const obraId = new URLSearchParams(loc.search).get("obra");
    if (!obraId || !obras.length) return;
    const obra = obras.find((o) => o.id === obraId);
    setNovo({ obra });
    nav("/relatorios", { replace: true });
  }, [loc.search, obras, nav]);

  const desde = useMemo(() => {
    const d = new Date();
    if (periodo === "7") d.setDate(d.getDate() - 6);
    else if (periodo === "30") d.setDate(d.getDate() - 29);
    else if (periodo === "mes") d.setDate(1);
    else return "";
    return isoLocal(d);
  }, [periodo]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return lista.filter((r) => {
      if (desde && r.data_visita < desde) return false;
      if (fVendedor && r.vendedor_id !== fVendedor) return false;
      if (fTipo && r.tipo !== fTipo) return false;
      if (fResultado && r.resultado !== fResultado) return false;
      if (q && !`${r.nome_obra} ${r.construtora} ${r.bairro} ${r.contato_nome}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [lista, desde, fVendedor, fTipo, fResultado, busca]);

  const kpi = useMemo(() => {
    const clientes = filtrados.filter((r) => r.tipo === "cliente").length;
    return {
      total: filtrados.length,
      clientes,
      aquisicao: filtrados.length - clientes,
      pedidos: filtrados.filter((r) => r.resultado === "pedido_fechado").length,
      propostas: filtrados.filter((r) => r.resultado === "proposta_solicitada").length,
      fotos: filtrados.reduce((s, r) => s + (r.fotos?.length ?? 0), 0),
    };
  }, [filtrados]);

  const ranking = useMemo(() => {
    if (!isAdmin) return [];
    return vendedores
      .map((v) => {
        const meus = filtrados.filter((r) => r.vendedor_id === v.id);
        return {
          id: v.id,
          nome: v.nome,
          total: meus.length,
          clientes: meus.filter((r) => r.tipo === "cliente").length,
          aquisicao: meus.filter((r) => r.tipo === "aquisicao").length,
          pedidos: meus.filter((r) => r.resultado === "pedido_fechado").length,
          ultimo: meus[0]?.data_visita ?? null,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [isAdmin, vendedores, filtrados]);

  const visiveis = filtrados.slice(0, limite);
  const thumbs = useUrls(visiveis.map((r) => r.fotos?.[0]).filter(Boolean) as string[]);
  const detalhe = detalheId ? lista.find((r) => r.id === detalheId) ?? null : null;

  if (loading) return <Spinner />;

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-marinho-800">Relatórios de visita</h1>
          <p className="text-sm text-slate-500">
            {isAdmin ? "Gestão das visitas da equipe comercial" : "Registre cada visita com fotos e resultado"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filtrados.length > 0 && (
            <Button variant="secondary" onClick={() => exportarCSV(filtrados)}>
              <Download size={16} /> Exportar planilha
            </Button>
          )}
          <Button size="lg" onClick={() => setNovo({})}>
            <Plus size={18} /> Registrar visita
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Visitas" valor={kpi.total} cor="#173A5E" icon={<ClipboardList size={18} />} />
        <Kpi label="Clientes" valor={kpi.clientes} cor="#16a34a" icon={<Handshake size={18} />} />
        <Kpi label="Novas obras" valor={kpi.aquisicao} cor="#2E78A8" icon={<Building2 size={18} />} />
        <Kpi label="Pedidos fechados" valor={kpi.pedidos} cor="#f59e0b" icon={<Trophy size={18} />} />
        <Kpi label="Propostas" valor={kpi.propostas} cor="#7c3aed" icon={<Send size={18} />} />
        <Kpi label="Fotos" valor={kpi.fotos} cor="#64748b" icon={<Images size={18} />} />
      </div>

      {/* Filtros */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            placeholder="Buscar obra, construtora, bairro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="mes">Este mês</option>
          <option value="todos">Todo o período</option>
        </Select>
        {isAdmin && (
          <Select value={fVendedor} onChange={(e) => setFVendedor(e.target.value)}>
            <option value="">Todos vendedores</option>
            {vendedores.map((v) => (<option key={v.id} value={v.id}>{v.nome}</option>))}
          </Select>
        )}
        <Select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
          <option value="">Cliente e nova obra</option>
          <option value="cliente">Só clientes</option>
          <option value="aquisicao">Só aquisição de obra</option>
        </Select>
        <Select value={fResultado} onChange={(e) => setFResultado(e.target.value)}>
          <option value="">Todo resultado</option>
          {(Object.keys(RESULTADO_VISITA) as ResultadoVisita[]).map((k) => (
            <option key={k} value={k}>{RESULTADO_VISITA[k].label}</option>
          ))}
        </Select>
      </div>

      {/* Ranking por vendedor (diretor) */}
      {isAdmin && ranking.length > 0 && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <Trophy size={17} className="text-amber-500" />
            <h3 className="font-bold text-marinho-800">Desempenho por vendedor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2">Vendedor</th>
                  <th className="px-3 py-2 text-center">Visitas</th>
                  <th className="px-3 py-2 text-center">Clientes</th>
                  <th className="px-3 py-2 text-center">Novas obras</th>
                  <th className="px-3 py-2 text-center">Pedidos</th>
                  <th className="px-4 py-2 text-right">Último relatório</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranking.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setFVendedor(fVendedor === r.id ? "" : r.id)}
                  >
                    <td className="px-4 py-2.5 font-semibold text-marinho-800">{r.nome}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-marinho-700">{r.total}</td>
                    <td className="px-3 py-2.5 text-center">{r.clientes}</td>
                    <td className="px-3 py-2.5 text-center">{r.aquisicao}</td>
                    <td className="px-3 py-2.5 text-center">{r.pedidos}</td>
                    <td
                      className={cx(
                        "px-4 py-2.5 text-right",
                        !r.ultimo ? "font-semibold text-red-600" : "text-slate-500"
                      )}
                    >
                      {r.ultimo ? dataBR(r.ultimo) : "Sem relatório"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Lista */}
      {filtrados.length === 0 ? (
        <Empty
          icon={<ClipboardList size={40} />}
          titulo="Nenhum relatório no período"
          texto="Toque em “Registrar visita” logo após cada visita: tire as fotos, escolha a obra e o resultado — leva menos de um minuto."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visiveis.map((r) => {
              const tp = TIPO_RELATORIO[r.tipo];
              const rs = RESULTADO_VISITA[r.resultado];
              const thumb = r.fotos?.[0] ? thumbs[r.fotos[0]] : undefined;
              return (
                <button
                  key={r.id}
                  onClick={() => setDetalheId(r.id)}
                  className="flex overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-card transition hover:shadow-cardhover"
                >
                  <div className="relative h-auto w-28 flex-shrink-0 bg-slate-100">
                    {thumb ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-slate-300">
                        <ImageIcon size={28} />
                      </div>
                    )}
                    {r.fotos?.length > 1 && (
                      <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        +{r.fotos.length - 1}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-bold text-marinho-800">{r.nome_obra}</p>
                      <span
                        className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        title={`Interesse ${CLASSIFICACOES[r.interesse].label}`}
                        style={{ background: CLASSIFICACOES[r.interesse].fg }}
                      />
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {[r.construtora, r.bairro].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge bg={tp.bg} fg={tp.fg}>{tp.curto}</Badge>
                      <Badge bg={rs.bg} fg={rs.fg}>{rs.label}</Badge>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-slate-400">
                      {dataBR(r.data_visita)}
                      {isAdmin && r.vendedor?.nome ? ` · ${r.vendedor.nome}` : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {filtrados.length > limite && (
            <div className="mt-4 text-center">
              <Button variant="ghost" onClick={() => setLimite((l) => l + 30)}>
                Mostrar mais ({filtrados.length - limite} restantes)
              </Button>
            </div>
          )}
        </>
      )}

      {novo && (
        <NovoRelatorio
          obraInicial={novo.obra}
          onClose={() => setNovo(null)}
          onSalvo={() => {
            setNovo(null);
            carregar();
          }}
        />
      )}

      {detalhe && (
        <DetalheRelatorio
          r={detalhe}
          podeExcluir={isAdmin || detalhe.vendedor_id === profile?.id}
          onClose={() => setDetalheId(null)}
          onAlterado={carregar}
        />
      )}
    </div>
  );
}

function Kpi({ label, valor, cor, icon }: { label: string; valor: number; cor: string; icon: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl text-white" style={{ background: cor }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-black leading-tight text-marinho-800">{valor}</p>
        <p className="truncate text-[11px] font-semibold text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

/* ---------- Novo relatório (rápido, pensado para o celular na obra) ---------- */

interface FotoLocal {
  blob: Blob;
  preview: string;
}

type Gps = "buscando" | "ok" | "erro" | "manual";

function Chip({
  ativo,
  onClick,
  children,
  cor,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  cor?: { bg: string; fg: string };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full border-2 px-3.5 py-2 text-sm font-bold transition active:scale-[.97]",
        ativo ? "border-marinho-700 shadow-sm" : "border-transparent",
        !cor && (ativo ? "bg-marinho-700 text-white" : "bg-slate-100 text-slate-600")
      )}
      style={cor ? { background: cor.bg, color: cor.fg } : undefined}
    >
      {children}
    </button>
  );
}

function NovoRelatorio({
  obraInicial,
  onClose,
  onSalvo,
}: {
  obraInicial?: Obra;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const { session, profile, isAdmin } = useAuth();
  const { obras, vendedores } = useData();

  const [tipo, setTipo] = useState<TipoRelatorio>(obraInicial ? "cliente" : "aquisicao");
  const [vendedorId, setVendedorId] = useState(isAdmin ? "" : profile?.id ?? "");
  const [obraId, setObraId] = useState(obraInicial?.id ?? "");
  const [nomeObra, setNomeObra] = useState("");
  const [construtora, setConstrutora] = useState("");
  const [bairro, setBairro] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gps, setGps] = useState<Gps>("buscando");
  const [fase, setFase] = useState<FaseObra | "">(obraInicial?.fase_obra ?? "");
  const [resultado, setResultado] = useState<ResultadoVisita>("em_negociacao");
  const [interesse, setInteresse] = useState<Classificacao>("morno");
  const [noFunil, setNoFunil] = useState(true);
  const [mais, setMais] = useState(false);
  const [contato, setContato] = useState(obraInicial?.contato_nome ?? "");
  const [telefone, setTelefone] = useState(obraInicial?.contato_telefone ?? "");
  const [volume, setVolume] = useState("");
  const [fornecedor, setFornecedor] = useState(obraInicial?.fornecedor_atual ?? "");
  const [observacao, setObservacao] = useState("");
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const obraVinculada = obras.find((o) => o.id === obraId);
  const obrasOrdenadas = useMemo(
    () => [...obras].sort((a, b) => a.nome_obra.localeCompare(b.nome_obra)),
    [obras]
  );

  // Localização capturada sozinha ao abrir (comprova que o vendedor esteve na obra)
  useEffect(() => {
    if (!navigator.geolocation) return setGps("erro");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
        setGps("ok");
      },
      () => setGps("erro"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => () => fotos.forEach((x) => URL.revokeObjectURL(x.preview)), []); // eslint-disable-line

  function escolherObra(id: string) {
    setObraId(id);
    const o = obras.find((x) => x.id === id);
    if (!o) return;
    if (o.fase_obra) setFase(o.fase_obra);
    setContato(o.contato_nome ?? "");
    setTelefone(o.contato_telefone ?? "");
    setFornecedor(o.fornecedor_atual ?? "");
  }

  async function adicionarFotos(lista: FileList | null) {
    if (!lista?.length) return;
    const espaco = MAX_FOTOS - fotos.length;
    const novas: FotoLocal[] = [];
    for (const arq of Array.from(lista).slice(0, espaco)) {
      const blob = await comprimirImagem(arq);
      novas.push({ blob, preview: URL.createObjectURL(blob) });
    }
    setFotos((fs) => [...fs, ...novas]);
    if (lista.length > espaco) setErro(`Máximo de ${MAX_FOTOS} fotos por relatório.`);
  }

  function removerFoto(i: number) {
    setFotos((fs) => {
      URL.revokeObjectURL(fs[i].preview);
      return fs.filter((_, j) => j !== i);
    });
  }

  async function salvar() {
    setErro(null);
    const uid = session?.user.id;
    if (!uid) return setErro("Sessão expirada. Entre novamente.");
    if (isAdmin && !vendedorId) return setErro("Selecione o vendedor que fez a visita.");
    if (!obraId && !nomeObra.trim()) return setErro("Escolha a obra ou digite o nome dela.");

    const responsavel = vendedorId || uid;
    const id = crypto.randomUUID();
    const enviados: string[] = [];
    try {
      for (let i = 0; i < fotos.length; i++) {
        setSalvando(`Enviando foto ${i + 1} de ${fotos.length}...`);
        const path = `${uid}/${id}/${i + 1}-${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, fotos[i].blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error("Falha ao enviar uma das fotos. Verifique a conexão e tente de novo.");
        enviados.push(path);
      }

      setSalvando("Salvando...");
      let obraFinal = obraId || null;
      let oportunidadeId: string | null = null;
      const vol = Number(volume) || 0;

      // Obra nova de aquisição: já entra no funil (1ª coluna) com o vendedor como responsável
      if (!obraId && tipo === "aquisicao" && noFunil) {
        const { data: obra, error } = await supabase
          .from("obras")
          .insert({
            nome_obra: nomeObra.trim(),
            construtora: construtora.trim(),
            bairro: bairro.trim(),
            latitude: coords?.lat ?? null,
            longitude: coords?.lng ?? null,
            fase_obra: fase || null,
            volume_estimado_m3: vol,
            fornecedor_atual: fornecedor.trim(),
            contato_nome: contato.trim(),
            contato_telefone: telefone.trim(),
            origem: "levantamento",
            criado_por: uid,
          })
          .select()
          .single();
        if (error || !obra) throw new Error("Não foi possível cadastrar a obra no funil.");
        obraFinal = obra.id;
        const { data: op, error: e2 } = await supabase
          .from("oportunidades")
          .insert({ obra_id: obra.id, vendedor_id: responsavel, classificacao: interesse })
          .select()
          .single();
        if (e2 || !op) throw new Error("Obra criada, mas não foi possível colocá-la no funil.");
        oportunidadeId = op.id;
      }

      const ref = obraVinculada;
      const { error } = await supabase.from("relatorios_visita").insert({
        id,
        vendedor_id: responsavel,
        obra_id: obraFinal,
        oportunidade_id: oportunidadeId,
        tipo,
        nome_obra: ref?.nome_obra ?? nomeObra.trim(),
        construtora: ref?.construtora ?? construtora.trim(),
        bairro: ref?.bairro ?? bairro.trim(),
        endereco: ref?.endereco ?? "",
        latitude: coords?.lat ?? ref?.latitude ?? null,
        longitude: coords?.lng ?? ref?.longitude ?? null,
        data_visita: hojeISO(),
        hora_inicio: new Date().toTimeString().slice(0, 5),
        resultado,
        interesse,
        fase_obra: fase || null,
        contato_nome: contato.trim(),
        contato_telefone: telefone.trim(),
        volume_estimado_m3: vol,
        concorrente: fornecedor.trim(),
        resumo: observacao.trim(),
        fotos: enviados,
      });
      if (error) throw new Error(error.message);

      // Mantém a ficha da obra atualizada com o que foi visto em campo
      if (ref) {
        const patch: Record<string, unknown> = {};
        if (fase && fase !== ref.fase_obra) patch.fase_obra = fase;
        if (fornecedor.trim() && fornecedor.trim() !== ref.fornecedor_atual) patch.fornecedor_atual = fornecedor.trim();
        if (vol && !ref.volume_estimado_m3) patch.volume_estimado_m3 = vol;
        if (telefone.trim() && !ref.contato_telefone) patch.contato_telefone = telefone.trim();
        if (contato.trim() && !ref.contato_nome) patch.contato_nome = contato.trim();
        if (Object.keys(patch).length) await supabase.from("obras").update(patch).eq("id", ref.id);
      }
      onSalvo();
    } catch (e) {
      if (enviados.length) await supabase.storage.from(BUCKET).remove(enviados);
      setErro(e instanceof Error ? e.message : "Erro ao salvar o relatório.");
      setSalvando(null);
    }
  }

  return (
    <Modal open onClose={salvando ? () => {} : onClose} title="Registrar visita" wide>
      <div className="space-y-5">
        {/* Fotos */}
        <div>
          <p className="mb-2 text-sm font-bold text-marinho-800">
            Fotos da obra <span className="font-medium text-slate-400">({fotos.length}/{MAX_FOTOS})</span>
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {fotos.length < MAX_FOTOS && (
              <>
                <label className="flex h-24 w-24 flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-marinho-700 text-xs font-bold text-white">
                  <Camera size={26} />
                  Tirar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      adicionarFotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="flex h-24 w-24 flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-500">
                  <ImageIcon size={24} />
                  Galeria
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      adicionarFotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </>
            )}
            {fotos.map((ft, i) => (
              <div key={ft.preview} className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                <img src={ft.preview} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removerFoto(i)}
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
                  aria-label="Remover foto"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2">
          {(["cliente", "aquisicao"] as TipoRelatorio[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={cx(
                "flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm font-bold transition",
                tipo === t ? "border-marinho-700 bg-marinho-50 text-marinho-800" : "border-slate-200 text-slate-500"
              )}
            >
              {t === "cliente" ? <Handshake size={19} /> : <Building2 size={19} />}
              {t === "cliente" ? "Cliente" : "Nova obra"}
            </button>
          ))}
        </div>

        {isAdmin && (
          <Field label="Vendedor que fez a visita">
            <Select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
              <option value="">Selecione...</option>
              {vendedores.map((v) => (<option key={v.id} value={v.id}>{v.nome}</option>))}
            </Select>
          </Field>
        )}

        {/* Obra */}
        <div className="space-y-3">
          <Field label="Obra">
            <Select value={obraId} onChange={(e) => escolherObra(e.target.value)}>
              <option value="">+ Obra nova (digitar abaixo)</option>
              {obrasOrdenadas.map((o) => (
                <option key={o.id} value={o.id}>{o.nome_obra}{o.bairro ? ` — ${o.bairro}` : ""}</option>
              ))}
            </Select>
          </Field>
          {!obraId && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input placeholder="Nome da obra *" value={nomeObra} onChange={(e) => setNomeObra(e.target.value)} />
              <Input placeholder="Construtora" value={construtora} onChange={(e) => setConstrutora(e.target.value)} />
              <Input placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </div>
          )}
          <p
            className={cx(
              "flex items-center gap-1.5 text-xs font-semibold",
              gps === "ok" ? "text-green-700" : gps === "erro" ? "text-amber-700" : "text-slate-400"
            )}
          >
            {gps === "ok" ? <MapPin size={13} /> : <LocateFixed size={13} />}
            {gps === "ok" && "Localização registrada"}
            {gps === "buscando" && "Pegando localização..."}
            {gps === "erro" && "Sem localização (permita o GPS no navegador)"}
          </p>
        </div>

        {/* Fase */}
        <div>
          <p className="mb-2 text-sm font-bold text-marinho-800">Fase da obra</p>
          <div className="flex flex-wrap gap-2">
            {FASE_OBRA.map((fa) => (
              <Chip key={fa.key} ativo={fase === fa.key} onClick={() => setFase(fase === fa.key ? "" : fa.key)}>
                {fa.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Resultado */}
        <div>
          <p className="mb-2 text-sm font-bold text-marinho-800">Resultado</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(RESULTADO_VISITA) as ResultadoVisita[]).map((k) => (
              <Chip key={k} ativo={resultado === k} onClick={() => setResultado(k)} cor={RESULTADO_VISITA[k]}>
                {RESULTADO_VISITA[k].label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Interesse */}
        <div>
          <p className="mb-2 text-sm font-bold text-marinho-800">Interesse</p>
          <div className="grid grid-cols-3 gap-2">
            {(["frio", "morno", "quente"] as Classificacao[]).map((c) => (
              <Chip key={c} ativo={interesse === c} onClick={() => setInteresse(c)} cor={CLASSIFICACOES[c]}>
                {CLASSIFICACOES[c].label}
              </Chip>
            ))}
          </div>
        </div>

        {!obraId && tipo === "aquisicao" && (
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-aco-50 p-3">
            <input
              type="checkbox"
              checked={noFunil}
              onChange={(e) => setNoFunil(e.target.checked)}
              className="h-5 w-5 accent-[#173A5E]"
            />
            <span className="text-sm font-semibold text-marinho-800">
              Colocar esta obra no funil
              <span className="block text-xs font-medium text-slate-500">Entra na primeira coluna, com você como responsável</span>
            </span>
          </label>
        )}

        {/* Opcionais */}
        <div className="rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMais((m) => !m)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-marinho-800"
          >
            Mais detalhes <span className="font-medium text-slate-400">(opcional) {mais ? "−" : "+"}</span>
          </button>
          {mais && (
            <div className="space-y-3 border-t border-slate-100 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Contato na obra">
                  <Input value={contato} onChange={(e) => setContato(e.target.value)} />
                </Field>
                <Field label="Telefone / WhatsApp">
                  <Input inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                </Field>
                <Field label="Volume estimado (m³)">
                  <Input type="number" inputMode="decimal" value={volume} onChange={(e) => setVolume(e.target.value)} />
                </Field>
                <Field label="Fornecedor atual">
                  <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Quem fornece concreto hoje" />
                </Field>
              </div>
              <Field label="Observação">
                <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} className="min-h-[70px]" />
              </Field>
            </div>
          )}
        </div>

        {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erro}</p>}

        <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-2 border-t border-slate-100 bg-white px-5 py-4">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={!!salvando}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-[2]" onClick={salvar} disabled={!!salvando}>
            {salvando ?? (<><CheckCircle2 size={18} /> Salvar visita</>)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Detalhe ---------- */

function DetalheRelatorio({
  r,
  podeExcluir,
  onClose,
  onAlterado,
}: {
  r: RelatorioVisita;
  podeExcluir: boolean;
  onClose: () => void;
  onAlterado: () => void;
}) {
  const { profile } = useAuth();
  const urls = useUrls(r.fotos ?? []);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const tp = TIPO_RELATORIO[r.tipo];
  const rs = RESULTADO_VISITA[r.resultado];
  const temLocal = r.latitude != null || !!r.endereco;

  async function enviarFunil() {
    setOcupado(true);
    setMsg(null);
    const { data: obra, error } = await supabase
      .from("obras")
      .insert({
        nome_obra: r.nome_obra,
        construtora: r.construtora,
        bairro: r.bairro,
        endereco: r.endereco,
        latitude: r.latitude,
        longitude: r.longitude,
        produto_alvo: r.produto_interesse ?? "concreto_usinado",
        fase_obra: r.fase_obra,
        fornecedor_atual: r.concorrente,
        volume_estimado_m3: r.volume_estimado_m3 ?? 0,
        contato_nome: r.contato_nome,
        contato_cargo: r.contato_cargo,
        contato_telefone: r.contato_telefone,
        origem: "levantamento",
        observacoes: `Origem: relatório de visita de ${dataBR(r.data_visita)}. ${r.resumo}`,
        criado_por: profile?.id ?? null,
      })
      .select()
      .single();
    if (error || !obra) {
      setOcupado(false);
      return setMsg("Não foi possível criar a obra no funil.");
    }
    const { data: op, error: e2 } = await supabase
      .from("oportunidades")
      .insert({
        obra_id: obra.id,
        vendedor_id: r.vendedor_id,
        classificacao: r.interesse,
        proxima_etapa_data: r.data_retorno,
      })
      .select()
      .single();
    if (e2 || !op) {
      setOcupado(false);
      return setMsg("Obra criada, mas não foi possível criar a oportunidade.");
    }
    await supabase.from("relatorios_visita").update({ obra_id: obra.id, oportunidade_id: op.id }).eq("id", r.id);
    setOcupado(false);
    setMsg("Obra enviada para o funil (primeira coluna).");
    onAlterado();
  }

  async function excluir() {
    if (!window.confirm("Excluir este relatório e suas fotos? Essa ação não pode ser desfeita.")) return;
    setOcupado(true);
    if (r.fotos?.length) await supabase.storage.from(BUCKET).remove(r.fotos);
    await supabase.from("relatorios_visita").delete().eq("id", r.id);
    onAlterado();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={r.nome_obra} wide>
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge bg={tp.bg} fg={tp.fg}>{tp.label}</Badge>
        <Badge bg={rs.bg} fg={rs.fg}>{rs.label}</Badge>
        <Badge bg={CLASSIFICACOES[r.interesse].bg} fg={CLASSIFICACOES[r.interesse].fg}>
          Interesse {CLASSIFICACOES[r.interesse].label.toLowerCase()}
        </Badge>
        {r.fase_obra && <Badge>Fase: {FASE_LABEL[r.fase_obra]}</Badge>}
        {r.oportunidade_id && <Badge bg="#e0f2fe" fg="#0369a1">No funil</Badge>}
      </div>

      {r.fotos?.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {r.fotos.map((p) => (
            <button
              key={p}
              onClick={() => urls[p] && setAmpliada(urls[p])}
              className="aspect-square overflow-hidden rounded-xl bg-slate-100"
            >
              {urls[p] ? (
                <img src={urls[p]} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="grid h-full w-full place-items-center text-slate-300">
                  <ImageIcon size={22} />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Info label="Vendedor" valor={r.vendedor?.nome} />
        <Info label="Data" valor={`${dataBR(r.data_visita)}${r.hora_inicio ? ` · ${r.hora_inicio.slice(0, 5)}` : ""}`} />
        <Info label="Construtora / cliente" valor={r.construtora} />
        <Info label="Local" valor={[r.endereco, r.bairro].filter(Boolean).join(" · ")} />
        <Info label="Contato" valor={[r.contato_nome, r.contato_telefone].filter(Boolean).join(" · ")} />
        <Info label="Fornecedor atual" valor={r.concorrente} />
        <Info label="Volume estimado" valor={r.volume_estimado_m3 ? `${r.volume_estimado_m3} m³` : ""} />
        <Info label="Localização" valor={r.latitude != null ? "Registrada pelo GPS" : "Não registrada"} />
      </div>

      {r.resumo && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Observação</p>
          <p className="whitespace-pre-wrap text-sm text-marinho-800">{r.resumo}</p>
        </div>
      )}
      {r.proximo_passo && (
        <div className="mt-3 rounded-xl bg-aco-50 p-3 text-sm text-marinho-800">
          <b>Próximo passo:</b> {r.proximo_passo}
        </div>
      )}

      {msg && <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">{msg}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        {temLocal && (
          <a href={mapsLink(r.latitude, r.longitude, r.endereco || r.bairro)} target="_blank" rel="noreferrer" className="flex-1">
            <Button variant="secondary" className="w-full">
              <Navigation size={16} /> Abrir no Maps
            </Button>
          </a>
        )}
        {r.tipo === "aquisicao" && !r.oportunidade_id && (
          <Button className="flex-1" onClick={enviarFunil} disabled={ocupado}>
            <Send size={16} /> Enviar obra para o funil
          </Button>
        )}
        {podeExcluir && (
          <Button variant="ghost" onClick={excluir} disabled={ocupado} className="text-red-600 hover:bg-red-50">
            <Trash2 size={16} /> Excluir
          </Button>
        )}
      </div>

      {ampliada && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/90 p-4" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="" className="max-h-full max-w-full rounded-lg" />
          <button className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/20 text-white">
            <X size={22} />
          </button>
        </div>
      )}
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

/* ---------- Exportação (Excel / Google Planilhas) ---------- */

function exportarCSV(rows: RelatorioVisita[]) {
  const cab = [
    "Data", "Hora", "Vendedor", "Tipo", "Obra", "Construtora/cliente", "Bairro", "Fase da obra", "Resultado",
    "Interesse", "Contato", "Telefone", "Volume (m³)", "Fornecedor atual", "Observação", "Qtd. fotos",
    "GPS", "No funil",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas = rows.map((r) =>
    [
      dataBR(r.data_visita),
      r.hora_inicio?.slice(0, 5) ?? "",
      r.vendedor?.nome ?? "",
      TIPO_RELATORIO[r.tipo].label,
      r.nome_obra,
      r.construtora,
      r.bairro,
      r.fase_obra ? FASE_LABEL[r.fase_obra] : "",
      RESULTADO_VISITA[r.resultado].label,
      CLASSIFICACOES[r.interesse].label,
      r.contato_nome,
      r.contato_telefone,
      r.volume_estimado_m3 || "",
      r.concorrente,
      r.resumo,
      r.fotos?.length ?? 0,
      r.latitude != null ? `${r.latitude},${r.longitude}` : "",
      r.oportunidade_id ? "Sim" : "Não",
    ]
      .map(esc)
      .join(";")
  );
  const blob = new Blob(["﻿" + [cab.join(";"), ...linhas].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `relatorios-visita-${hojeISO()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
