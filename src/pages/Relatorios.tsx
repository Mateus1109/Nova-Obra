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
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import {
  CLASSIFICACOES,
  PRODUTO_LABEL,
  RESULTADO_VISITA,
  TIPO_RELATORIO,
  type Classificacao,
  type Obra,
  type ProdutoAlvo,
  type RelatorioVisita,
  type ResultadoVisita,
  type TipoRelatorio,
} from "@/lib/types";
import { comprimirImagem, cx, dataBR, hojeISO, isoLocal, mapsLink } from "@/lib/utils";

const BUCKET = "relatorios-fotos";
const MAX_FOTOS = 10;

/* ---------- URLs assinadas das fotos (bucket privado), com cache ---------- */
const cacheUrls = new Map<string, { url: string; expira: number }>();

async function urlsAssinadas(paths: string[]): Promise<Record<string, string>> {
  const agora = Date.now();
  const out: Record<string, string> = {};
  const faltam: string[] = [];
  for (const p of paths) {
    const c = cacheUrls.get(p);
    if (c && c.expira > agora) out[p] = c.url;
    else faltam.push(p);
  }
  if (faltam.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(faltam, 3600);
    for (const d of data ?? []) {
      if (d.signedUrl && d.path) {
        out[d.path] = d.signedUrl;
        cacheUrls.set(d.path, { url: d.signedUrl, expira: agora + 50 * 60 * 1000 });
      }
    }
  }
  return out;
}

function useUrls(paths: string[]) {
  const chave = paths.join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let vivo = true;
    if (!paths.length) {
      setUrls({});
      return;
    }
    urlsAssinadas(paths).then((u) => vivo && setUrls(u));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return urls;
}

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
            <Plus size={18} /> Novo relatório
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
          texto="Toque em “Novo relatório” logo após cada visita: tire as fotos da obra, informe se é cliente ou nova obra e o resultado."
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

/* ---------- Novo relatório ---------- */

interface FotoLocal {
  blob: Blob;
  preview: string;
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
  const [obraId, setObraId] = useState(obraInicial?.id ?? "");
  const [vendedorId, setVendedorId] = useState(isAdmin ? "" : profile?.id ?? "");
  const [f, setF] = useState({
    nome_obra: obraInicial?.nome_obra ?? "",
    construtora: obraInicial?.construtora ?? "",
    contato_nome: obraInicial?.contato_nome ?? "",
    contato_cargo: obraInicial?.contato_cargo ?? "",
    contato_telefone: obraInicial?.contato_telefone ?? "",
    bairro: obraInicial?.bairro ?? "",
    endereco: obraInicial?.endereco ?? "",
    latitude: (obraInicial?.latitude ?? "") as number | string,
    longitude: (obraInicial?.longitude ?? "") as number | string,
    data_visita: hojeISO(),
    hora_inicio: "",
    hora_fim: "",
    objetivo: "",
    resumo: "",
    resultado: "em_negociacao" as ResultadoVisita,
    interesse: "morno" as Classificacao,
    produto_interesse: (obraInicial?.produto_alvo ?? "") as ProdutoAlvo | "",
    volume_estimado_m3: obraInicial?.volume_estimado_m3 ? String(obraInicial.volume_estimado_m3) : "",
    concorrente: "",
    proximo_passo: "",
    data_retorno: "",
  });
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [localizando, setLocalizando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => () => fotos.forEach((x) => URL.revokeObjectURL(x.preview)), []); // eslint-disable-line

  function vincularObra(id: string) {
    setObraId(id);
    const o = obras.find((x) => x.id === id);
    if (!o) return;
    setF((s) => ({
      ...s,
      nome_obra: o.nome_obra,
      construtora: o.construtora,
      contato_nome: o.contato_nome,
      contato_cargo: o.contato_cargo,
      contato_telefone: o.contato_telefone,
      bairro: o.bairro,
      endereco: o.endereco,
      latitude: o.latitude ?? "",
      longitude: o.longitude ?? "",
      produto_interesse: o.produto_alvo,
      volume_estimado_m3: o.volume_estimado_m3 ? String(o.volume_estimado_m3) : s.volume_estimado_m3,
    }));
  }

  async function adicionarFotos(lista: FileList | null) {
    if (!lista?.length) return;
    const espaco = MAX_FOTOS - fotos.length;
    const arquivos = Array.from(lista).slice(0, espaco);
    const novas: FotoLocal[] = [];
    for (const arq of arquivos) {
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

  function usarLocalizacao() {
    if (!navigator.geolocation) return setErro("Seu aparelho não permite localização.");
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("latitude", Number(pos.coords.latitude.toFixed(6)));
        set("longitude", Number(pos.coords.longitude.toFixed(6)));
        setLocalizando(false);
      },
      () => {
        setErro("Não foi possível obter a localização. Verifique a permissão do GPS.");
        setLocalizando(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function salvar() {
    setErro(null);
    const uid = session?.user.id;
    if (!uid) return setErro("Sessão expirada. Entre novamente.");
    if (!f.nome_obra.trim()) return setErro("Informe o nome da obra.");
    if (!f.resumo.trim()) return setErro("Descreva como foi a visita.");
    if (isAdmin && !vendedorId) return setErro("Selecione o vendedor que fez a visita.");

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

      setSalvando("Salvando relatório...");
      const { error } = await supabase.from("relatorios_visita").insert({
        id,
        vendedor_id: vendedorId || uid,
        obra_id: obraId || null,
        tipo,
        nome_obra: f.nome_obra.trim(),
        construtora: f.construtora.trim(),
        contato_nome: f.contato_nome.trim(),
        contato_cargo: f.contato_cargo.trim(),
        contato_telefone: f.contato_telefone.trim(),
        bairro: f.bairro.trim(),
        endereco: f.endereco.trim(),
        latitude: f.latitude === "" ? null : Number(f.latitude),
        longitude: f.longitude === "" ? null : Number(f.longitude),
        data_visita: f.data_visita,
        hora_inicio: f.hora_inicio || null,
        hora_fim: f.hora_fim || null,
        objetivo: f.objetivo.trim(),
        resumo: f.resumo.trim(),
        resultado: f.resultado,
        interesse: f.interesse,
        produto_interesse: f.produto_interesse || null,
        volume_estimado_m3: Number(f.volume_estimado_m3) || 0,
        concorrente: f.concorrente.trim(),
        proximo_passo: f.proximo_passo.trim(),
        data_retorno: f.data_retorno || null,
        fotos: enviados,
      });
      if (error) throw new Error(error.message);
      onSalvo();
    } catch (e) {
      if (enviados.length) await supabase.storage.from(BUCKET).remove(enviados);
      setErro(e instanceof Error ? e.message : "Erro ao salvar o relatório.");
      setSalvando(null);
    }
  }

  const obrasOrdenadas = useMemo(
    () => [...obras].sort((a, b) => a.nome_obra.localeCompare(b.nome_obra)),
    [obras]
  );

  return (
    <Modal open onClose={salvando ? () => {} : onClose} title="Novo relatório de visita" wide>
      <div className="space-y-5">
        {/* Tipo */}
        <div>
          <p className="mb-2 text-sm font-bold text-marinho-800">Tipo de visita *</p>
          <div className="grid grid-cols-2 gap-2">
            {(["cliente", "aquisicao"] as TipoRelatorio[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-sm font-bold transition",
                  tipo === t ? "border-marinho-700 bg-marinho-50 text-marinho-800" : "border-slate-200 text-slate-500"
                )}
              >
                {t === "cliente" ? <Handshake size={22} /> : <Building2 size={22} />}
                {TIPO_RELATORIO[t].label}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && (
          <Field label="Vendedor que fez a visita *">
            <Select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
              <option value="">Selecione...</option>
              {vendedores.map((v) => (<option key={v.id} value={v.id}>{v.nome}</option>))}
            </Select>
          </Field>
        )}

        {/* Obra */}
        <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Obra / cliente</p>
          <Field label="Vincular a uma obra já cadastrada (opcional)">
            <Select value={obraId} onChange={(e) => vincularObra(e.target.value)}>
              <option value="">— Obra nova / não cadastrada —</option>
              {obrasOrdenadas.map((o) => (
                <option key={o.id} value={o.id}>{o.nome_obra} — {o.bairro}</option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome da obra *">
              <Input value={f.nome_obra} onChange={(e) => set("nome_obra", e.target.value)} />
            </Field>
            <Field label="Construtora / cliente">
              <Input value={f.construtora} onChange={(e) => set("construtora", e.target.value)} />
            </Field>
            <Field label="Bairro">
              <Input value={f.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </Field>
            <Field label="Endereço">
              <Input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={usarLocalizacao} disabled={localizando}>
              <LocateFixed size={15} /> {localizando ? "Localizando..." : "Usar minha localização"}
            </Button>
            {f.latitude !== "" && f.longitude !== "" && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                <MapPin size={13} /> {f.latitude}, {f.longitude}
              </span>
            )}
          </div>
        </div>

        {/* Contato */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Contato">
            <Input value={f.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} />
          </Field>
          <Field label="Cargo">
            <Input value={f.contato_cargo} onChange={(e) => set("contato_cargo", e.target.value)} />
          </Field>
          <Field label="Telefone">
            <Input value={f.contato_telefone} onChange={(e) => set("contato_telefone", e.target.value)} />
          </Field>
        </div>

        {/* Visita */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Data *">
            <Input type="date" value={f.data_visita} onChange={(e) => set("data_visita", e.target.value)} />
          </Field>
          <Field label="Chegada">
            <Input type="time" value={f.hora_inicio} onChange={(e) => set("hora_inicio", e.target.value)} />
          </Field>
          <Field label="Saída">
            <Input type="time" value={f.hora_fim} onChange={(e) => set("hora_fim", e.target.value)} />
          </Field>
        </div>
        <Field label="Objetivo da visita">
          <Input
            value={f.objetivo}
            onChange={(e) => set("objetivo", e.target.value)}
            placeholder="Ex.: apresentar a empresa, negociar preço, acompanhar entrega..."
          />
        </Field>
        <Field label="Como foi a visita? *">
          <Textarea
            value={f.resumo}
            onChange={(e) => set("resumo", e.target.value)}
            placeholder="Com quem falou, fase da obra, necessidades, objeções, combinados..."
            className="min-h-[110px]"
          />
        </Field>

        {/* Resultado */}
        <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Resultado</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Resultado da visita">
              <Select value={f.resultado} onChange={(e) => set("resultado", e.target.value as ResultadoVisita)}>
                {(Object.keys(RESULTADO_VISITA) as ResultadoVisita[]).map((k) => (
                  <option key={k} value={k}>{RESULTADO_VISITA[k].label}</option>
                ))}
              </Select>
            </Field>
            <div>
              <p className="mb-1 text-sm font-semibold text-marinho-800">Interesse</p>
              <div className="flex gap-2">
                {(["frio", "morno", "quente"] as Classificacao[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("interesse", c)}
                    className={cx(
                      "flex-1 rounded-xl border-2 py-2 text-sm font-bold transition",
                      f.interesse === c ? "border-marinho-700" : "border-transparent"
                    )}
                    style={{ background: CLASSIFICACOES[c].bg, color: CLASSIFICACOES[c].fg }}
                  >
                    {CLASSIFICACOES[c].label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Produto de interesse">
              <Select
                value={f.produto_interesse}
                onChange={(e) => set("produto_interesse", e.target.value as ProdutoAlvo | "")}
              >
                <option value="">—</option>
                {(Object.keys(PRODUTO_LABEL) as ProdutoAlvo[]).map((k) => (
                  <option key={k} value={k}>{PRODUTO_LABEL[k]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Volume estimado (m³)">
              <Input
                type="number"
                inputMode="decimal"
                value={f.volume_estimado_m3}
                onChange={(e) => set("volume_estimado_m3", e.target.value)}
              />
            </Field>
            <Field label="Concorrente na obra">
              <Input value={f.concorrente} onChange={(e) => set("concorrente", e.target.value)} />
            </Field>
            <Field label="Data de retorno">
              <Input type="date" value={f.data_retorno} onChange={(e) => set("data_retorno", e.target.value)} />
            </Field>
          </div>
          <Field label="Próximo passo">
            <Input
              value={f.proximo_passo}
              onChange={(e) => set("proximo_passo", e.target.value)}
              placeholder="Ex.: enviar proposta até sexta"
            />
          </Field>
        </div>

        {/* Fotos */}
        <div>
          <p className="mb-2 text-sm font-bold text-marinho-800">
            Fotos da visita <span className="font-medium text-slate-400">({fotos.length}/{MAX_FOTOS})</span>
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {fotos.map((ft, i) => (
              <div key={ft.preview} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
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
            {fotos.length < MAX_FOTOS && (
              <>
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-aco-500 bg-aco-50 text-xs font-bold text-aco-600">
                  <Camera size={24} />
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
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-500">
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
          </div>
        </div>

        {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erro}</p>}

        <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-2 border-t border-slate-100 bg-white px-5 py-4">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={!!salvando}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-[2]" onClick={salvar} disabled={!!salvando}>
            {salvando ?? (<><CheckCircle2 size={18} /> Salvar relatório</>)}
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
        etapa: "qualificacao",
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
    setMsg("Obra enviada para o funil na etapa Qualificação.");
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
        <Info
          label="Data / horário"
          valor={`${dataBR(r.data_visita)}${r.hora_inicio ? ` · ${r.hora_inicio.slice(0, 5)}` : ""}${
            r.hora_fim ? ` às ${r.hora_fim.slice(0, 5)}` : ""
          }`}
        />
        <Info label="Construtora / cliente" valor={r.construtora} />
        <Info label="Local" valor={[r.endereco, r.bairro].filter(Boolean).join(" · ")} />
        <Info
          label="Contato"
          valor={[r.contato_nome, r.contato_cargo && `(${r.contato_cargo})`, r.contato_telefone].filter(Boolean).join(" ")}
        />
        <Info label="Objetivo" valor={r.objetivo} />
        <Info label="Produto de interesse" valor={r.produto_interesse ? PRODUTO_LABEL[r.produto_interesse] : ""} />
        <Info label="Volume estimado" valor={r.volume_estimado_m3 ? `${r.volume_estimado_m3} m³` : ""} />
        <Info label="Concorrente" valor={r.concorrente} />
        <Info label="Retorno" valor={r.data_retorno ? dataBR(r.data_retorno) : ""} />
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Relato da visita</p>
        <p className="whitespace-pre-wrap text-sm text-marinho-800">{r.resumo}</p>
      </div>
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
    "Data", "Chegada", "Saída", "Vendedor", "Tipo", "Obra", "Construtora/cliente", "Bairro", "Endereço",
    "Contato", "Cargo", "Telefone", "Objetivo", "Relato", "Resultado", "Interesse", "Produto",
    "Volume (m³)", "Concorrente", "Próximo passo", "Retorno", "Qtd. fotos", "No funil",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas = rows.map((r) =>
    [
      dataBR(r.data_visita),
      r.hora_inicio?.slice(0, 5) ?? "",
      r.hora_fim?.slice(0, 5) ?? "",
      r.vendedor?.nome ?? "",
      TIPO_RELATORIO[r.tipo].label,
      r.nome_obra,
      r.construtora,
      r.bairro,
      r.endereco,
      r.contato_nome,
      r.contato_cargo,
      r.contato_telefone,
      r.objetivo,
      r.resumo,
      RESULTADO_VISITA[r.resultado].label,
      CLASSIFICACOES[r.interesse].label,
      r.produto_interesse ? PRODUTO_LABEL[r.produto_interesse] : "",
      r.volume_estimado_m3 ?? "",
      r.concorrente,
      r.proximo_passo,
      r.data_retorno ? dataBR(r.data_retorno) : "",
      r.fotos?.length ?? 0,
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
