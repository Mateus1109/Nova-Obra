import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { jsPDF as JsPDF } from "jspdf";
import {
  Activity,
  AlarmClock,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Handshake,
  Info,
  ListTodo,
  Loader2,
  Navigation,
  Package,
  Plus,
  ThumbsDown,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { tituloCard, useData, type Card as Negocio } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Avatar, Button, Card, Empty, Spinner } from "@/components/ui";
import {
  PRODUTO_LABEL,
  RESULTADO_VISITA,
  TIPO_RELATORIO,
  type Obra,
  type RelatorioVisita,
  type ResultadoVisita,
  type StatusNegocio,
  type TipoEtapa,
  type TipoRelatorio,
} from "@/lib/types";
import { brl, cx, diasDesde, isoLocal, mapsLink } from "@/lib/utils";

/* ---------- Constantes ---------- */

const PARADA_DIAS = 7;
const SEM = "__sem";
const DIA_MS = 864e5;

// Séries (validadas para daltonismo; a perda também é tracejada nas linhas)
const COR = {
  criados: "#3385FF",
  ganhos: "#1baf7a",
  perdidos: "#e34948",
  pendentes: "#3385FF",
  concluidas: "#1baf7a",
};
// Cores fixas por atendente (sempre a mesma pessoa com a mesma cor)
const PALETA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const COR_SEM = "#94a3b8";
const COR_OUTROS = "#cbd5e1";
const COR_TIPO_VISITA: Record<TipoRelatorio, string> = {
  cliente: "#1baf7a",
  aquisicao: "#3385FF",
  novo_cliente: "#eda100",
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const ABAS = [
  { key: "negocios", label: "Negócios" },
  { key: "visitas", label: "Visitas" },
] as const;
type Aba = (typeof ABAS)[number]["key"];

type Modo = "valor" | "quantidade";

/* ---------- Período ---------- */

type Atalho = "hoje" | "7d" | "30d" | "mes" | "mes_passado" | "ano" | "personalizado";
const ATALHOS: { key: Atalho; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "ano", label: "Este ano" },
  { key: "personalizado", label: "Personalizado" },
];

/** de/ate em yyyy-mm-dd (dias inteiros, inclusive) */
interface Periodo {
  atalho: Atalho;
  de: string;
  ate: string;
}

const somaDias = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const diaLocal = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00");

function periodoDoAtalho(a: Exclude<Atalho, "personalizado">): Periodo {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const h = isoLocal(hoje);
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  switch (a) {
    case "hoje":
      return { atalho: a, de: h, ate: h };
    case "7d":
      return { atalho: a, de: isoLocal(somaDias(hoje, -6)), ate: h };
    case "30d":
      return { atalho: a, de: isoLocal(somaDias(hoje, -29)), ate: h };
    case "mes":
      return { atalho: a, de: isoLocal(new Date(ano, mes, 1)), ate: h };
    case "mes_passado":
      return { atalho: a, de: isoLocal(new Date(ano, mes - 1, 1)), ate: isoLocal(new Date(ano, mes, 0)) };
    case "ano":
      return { atalho: a, de: isoLocal(new Date(ano, 0, 1)), ate: h };
  }
}

/** "set 30, 2026" — mesmo formato do DataCrazy */
const dataCurta = (iso: string) => {
  const d = diaLocal(iso);
  return `${MESES[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
};
const rotuloPeriodo = (p: Periodo) => (p.de === p.ate ? dataCurta(p.de) : `${dataCurta(p.de)} - ${dataCurta(p.ate)}`);
/** Versão curta para o celular: "set 30 - out 07, 2026" */
const rotuloPeriodoCurto = (p: Periodo) =>
  p.de === p.ate || p.de.slice(0, 4) !== p.ate.slice(0, 4)
    ? rotuloPeriodo(p)
    : `${dataCurta(p.de).slice(0, 6)} - ${dataCurta(p.ate)}`;

interface Intervalo {
  ini: number;
  fim: number; // exclusivo
  dias: number;
}
function intervalo(p: Periodo): Intervalo {
  const ini = diaLocal(p.de).getTime();
  const fim = somaDias(diaLocal(p.ate), 1).getTime();
  return { ini, fim, dias: Math.max(1, Math.round((fim - ini) / DIA_MS)) };
}
/** data (timestamp ou yyyy-mm-dd) → milissegundos no fuso local */
const tempo = (iso: string) => (iso.length <= 10 ? diaLocal(iso) : new Date(iso)).getTime();
const dentro = (iso: string | null | undefined, iv: Intervalo) => {
  if (!iso) return false;
  const t = tempo(iso);
  return t >= iv.ini && t < iv.fim;
};

/** Agrupa o período em dias (até 31), semanas (até 120 dias) ou meses */
type Escala = "dia" | "semana" | "mes";
interface Balde {
  chave: string;
  rotulo: string;
}
function baldes(iv: Intervalo): { escala: Escala; lista: Balde[]; chaveDe: (iso: string | null | undefined) => string | null } {
  const escala: Escala = iv.dias <= 31 ? "dia" : iv.dias <= 120 ? "semana" : "mes";
  const ini = new Date(iv.ini);
  const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const lista: Balde[] = [];
  if (escala === "mes") {
    for (let d = new Date(ini.getFullYear(), ini.getMonth(), 1); d.getTime() < iv.fim; d = new Date(d.getFullYear(), d.getMonth() + 1, 1))
      lista.push({ chave: `${d.getFullYear()}-${d.getMonth()}`, rotulo: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` });
  } else {
    const passo = escala === "dia" ? 1 : 7;
    for (let i = 0; i < iv.dias; i += passo) lista.push({ chave: String(i / passo), rotulo: ddmm(somaDias(ini, i)) });
  }
  const chaveDe = (iso: string | null | undefined) => {
    if (!iso || !dentro(iso, iv)) return null;
    const d = new Date(tempo(iso));
    if (escala === "mes") return `${d.getFullYear()}-${d.getMonth()}`;
    d.setHours(0, 0, 0, 0);
    const idx = Math.round((d.getTime() - iv.ini) / DIA_MS);
    return String(escala === "dia" ? idx : Math.floor(idx / 7));
  };
  return { escala, lista, chaveDe };
}

/* ---------- Formatação ---------- */

const fmtCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const fmtEixo = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 2,
});
const brlEixo = (v: number) => (Math.abs(v) < 1000 ? `R$ ${Math.round(v)}` : fmtEixo.format(v));
/** R$ 950 · R$ 12,5 mil · R$ 1,2 mi */
const brlCurto = (v: number) => (Math.abs(v) < 1000 ? `R$ ${Math.round(v)}` : fmtCompacto.format(v));
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
const pct = (v: number, total: number) =>
  `${(total ? (v / total) * 100 : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const primeiroNome = (nome: string) => {
  const p = nome.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || nome;
};

/* ---------- Agrupamentos ---------- */

interface Grupo {
  id: string;
  nome: string;
  valor: number;
  qtd: number;
}
function agrupar<T>(itens: T[], chave: (t: T) => string, nome: (t: T) => string, valor: (t: T) => number): Grupo[] {
  const m = new Map<string, Grupo>();
  for (const t of itens) {
    const k = chave(t);
    const g = m.get(k) ?? { id: k, nome: nome(t), valor: 0, qtd: 0 };
    g.valor += valor(t);
    g.qtd += 1;
    m.set(k, g);
  }
  return Array.from(m.values()).sort((a, b) => b.valor - a.valor || b.qtd - a.qtd);
}
const somaValor = (cs: Negocio[]) => cs.reduce((s, c) => s + (Number(c.valor_estimado) || 0), 0);
const valorDe = (c: Negocio) => Number(c.valor_estimado) || 0;

/** Status do negócio (negócios antigos sem status caem no tipo da etapa) */
const statusDe = (c: Negocio, tipo?: TipoEtapa): StatusNegocio =>
  c.status ?? (tipo === "ganho" ? "ganho" : tipo === "perdido" ? "perdido" : "aberto");
const quandoStatus = (c: Negocio) => c.status_em ?? c.atualizado_em;

interface PontoDiario {
  rotulo: string;
  criadosV: number;
  criadosQ: number;
  ganhosV: number;
  ganhosQ: number;
  perdidosV: number;
  perdidosQ: number;
}
interface PontoVisita {
  rotulo: string;
  cliente: number;
  aquisicao: number;
  novo_cliente: number;
}
interface LinhaResponsavel {
  id: string;
  nome: string;
  concluidas: number;
  pendentes: number;
}
interface LinhaVendedorVisita {
  id: string;
  nome: string;
  visitas: number;
  clientes: number;
  novas: number;
  pedidos: number;
}

/* =====================================================================
   Página
   ===================================================================== */

export default function Dashboard() {
  const { cards, etapas, pipelines, obras, leads, vendedores, motivosPerda, loading, avisar } =
    useData();
  const { profile, isAdmin, pode } = useAuth();
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>("negocios");
  // visitas seguem a permissão dos relatórios (a mesma regra do banco); negócios e atividades, a das obras
  const verEquipe = isAdmin || pode(aba === "visitas" ? "ver_relatorios_equipe" : "ver_todas_obras");
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoDoAtalho("7d"));
  const [pipelineId, setPipelineId] = useState("");
  const [atendente, setAtendente] = useState("");
  const [modoDiario, setModoDiario] = useState<Modo>("valor");
  const [modoRosca, setModoRosca] = useState<Modo>("valor");
  const [exportando, setExportando] = useState(false);

  // Nomes de todos os usuários (administradores também podem ser responsáveis por atividades)
  const [perfis, setPerfis] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, nome")
      .then(({ data }) => setPerfis((data as { id: string; nome: string }[]) ?? []));
  }, []);

  const iv = useMemo(() => intervalo(periodo), [periodo]);
  const grade = useMemo(() => baldes(iv), [iv]);
  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);
  const pipelinePorId = useMemo(() => new Map(pipelines.map((p) => [p.id, p])), [pipelines]);
  const cardPorId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const nomeUsuario = useMemo(() => {
    const m = new Map<string, string>();
    perfis.forEach((p) => m.set(p.id, p.nome));
    vendedores.forEach((v) => m.set(v.id, v.nome));
    cards.forEach((c) => c.vendedor && m.set(c.vendedor.id, c.vendedor.nome));
    if (profile) m.set(profile.id, profile.nome);
    return m;
  }, [perfis, vendedores, cards, profile]);
  const nomeDe = (id: string | null | undefined, vazio = "Sem atendente") =>
    id ? nomeUsuario.get(id) ?? "Usuário removido" : vazio;

  // Atendentes do filtro (vendedores + quem aparece nos negócios), em ordem alfabética
  const atendentes = useMemo(() => {
    const m = new Map<string, string>();
    vendedores.forEach((v) => m.set(v.id, v.nome));
    cards.forEach((c) => {
      if (c.vendedor_id) m.set(c.vendedor_id, c.vendedor?.nome ?? nomeUsuario.get(c.vendedor_id) ?? "Usuário");
    });
    return Array.from(m, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [vendedores, cards, nomeUsuario]);
  const corAtendente = useMemo(() => {
    const m = new Map<string, string>();
    atendentes.forEach((a, i) => i < PALETA.length && m.set(a.id, PALETA[i]));
    m.set(SEM, COR_SEM);
    return m;
  }, [atendentes]);

  // "Sem atendente" só existe na aba Negócios
  const filtroAtendente = !verEquipe || (atendente === SEM && aba !== "negocios") ? "" : atendente;
  const doPipeline = (etapaId: string) => !pipelineId || etapaPorId.get(etapaId)?.pipeline_id === pipelineId;
  const doAtendente = (id: string | null | undefined) =>
    !filtroAtendente || (filtroAtendente === SEM ? !id : id === filtroAtendente);

  /* ---------- Negócios ---------- */
  const neg = useMemo(() => {
    const base = cards.filter((c) => doPipeline(c.etapa_id) && doAtendente(c.vendedor_id));
    const st = (c: Negocio) => statusDe(c, etapaPorId.get(c.etapa_id)?.tipo);
    const criados = base.filter((c) => dentro(c.criado_em, iv));
    const ganhos = base.filter((c) => st(c) === "ganho" && dentro(quandoStatus(c), iv));
    const perdidos = base.filter((c) => st(c) === "perdido" && dentro(quandoStatus(c), iv));
    const abertos = base.filter((c) => st(c) === "aberto");
    const ids = new Set([...criados, ...ganhos, ...perdidos].map((c) => c.id));
    const movimentados = base.filter((c) => ids.has(c.id));

    // Dados diários (ou semanais/mensais em períodos longos)
    const pontos = new Map<string, PontoDiario>(
      grade.lista.map((b) => [
        b.chave,
        { rotulo: b.rotulo, criadosV: 0, criadosQ: 0, ganhosV: 0, ganhosQ: 0, perdidosV: 0, perdidosQ: 0 },
      ])
    );
    const ponto = (iso: string | null | undefined) => {
      const k = grade.chaveDe(iso);
      return k == null ? undefined : pontos.get(k);
    };
    criados.forEach((c) => {
      const p = ponto(c.criado_em);
      if (p) {
        p.criadosV += valorDe(c);
        p.criadosQ += 1;
      }
    });
    ganhos.forEach((c) => {
      const p = ponto(quandoStatus(c));
      if (p) {
        p.ganhosV += valorDe(c);
        p.ganhosQ += 1;
      }
    });
    perdidos.forEach((c) => {
      const p = ponto(quandoStatus(c));
      if (p) {
        p.perdidosV += valorDe(c);
        p.perdidosQ += 1;
      }
    });

    const nomeVend = (c: Negocio) => (c.vendedor_id ? c.vendedor?.nome ?? nomeDe(c.vendedor_id) : "Sem atendente");
    const porAtendente = agrupar(criados, (c) => c.vendedor_id ?? SEM, nomeVend, valorDe);
    const ranking = agrupar(ganhos, (c) => c.vendedor_id ?? SEM, nomeVend, valorDe);
    const produtos = agrupar(
      ganhos,
      (c) => (c.obra ? c.obra.produto_alvo ?? "nd" : SEM),
      (c) => (c.obra ? PRODUTO_LABEL[c.obra.produto_alvo] ?? "Produto não informado" : "Sem obra"),
      valorDe
    );
    const motivos = agrupar(
      perdidos,
      (c) => c.motivo_perda_id ?? SEM,
      (c) => motivosPerda.find((m) => m.id === c.motivo_perda_id)?.nome ?? "Sem motivo informado",
      valorDe
    ).sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
    const parados = abertos
      .filter((c) => diasDesde(c.atualizado_em) >= PARADA_DIAS)
      .sort((a, b) => diasDesde(b.atualizado_em) - diasDesde(a.atualizado_em));
    const obraIds = new Set(base.map((c) => c.obra_id).filter(Boolean));

    return {
      base,
      criados,
      ganhos,
      perdidos,
      abertos,
      movimentados,
      diario: Array.from(pontos.values()),
      porAtendente,
      ranking,
      produtos,
      motivos,
      parados,
      obraIds,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, etapaPorId, iv, grade, pipelineId, filtroAtendente, motivosPerda, nomeUsuario]);

  /* ---------- Visitas (relatórios do período) ---------- */
  const [visitas, setVisitas] = useState<RelatorioVisita[] | null>(null);
  useEffect(() => {
    if (aba !== "visitas") return;
    let vivo = true;
    setVisitas(null);
    supabase
      .from("relatorios_visita")
      .select("*, vendedor:profiles(nome)")
      .gte("data_visita", periodo.de)
      .lte("data_visita", periodo.ate)
      .order("data_visita", { ascending: true })
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) avisar("Não foi possível carregar as visitas do período.");
        setVisitas((data as RelatorioVisita[]) ?? []);
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, periodo.de, periodo.ate]);

  const vis = useMemo(() => {
    const lista = (visitas ?? []).filter((r) => doAtendente(r.vendedor_id));
    const conta = (t: TipoRelatorio) => lista.filter((r) => r.tipo === t).length;
    const pontos = new Map<string, PontoVisita>(
      grade.lista.map((b) => [b.chave, { rotulo: b.rotulo, cliente: 0, aquisicao: 0, novo_cliente: 0 }])
    );
    lista.forEach((r) => {
      const k = grade.chaveDe(r.data_visita);
      const p = k == null ? undefined : pontos.get(k);
      if (p && r.tipo in p) p[r.tipo] += 1;
    });
    const m = new Map<string, LinhaVendedorVisita>();
    lista.forEach((r) => {
      const g = m.get(r.vendedor_id) ?? {
        id: r.vendedor_id,
        nome: r.vendedor?.nome ?? nomeDe(r.vendedor_id),
        visitas: 0,
        clientes: 0,
        novas: 0,
        pedidos: 0,
      };
      g.visitas += 1;
      if (r.tipo === "cliente") g.clientes += 1;
      if (r.tipo === "aquisicao") g.novas += 1;
      if (r.resultado === "pedido_fechado") g.pedidos += 1;
      m.set(r.vendedor_id, g);
    });
    const resultados = (Object.keys(RESULTADO_VISITA) as ResultadoVisita[])
      .map((k) => ({ key: k, qtd: lista.filter((r) => r.resultado === k).length }))
      .filter((r) => r.qtd > 0)
      .sort((a, b) => b.qtd - a.qtd);
    return {
      lista,
      clientes: conta("cliente"),
      aquisicao: conta("aquisicao"),
      novoCliente: conta("novo_cliente"),
      pedidos: lista.filter((r) => r.resultado === "pedido_fechado").length,
      pontos: Array.from(pontos.values()),
      porVendedor: Array.from(m.values()).sort((a, b) => b.visitas - a.visitas || b.pedidos - a.pedidos),
      resultados,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitas, grade, filtroAtendente, nomeUsuario]);

  /* ---------- Rótulos auxiliares ---------- */
  const abrirNegocio = (c: Negocio) => {
    const pid = etapaPorId.get(c.etapa_id)?.pipeline_id;
    if (pid) navigate(`/pipelines/${pid}?negocio=${c.id}`);
  };
  const nomeFiltroAtendente = !filtroAtendente
    ? "Todos"
    : filtroAtendente === SEM
      ? "Sem atendente"
      : atendentes.find((a) => a.id === filtroAtendente)?.nome ?? nomeDe(filtroAtendente);
  const nomeFiltroPipeline = pipelineId ? pipelinePorId.get(pipelineId)?.nome ?? "—" : "Todos";
  const rotuloEscala = grade.escala === "dia" ? "Dia" : grade.escala === "semana" ? "Semana de" : "Mês";

  /* ---------- Exportar PDF ---------- */
  async function exportar() {
    if (exportando) return;
    if (aba === "visitas" && !visitas) return avisar("Aguarde as visitas carregarem.");
    setExportando(true);
    try {
      const filtros = [
        `Período: ${rotuloPeriodo(periodo)}`,
        aba !== "visitas" ? `Pipeline: ${nomeFiltroPipeline}` : "",
        verEquipe ? `Atendente: ${nomeFiltroAtendente}` : profile ? `Atendente: ${profile.nome}` : "",
      ].filter(Boolean);
      let kpis: KpiPdf[] = [];
      let tabelas: TabelaPdf[] = [];
      if (aba === "negocios") {
        kpis = [
          { titulo: "Total criados", valor: brl(somaValor(neg.criados)), sub: plural(neg.criados.length, "negócio", "negócios"), cor: COR.criados },
          { titulo: "Total ganhos", valor: brl(somaValor(neg.ganhos)), sub: plural(neg.ganhos.length, "negócio", "negócios"), cor: "#15803d" },
          { titulo: "Total perdidos", valor: brl(somaValor(neg.perdidos)), sub: plural(neg.perdidos.length, "negócio", "negócios"), cor: "#b91c1c" },
          { titulo: "Total em aberto (hoje)", valor: brl(somaValor(neg.abertos)), sub: plural(neg.abertos.length, "negócio", "negócios"), cor: "#7c3aed" },
          { titulo: "Total negócios", valor: brl(somaValor(neg.movimentados)), sub: plural(neg.movimentados.length, "negócio", "negócios"), cor: COR.criados },
        ];
        const totalCriados = somaValor(neg.criados);
        tabelas = [
          {
            titulo: "Atendentes com mais vendas",
            colunas: [
              { t: "#", w: 0.06 },
              { t: "Atendente", w: 0.5 },
              { t: "Negócios ganhos", w: 0.2, dir: true },
              { t: "Valor ganho", w: 0.24, dir: true },
            ],
            linhas: neg.ranking.map((g, i) => [String(i + 1), g.nome, String(g.qtd), brl(g.valor)]),
          },
          {
            titulo: "Produtos mais vendidos",
            colunas: [
              { t: "Produto", w: 0.56 },
              { t: "Negócios", w: 0.2, dir: true },
              { t: "Valor", w: 0.24, dir: true },
            ],
            linhas: neg.produtos.map((g) => [g.nome, String(g.qtd), brl(g.valor)]),
          },
          {
            titulo: "Percentual por atendente (negócios criados)",
            colunas: [
              { t: "Atendente", w: 0.42 },
              { t: "Negócios", w: 0.16, dir: true },
              { t: "Valor", w: 0.26, dir: true },
              { t: "% do valor", w: 0.16, dir: true },
            ],
            linhas: neg.porAtendente.map((g) => [g.nome, String(g.qtd), brl(g.valor), pct(g.valor, totalCriados)]),
          },
          {
            titulo: "Motivos de perda",
            colunas: [
              { t: "Motivo", w: 0.56 },
              { t: "Negócios", w: 0.2, dir: true },
              { t: "Valor", w: 0.24, dir: true },
            ],
            linhas: neg.motivos.map((g) => [g.nome, String(g.qtd), brl(g.valor)]),
          },
          {
            titulo: grade.escala === "dia" ? "Dados diários" : grade.escala === "semana" ? "Dados por semana" : "Dados por mês",
            colunas: [
              { t: rotuloEscala, w: 0.16 },
              { t: "Criados", w: 0.1, dir: true },
              { t: "Valor criado", w: 0.18, dir: true },
              { t: "Ganhos", w: 0.1, dir: true },
              { t: "Valor ganho", w: 0.18, dir: true },
              { t: "Perdidos", w: 0.1, dir: true },
              { t: "Valor perdido", w: 0.18, dir: true },
            ],
            linhas: neg.diario
              .filter((p) => p.criadosQ + p.ganhosQ + p.perdidosQ > 0)
              .map((p) => [
                p.rotulo,
                String(p.criadosQ),
                brl(p.criadosV),
                String(p.ganhosQ),
                brl(p.ganhosV),
                String(p.perdidosQ),
                brl(p.perdidosV),
              ]),
          },
          {
            titulo: `Negócios parados há ${PARADA_DIAS}+ dias`,
            colunas: [
              { t: "Negócio", w: 0.34 },
              { t: "Atendente", w: 0.22 },
              { t: "Etapa", w: 0.2 },
              { t: "Valor", w: 0.14, dir: true },
              { t: "Parado", w: 0.1, dir: true },
            ],
            linhas: neg.parados.map((c) => [
              tituloCard(c),
              c.vendedor?.nome ?? nomeDe(c.vendedor_id),
              etapaPorId.get(c.etapa_id)?.nome ?? "",
              brl(valorDe(c)),
              `${diasDesde(c.atualizado_em)} dias`,
            ]),
          },
        ];
      } else {
        kpis = [
          { titulo: "Visitas", valor: String(vis.lista.length), sub: "relatórios no período", cor: COR.criados },
          { titulo: "Visita a cliente", valor: String(vis.clientes), sub: "clientes da carteira", cor: "#15803d" },
          { titulo: "Aquisição de nova obra", valor: String(vis.aquisicao), sub: "obras prospectadas", cor: "#1d4ed8" },
          { titulo: "Pedidos fechados", valor: String(vis.pedidos), sub: "resultado da visita", cor: "#b45309" },
        ];
        tabelas = [
          {
            titulo: "Ranking por vendedor",
            colunas: [
              { t: "#", w: 0.06 },
              { t: "Vendedor", w: 0.38 },
              { t: "Visitas", w: 0.14, dir: true },
              { t: "Clientes", w: 0.14, dir: true },
              { t: "Novas obras", w: 0.14, dir: true },
              { t: "Pedidos", w: 0.14, dir: true },
            ],
            linhas: vis.porVendedor.map((v, i) => [
              String(i + 1),
              v.nome,
              String(v.visitas),
              String(v.clientes),
              String(v.novas),
              String(v.pedidos),
            ]),
          },
          {
            titulo: "Resultado das visitas",
            colunas: [
              { t: "Resultado", w: 0.6 },
              { t: "Visitas", w: 0.2, dir: true },
              { t: "%", w: 0.2, dir: true },
            ],
            linhas: vis.resultados.map((r) => [RESULTADO_VISITA[r.key].label, String(r.qtd), pct(r.qtd, vis.lista.length)]),
          },
          {
            titulo: grade.escala === "dia" ? "Visitas por dia" : grade.escala === "semana" ? "Visitas por semana" : "Visitas por mês",
            colunas: [
              { t: rotuloEscala, w: 0.25 },
              { t: "Visitas", w: 0.19, dir: true },
              { t: "Clientes", w: 0.19, dir: true },
              { t: "Novas obras", w: 0.19, dir: true },
              { t: "Novo cliente", w: 0.18, dir: true },
            ],
            linhas: vis.pontos
              .filter((p) => p.cliente + p.aquisicao + p.novo_cliente > 0)
              .map((p) => [
                p.rotulo,
                String(p.cliente + p.aquisicao + p.novo_cliente),
                String(p.cliente),
                String(p.aquisicao),
                String(p.novo_cliente),
              ]),
          },
        ];
      }
      await gerarPdf({
        aba: ABAS.find((a) => a.key === aba)?.label ?? "",
        filtros,
        kpis,
        tabelas,
        nome: `dashboard-${aba}-${periodo.de}-a-${periodo.ate}.pdf`,
      });
    } catch {
      avisar("Não foi possível gerar o PDF.");
    } finally {
      setExportando(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {/* Cabeçalho: título à esquerda; período, exportar e abas à direita */}
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight text-marinho-800">Dashboard</h1>
          <p className="text-slate-500">Visão geral do seu desempenho e visitas</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-w-0 gap-2">
            <SeletorPeriodo periodo={periodo} onChange={setPeriodo} />
            <button
              onClick={exportar}
              disabled={exportando}
              className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-md border border-aco-500 bg-white px-3 py-2 text-sm font-semibold text-aco-600 transition hover:bg-aco-50 disabled:opacity-60"
            >
              {exportando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span className="sm:hidden">Exportar</span>
              <span className="hidden sm:inline">Exportar dashboard</span>
            </button>
          </div>
          <Abas aba={aba} onChange={setAba} />
        </div>
      </header>

      {/* Filtros */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {aba !== "visitas" && (
          <FiltroSelect value={pipelineId} onChange={setPipelineId} rotulo="Pipeline" className={!verEquipe ? "col-span-2" : undefined}>
            <option value="">Todos os pipelines</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </FiltroSelect>
        )}
        {verEquipe && (
          <FiltroSelect
            value={atendente}
            onChange={setAtendente}
            rotulo="Atendente"
            className={aba === "visitas" ? "col-span-2" : undefined}
          >
            <option value="">Todos os atendentes</option>
            {atendentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
            {aba === "negocios" && <option value={SEM}>Sem atendente</option>}
          </FiltroSelect>
        )}
        {(pipelineId || atendente) && (
          <button
            onClick={() => {
              setPipelineId("");
              setAtendente("");
            }}
            className="col-span-2 justify-self-start text-[0.8125rem] font-medium text-aco-600 hover:underline sm:col-span-1"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {aba === "negocios" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi
              titulo="Total criados"
              valor={brl(somaValor(neg.criados))}
              sub={plural(neg.criados.length, "negócio", "negócios")}
              icone={<Plus size={16} />}
              cor="#1f6fe5"
              fundo="#eff6ff"
              destaque
              className="col-span-2 lg:col-span-1"
            />
            <Kpi
              titulo="Total ganhos"
              valor={brl(somaValor(neg.ganhos))}
              sub={plural(neg.ganhos.length, "negócio", "negócios")}
              icone={<TrendingUp size={16} />}
              cor="#15803d"
              fundo="#dcfce7"
            />
            <Kpi
              titulo="Total perdidos"
              valor={brl(somaValor(neg.perdidos))}
              sub={plural(neg.perdidos.length, "negócio", "negócios")}
              icone={<TrendingDown size={16} />}
              cor="#b91c1c"
              fundo="#fee2e2"
            />
            <Kpi
              titulo="Total em aberto"
              valor={brl(somaValor(neg.abertos))}
              sub={plural(neg.abertos.length, "negócio", "negócios")}
              icone={<Activity size={16} />}
              cor="#7c3aed"
              fundo="#ede9fe"
              info="Negócios com status em aberto hoje, dentro dos filtros de pipeline e atendente. Não depende do período escolhido."
            />
            <Kpi
              titulo="Total negócios"
              valor={brl(somaValor(neg.movimentados))}
              sub={plural(neg.movimentados.length, "negócio", "negócios")}
              icone={<BarChart3 size={16} />}
              cor="#1f6fe5"
              fundo="#eff6ff"
              info="Negócios criados, ganhos ou perdidos no período. Cada negócio conta uma vez, mesmo que tenha sido criado e ganho no mesmo período."
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Painel
              className="lg:col-span-2"
              titulo={grade.escala === "dia" ? "Dados diários" : grade.escala === "semana" ? "Dados por semana" : "Dados por mês"}
              sub={`Visualização por ${modoDiario === "valor" ? "valor" : "quantidade"} dos negócios`}
              acao={<SeletorModo modo={modoDiario} onChange={setModoDiario} />}
            >
              <GraficoDiario pontos={neg.diario} modo={modoDiario} />
            </Painel>
            <Painel
              titulo="Percentual por atendente"
              sub="Negócios criados no período"
              acao={<SeletorModo modo={modoRosca} onChange={setModoRosca} />}
            >
              <Rosca grupos={neg.porAtendente} modo={modoRosca} corDe={(id) => corAtendente.get(id)} />
            </Painel>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Painel titulo="Produtos mais vendidos" sub="Negócios ganhos no período, por produto da obra">
              <ListaRanking
                itens={neg.produtos.map((g) => ({ ...g, sub: plural(g.qtd, "negócio", "negócios") }))}
                cor={() => COR.ganhos}
                icone={() => <Package size={15} />}
              />
            </Painel>
            <Painel titulo="Atendentes com mais vendas" sub="Por valor ganho no período">
              <ListaRanking
                itens={neg.ranking.map((g) => ({ ...g, sub: plural(g.qtd, "negócio ganho", "negócios ganhos") }))}
                cor={(id) => corAtendente.get(id) ?? COR_OUTROS}
                posicao
                avatar
              />
            </Painel>
            <Painel titulo="Motivos de perda" sub="Negócios perdidos no período" className="md:col-span-2 xl:col-span-1">
              <ListaRanking
                itens={neg.motivos.map((g) => ({
                  ...g,
                  sub: `${plural(g.qtd, "negócio", "negócios")} · ${pct(g.qtd, neg.perdidos.length)}`,
                }))}
                cor={() => COR.perdidos}
                icone={() => <ThumbsDown size={14} />}
                porQuantidade
              />
            </Painel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Painel
              titulo={`Negócios parados há ${PARADA_DIAS}+ dias`}
              sub="Em aberto e sem atualização"
              acao={
                neg.parados.length > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.75rem] font-semibold text-amber-800">
                    {neg.parados.length}
                  </span>
                ) : undefined
              }
            >
              {neg.parados.length === 0 ? (
                <SemDados texto="Nenhum negócio parado. Bom trabalho!" icone={<CheckCircle2 size={26} />} />
              ) : (
                <ul className="-mx-1 max-h-[24rem] space-y-1 overflow-y-auto px-1">
                  {neg.parados.map((c) => {
                    const et = etapaPorId.get(c.etapa_id);
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => abrirNegocio(c)}
                          className="flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left hover:border-slate-200 hover:bg-slate-50"
                        >
                          <AlertTriangle size={15} className="flex-shrink-0 text-amber-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-marinho-800">{tituloCard(c)}</p>
                            <p className="truncate text-[0.75rem] text-slate-500">
                              {[c.vendedor?.nome ?? (c.vendedor_id ? nomeDe(c.vendedor_id) : null), et?.nome, valorDe(c) ? brl(valorDe(c)) : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[0.75rem] font-semibold text-amber-800">
                            {diasDesde(c.atualizado_em)}d
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Painel>
            <MapaObras
              className="lg:col-span-2"
              obras={pipelineId || filtroAtendente ? obras.filter((o) => neg.obraIds.has(o.id)) : obras}
            />
          </div>
        </>
      )}

      {aba === "visitas" &&
        (!visitas ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                titulo="Visitas"
                valor={vis.lista.length.toLocaleString("pt-BR")}
                sub="relatórios no período"
                icone={<ClipboardList size={16} />}
                cor="#1f6fe5"
                fundo="#eff6ff"
                destaque
              />
              <Kpi
                titulo="Visita a cliente"
                valor={vis.clientes.toLocaleString("pt-BR")}
                sub={pct(vis.clientes, vis.lista.length) + " das visitas"}
                icone={<Handshake size={16} />}
                cor="#15803d"
                fundo="#dcfce7"
              />
              <Kpi
                titulo="Aquisição de nova obra"
                valor={vis.aquisicao.toLocaleString("pt-BR")}
                sub={pct(vis.aquisicao, vis.lista.length) + " das visitas"}
                icone={<Building2 size={16} />}
                cor="#1d4ed8"
                fundo="#dbeafe"
              />
              <Kpi
                titulo="Pedidos fechados"
                valor={vis.pedidos.toLocaleString("pt-BR")}
                sub={pct(vis.pedidos, vis.lista.length) + " de conversão"}
                icone={<Trophy size={16} />}
                cor="#b45309"
                fundo="#fef3c7"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Painel
                className="lg:col-span-2"
                titulo={grade.escala === "dia" ? "Visitas por dia" : grade.escala === "semana" ? "Visitas por semana" : "Visitas por mês"}
                sub="Relatórios de visita registrados, por tipo"
              >
                <GraficoVisitas pontos={vis.pontos} />
              </Painel>
              <div className="space-y-4">
                <Painel titulo="Ranking por vendedor" sub="Quem mais visitou no período">
                  <ListaRanking
                    itens={vis.porVendedor.map((v) => ({
                      id: v.id,
                      nome: v.nome,
                      valor: v.visitas,
                      qtd: v.visitas,
                      sub: [
                        plural(v.clientes, "cliente", "clientes"),
                        plural(v.novas, "nova obra", "novas obras"),
                        plural(v.pedidos, "pedido", "pedidos"),
                      ].join(" · "),
                    }))}
                    cor={(id) => corAtendente.get(id) ?? COR.criados}
                    formatar={(n) => plural(n, "visita", "visitas")}
                    posicao
                    avatar
                  />
                </Painel>
                <Painel titulo="Resultado das visitas">
                  {vis.resultados.length === 0 ? (
                    <SemDados />
                  ) : (
                    <ul className="space-y-2">
                      {vis.resultados.map((r) => {
                        const rv = RESULTADO_VISITA[r.key];
                        return (
                          <li key={r.key} className="flex items-center gap-2 text-sm">
                            <span
                              className="rounded-full px-2 py-0.5 text-[0.75rem] font-semibold"
                              style={{ background: rv.bg, color: rv.fg }}
                            >
                              {rv.label}
                            </span>
                            <span className="ml-auto font-semibold tabular-nums text-marinho-800">{r.qtd}</span>
                            <span className="w-12 text-right text-[0.75rem] tabular-nums text-slate-500">
                              {pct(r.qtd, vis.lista.length)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Painel>
              </div>
            </div>
          </>
        ))}
    </div>
  );
}

/* =====================================================================
   Componentes da tela
   ===================================================================== */

function Abas({ aba, onChange }: { aba: Aba; onChange: (a: Aba) => void }) {
  return (
    <div role="tablist" className="grid grid-cols-3 rounded-md bg-slate-100 p-1 sm:inline-grid">
      {ABAS.map((a) => (
        <button
          key={a.key}
          role="tab"
          aria-selected={aba === a.key}
          onClick={() => onChange(a.key)}
          className={cx(
            "rounded px-3 py-1.5 text-sm font-medium transition",
            aba === a.key ? "bg-white text-marinho-800 shadow-sm" : "text-slate-500 hover:text-marinho-800"
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function SeletorPeriodo({ periodo, onChange }: { periodo: Periodo; onChange: (p: Periodo) => void }) {
  const [aberto, setAberto] = useState(false);
  const [pers, setPers] = useState(false);
  const [de, setDe] = useState(periodo.de);
  const [ate, setAte] = useState(periodo.ate);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao tocar fora ou apertar Esc
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const abrir = () => {
    setDe(periodo.de);
    setAte(periodo.ate);
    setPers(periodo.atalho === "personalizado");
    setAberto((v) => !v);
  };
  const aplicar = () => {
    if (!de || !ate) return;
    const [a, b] = de <= ate ? [de, ate] : [ate, de];
    onChange({ atalho: "personalizado", de: a, ate: b });
    setAberto(false);
  };
  const campoData =
    "mt-1 w-full rounded-md border border-[#D7DBDF] bg-white px-2 py-1.5 text-base text-marinho-800 outline-none focus:border-aco-500 focus:ring-2 focus:ring-aco-100 sm:text-sm";

  return (
    <div ref={ref} className="relative min-w-0 flex-1 sm:flex-none">
      <button
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-marinho-800 hover:bg-slate-50"
      >
        <CalendarDays size={15} className="flex-shrink-0 text-slate-500" />
        <span className="truncate sm:hidden">{rotuloPeriodoCurto(periodo)}</span>
        <span className="hidden truncate sm:inline">{rotuloPeriodo(periodo)}</span>
        <ChevronDown size={15} className="ml-auto flex-shrink-0 text-slate-400" />
      </button>
      {aberto && (
        <div
          role="dialog"
          aria-label="Escolher período"
          className="absolute left-0 z-30 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-1.5 shadow-cardhover sm:left-auto sm:right-0"
        >
          {ATALHOS.map((a) => {
            const ativo = a.key === "personalizado" ? pers : !pers && periodo.atalho === a.key;
            return (
              <button
                key={a.key}
                onClick={() => {
                  if (a.key === "personalizado") return setPers(true);
                  onChange(periodoDoAtalho(a.key));
                  setAberto(false);
                }}
                className={cx(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                  ativo ? "bg-aco-50 font-medium text-aco-700" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                {a.label}
                {ativo && <Check size={14} />}
              </button>
            );
          })}
          {pers && (
            <div className="mt-1 space-y-2 border-t border-slate-100 px-1.5 pb-1 pt-2.5">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[0.75rem] font-medium text-slate-500">
                  De
                  <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={campoData} />
                </label>
                <label className="block text-[0.75rem] font-medium text-slate-500">
                  Até
                  <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={campoData} />
                </label>
              </div>
              <Button size="sm" className="w-full" onClick={aplicar} disabled={!de || !ate}>
                Aplicar período
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FiltroSelect({
  value,
  onChange,
  rotulo,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  rotulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("relative min-w-0", className)}>
      <select
        aria-label={rotulo}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          "w-full appearance-none truncate rounded-md border bg-white py-2 pl-3 pr-8 text-sm outline-none focus:border-aco-500 focus:ring-2 focus:ring-aco-100 sm:w-auto sm:min-w-[12rem]",
          value ? "border-aco-200 text-aco-700" : "border-slate-200 text-marinho-800"
        )}
      >
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function SeletorModo({ modo, onChange }: { modo: Modo; onChange: (m: Modo) => void }) {
  return (
    <div className="relative flex-shrink-0">
      <select
        aria-label="Visualizar por"
        value={modo}
        onChange={(e) => onChange(e.target.value as Modo)}
        className="appearance-none rounded-md border border-slate-200 bg-white py-1 pl-2.5 pr-7 text-[0.8125rem] text-marinho-800 outline-none focus:border-aco-500 focus:ring-2 focus:ring-aco-100"
      >
        <option value="valor">Valor</option>
        <option value="quantidade">Quantidade</option>
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/** Ícone (i) com explicação — abre ao passar o mouse ou tocar; nunca sai da tela */
function Dica({ texto }: { texto: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; largura: number } | null>(null);
  const abrir = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const largura = Math.min(240, window.innerWidth - 32);
    const left = Math.min(Math.max(16, r.left + r.width / 2 - largura / 2), window.innerWidth - 16 - largura);
    setPos({ top: r.bottom + 6, left, largura });
  };
  // Fecha ao rolar a tela (a caixinha é fixa)
  useEffect(() => {
    if (!pos) return;
    const fechar = () => setPos(null);
    window.addEventListener("scroll", fechar, true);
    return () => window.removeEventListener("scroll", fechar, true);
  }, [pos]);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={texto}
        onClick={abrir}
        onBlur={() => setPos(null)}
        onPointerEnter={(e) => e.pointerType === "mouse" && abrir()}
        onPointerLeave={(e) => e.pointerType === "mouse" && setPos(null)}
        className="inline-flex flex-shrink-0 text-slate-400 hover:text-slate-600"
      >
        <Info size={13} />
      </button>
      {pos && (
        <span
          role="tooltip"
          style={{ top: pos.top, left: pos.left, width: pos.largura }}
          className="fixed z-50 rounded-md bg-marinho-800 px-2.5 py-2 text-[0.75rem] font-normal leading-snug text-white shadow-cardhover"
        >
          {texto}
        </span>
      )}
    </>
  );
}

function Kpi({
  titulo,
  valor,
  sub,
  icone,
  cor,
  fundo,
  destaque,
  info,
  className,
}: {
  titulo: string;
  valor: string;
  sub: string;
  icone: ReactNode;
  cor: string;
  fundo: string;
  destaque?: boolean;
  info?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-lg border bg-white p-3.5 shadow-card sm:p-4",
        destaque ? "border-aco-500 ring-1 ring-aco-500" : "border-slate-200",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.8125rem] font-medium leading-snug text-slate-600 sm:truncate">
          {titulo}
          {info && (
            <span className="ml-1 inline-flex align-[-0.125rem]">
              <Dica texto={info} />
            </span>
          )}
        </p>
        <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md sm:h-8 sm:w-8" style={{ background: fundo, color: cor }}>
          {icone}
        </span>
      </div>
      <p
        title={valor}
        className={cx(
          "mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-tight tracking-tight text-marinho-800",
          destaque ? "text-xl" : "text-base",
          "sm:text-lg lg:text-[1.25rem] xl:text-[1.375rem]"
        )}
      >
        {valor}
      </p>
      <p className="mt-0.5 truncate text-[0.8125rem] text-slate-500">{sub}</p>
    </div>
  );
}

function Painel({
  titulo,
  sub,
  acao,
  children,
  className,
}: {
  titulo: string;
  sub?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cx("min-w-0 p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-marinho-800">{titulo}</h3>
          {sub && <p className="text-[0.8125rem] text-slate-500">{sub}</p>}
        </div>
        {acao}
      </div>
      {children}
    </Card>
  );
}

function SemDados({ texto = "Não há dados", icone }: { texto?: string; icone?: ReactNode }) {
  return (
    <div className="grid min-h-[12rem] place-items-center text-center">
      <div>
        <div className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400">
          {icone ?? <BarChart3 size={20} />}
        </div>
        <p className="text-sm text-slate-500">{texto}</p>
      </div>
    </div>
  );
}

function Legenda({ itens }: { itens: { nome: string; cor: string; tracejado?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {itens.map((i) => (
        <span key={i.nome} className="inline-flex items-center gap-1.5 text-[0.8125rem] text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.cor }} />
          {i.nome}
        </span>
      ))}
    </div>
  );
}

/** Caixinha do tooltip dos gráficos */
interface ItemDica {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number | ((o: unknown) => unknown);
  payload?: Record<string, unknown>;
}
function CaixaDica({
  active,
  payload,
  label,
  formatar,
}: {
  active?: boolean;
  payload?: ItemDica[];
  label?: string | number;
  formatar: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[10rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-[0.8125rem] shadow-cardhover">
      {label != null && label !== "" && <p className="mb-1 font-semibold text-marinho-800">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: p.color ?? (p.payload?.cor as string) }} />
          {p.name}
          <span className="ml-auto pl-3 font-semibold tabular-nums text-marinho-800">{formatar(Number(p.value) || 0)}</span>
        </p>
      ))}
    </div>
  );
}

const eixo = { fontSize: 11, fill: "#64748b" };

function GraficoDiario({ pontos, modo }: { pontos: PontoDiario[]; modo: Modo }) {
  const temDados = pontos.some((p) => p.criadosQ + p.ganhosQ + p.perdidosQ > 0);
  if (!temDados) return <SemDados />;
  const s = modo === "valor" ? "V" : "Q";
  const series = [
    { key: `criados${s}`, nome: "Criados", cor: COR.criados },
    { key: `ganhos${s}`, nome: "Ganhos", cor: COR.ganhos },
    { key: `perdidos${s}`, nome: "Perdidos", cor: COR.perdidos, tracejado: true },
  ];
  const formatar = modo === "valor" ? brl : (v: number) => plural(v, "negócio", "negócios");
  const eixoY = modo === "valor" ? brlEixo : (v: number) => String(v);
  const linhas = pontos.length > 14; // muitos dias: linhas leem melhor que barras finas
  const comum = {
    data: pontos,
    margin: { top: 8, right: 8, left: 0, bottom: 0 },
  };
  return (
    <>
      <Legenda itens={series} />
      <div className="h-[15rem] sm:h-[17rem]">
        <ResponsiveContainer width="100%" height="100%">
          {linhas ? (
            <LineChart {...comum}>
              <CartesianGrid vertical={false} stroke="#eef2f6" />
              <XAxis dataKey="rotulo" tick={eixo} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={12} />
              <YAxis
                tick={eixo}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tickFormatter={eixoY}
                width={modo === "valor" ? 62 : 30}
              />
              <Tooltip content={<CaixaDica formatar={formatar} />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} />
              {series.map((x) => (
                <Line
                  key={x.key}
                  type="linear"
                  dataKey={x.key}
                  name={x.nome}
                  stroke={x.cor}
                  strokeWidth={2}
                  strokeDasharray={x.tracejado ? "5 4" : undefined}
                  dot={false}
                  activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart {...comum} barGap={2} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="#eef2f6" />
              <XAxis dataKey="rotulo" tick={eixo} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval="preserveStartEnd" minTickGap={4} />
              <YAxis
                tick={eixo}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tickFormatter={eixoY}
                width={modo === "valor" ? 62 : 30}
              />
              <Tooltip content={<CaixaDica formatar={formatar} />} cursor={{ fill: "#f1f5f9" }} />
              {series.map((x) => (
                <Bar key={x.key} dataKey={x.key} name={x.nome} fill={x.cor} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </>
  );
}

function Rosca({ grupos, modo, corDe }: { grupos: Grupo[]; modo: Modo; corDe: (id: string) => string | undefined }) {
  const val = (g: Grupo) => (modo === "valor" ? g.valor : g.qtd);
  const positivos = grupos.filter((g) => val(g) > 0).sort((a, b) => val(b) - val(a));
  // Quem não tem cor fixa (mais de 8 atendentes) vai para "Outros"
  const fatias: (Grupo & { cor: string })[] = [];
  const outros: Grupo = { id: "__outros", nome: "Outros", valor: 0, qtd: 0 };
  positivos.forEach((g) => {
    const cor = corDe(g.id);
    if (cor) fatias.push({ ...g, cor });
    else {
      outros.valor += g.valor;
      outros.qtd += g.qtd;
    }
  });
  if (val(outros) > 0) fatias.push({ ...outros, cor: COR_OUTROS });
  const total = fatias.reduce((s, f) => s + val(f), 0);
  if (!total) return <SemDados />;
  const formatar = modo === "valor" ? brl : (v: number) => plural(v, "negócio", "negócios");

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col">
      <div className="relative h-[11rem] w-[11rem] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={fatias}
              dataKey={modo === "valor" ? "valor" : "qtd"}
              nameKey="nome"
              innerRadius="64%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {fatias.map((f) => (
                <Cell key={f.id} fill={f.cor} />
              ))}
            </Pie>
            <Tooltip content={<CaixaDica formatar={formatar} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[0.75rem] text-slate-500">Total</p>
            <p className="font-semibold text-marinho-800">{modo === "valor" ? brlCurto(total) : total}</p>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {fatias.map((f) => (
          <li key={f.id} className="flex items-center gap-2 text-[0.8125rem]">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: f.cor }} />
            <span className="truncate text-slate-700">{f.nome}</span>
            <span className="ml-auto flex-shrink-0 pl-2 text-slate-500 tabular-nums">
              {modo === "valor" ? brlCurto(f.valor) : f.qtd}
            </span>
            <span className="w-12 flex-shrink-0 text-right font-semibold tabular-nums text-marinho-800">{pct(val(f), total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lista com barra proporcional (produtos, atendentes, motivos, vendedores) */
function ListaRanking({
  itens,
  cor,
  icone,
  posicao,
  avatar,
  porQuantidade,
  formatar = brl,
}: {
  itens: (Grupo & { sub: string })[];
  cor: (id: string) => string;
  icone?: (id: string) => ReactNode;
  posicao?: boolean;
  avatar?: boolean;
  porQuantidade?: boolean;
  formatar?: (v: number) => string;
}) {
  if (!itens.length) return <SemDados />;
  const medida = (g: Grupo) => (porQuantidade ? g.qtd : g.valor);
  const max = Math.max(...itens.map(medida), 1);
  return (
    <ul className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
      {itens.map((g, i) => (
        <li key={g.id} className="flex items-center gap-2.5">
          {posicao && <span className="w-4 flex-shrink-0 text-center text-[0.75rem] font-semibold text-slate-400">{i + 1}</span>}
          {avatar ? (
            <Avatar nome={g.nome} size={28} />
          ) : icone ? (
            <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">{icone(g.id)}</span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium text-marinho-800">{g.nome}</p>
              <p className="flex-shrink-0 text-sm font-semibold tabular-nums text-marinho-800">
                {porQuantidade ? g.qtd.toLocaleString("pt-BR") : formatar(g.valor)}
              </p>
            </div>
            <p className="truncate text-[0.75rem] text-slate-500">
              {porQuantidade && g.valor ? `${g.sub} · ${brlCurto(g.valor)}` : g.sub}
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, (medida(g) / max) * 100)}%`, background: cor(g.id) }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function GraficoResponsaveis({ linhas }: { linhas: LinhaResponsavel[] }) {
  if (!linhas.length) return <SemDados />;
  const dados = linhas.map((l) => ({ ...l, curto: primeiroNome(l.nome) }));
  const altura = Math.max(160, dados.length * 46 + 30);
  return (
    <>
      <Legenda
        itens={[
          { nome: "Concluídas", cor: COR.concluidas },
          { nome: "Pendentes", cor: COR.pendentes },
        ]}
      />
      <div style={{ height: altura }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid horizontal={false} stroke="#eef2f6" />
            <XAxis
              type="number"
              tick={eixo}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              domain={[0, (max: number) => Math.max(1, Math.ceil(max))]}
            />
            <YAxis type="category" dataKey="curto" tick={eixo} tickLine={false} axisLine={false} width={92} />
            <Tooltip content={<CaixaDica formatar={(v) => plural(v, "atividade", "atividades")} />} cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="concluidas" name="Concluídas" fill={COR.concluidas} radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false} />
            <Bar dataKey="pendentes" name="Pendentes" fill={COR.pendentes} radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function GraficoVisitas({ pontos }: { pontos: PontoVisita[] }) {
  const total = pontos.reduce((s, p) => s + p.cliente + p.aquisicao + p.novo_cliente, 0);
  if (!total) return <SemDados texto="Nenhuma visita registrada no período" />;
  // "Novo cliente" só aparece se houver relatórios antigos desse tipo
  const tipos = (["cliente", "aquisicao", "novo_cliente"] as TipoRelatorio[]).filter(
    (t) => t !== "novo_cliente" || pontos.some((p) => p.novo_cliente > 0)
  );
  return (
    <>
      <Legenda itens={tipos.map((t) => ({ nome: TIPO_RELATORIO[t].label, cor: COR_TIPO_VISITA[t] }))} />
      <div className="h-[15rem] sm:h-[17rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#eef2f6" />
            <XAxis dataKey="rotulo" tick={eixo} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval="preserveStartEnd" minTickGap={4} />
            <YAxis tick={eixo} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
            <Tooltip content={<CaixaDica formatar={(v) => plural(v, "visita", "visitas")} />} cursor={{ fill: "#f1f5f9" }} />
            {tipos.map((t, i) => (
              <Bar
                key={t}
                dataKey={t}
                name={TIPO_RELATORIO[t].label}
                stackId="v"
                fill={COR_TIPO_VISITA[t]}
                stroke="#fff"
                strokeWidth={1}
                radius={i === tipos.length - 1 ? [4, 4, 0, 0] : undefined}
                maxBarSize={24}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function MapaObras({ obras, className }: { obras: Obra[]; className?: string }) {
  const comCoords = obras.filter((o) => o.latitude && o.longitude);
  return (
    <Card className={cx("min-w-0 overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <h3 className="font-semibold text-marinho-800">Mapa de obras</h3>
          <p className="text-[0.8125rem] text-slate-500">São Luís-MA · {plural(comCoords.length, "obra", "obras")} no mapa</p>
        </div>
      </div>
      {comCoords.length ? (
        <div className="h-[20rem] lg:h-[22rem]">
          <MapContainer center={[-2.53, -44.3]} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {comCoords.map((o) => {
              const cor = o.status_obra === "lancamento" ? "#3385FF" : "#16a34a";
              return (
                <CircleMarker
                  key={o.id}
                  center={[o.latitude, o.longitude]}
                  radius={9}
                  pathOptions={{ color: "#fff", weight: 2, fillColor: cor, fillOpacity: 0.9 }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold text-marinho-800">{o.nome_obra}</p>
                      <p className="text-slate-500">{[o.construtora, o.bairro].filter(Boolean).join(" · ")}</p>
                      <p className="mt-1">{o.status_obra === "lancamento" ? "Lançamento" : "Em andamento"}</p>
                      <a
                        href={mapsLink(o.latitude, o.longitude, o.endereco)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 font-bold text-aco-600"
                      >
                        <Navigation size={12} /> Abrir rota
                      </a>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <Empty
            icon={<Building2 size={32} />}
            titulo="Sem coordenadas"
            texto="Cadastre obras com latitude/longitude para vê-las no mapa."
          />
        </div>
      )}
      <div className="flex gap-4 border-t border-slate-100 px-4 py-3 text-[0.75rem] font-medium text-slate-500 sm:px-5">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-aco-500" /> Lançamento
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-600" /> Em andamento
        </span>
      </div>
    </Card>
  );
}

/* =====================================================================
   PDF (jsPDF carregado só na hora de exportar)
   ===================================================================== */

interface KpiPdf {
  titulo: string;
  valor: string;
  sub: string;
  cor: string;
}
interface TabelaPdf {
  titulo: string;
  /** w = fração da largura útil (soma 1); dir = alinhado à direita */
  colunas: { t: string; w: number; dir?: boolean }[];
  linhas: string[][];
}

const A4_W = 210;
const A4_H = 297;
const M = 14;
const LARG = A4_W - M * 2;
const RGB_MARINHO: [number, number, number] = [2, 8, 23];
const RGB_ACO: [number, number, number] = [51, 133, 255];
const RGB_CINZA: [number, number, number] = [100, 116, 139];
const RGB_TEXTO: [number, number, number] = [15, 23, 42];

// As fontes padrão do PDF só têm o alfabeto latino (Latin-1)
const limpa = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[  ]/g, " ")
    .replace(/[^\x00-\xff]/g, "");

const rgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** Corta o texto para caber na largura (com "...") */
function caber(doc: JsPDF, texto: string, largura: number) {
  let t = limpa(texto);
  if (doc.getTextWidth(t) <= largura) return t;
  while (t.length > 1 && doc.getTextWidth(t + "...") > largura) t = t.slice(0, -1);
  return t.trimEnd() + "...";
}

async function gerarPdf(op: { aba: string; filtros: string[]; kpis: KpiPdf[]; tabelas: TabelaPdf[]; nome: string }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Cabeçalho
  doc.setFillColor(...RGB_MARINHO);
  doc.rect(0, 0, A4_W, 30, "F");
  doc.setFillColor(...RGB_ACO);
  doc.roundedRect(M, 8, 13, 13, 2.5, 2.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("M", M + 6.5, 16.6, { align: "center" });
  doc.setFontSize(16);
  doc.text(limpa(`Dashboard · ${op.aba}`), M + 18, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(limpa("Megamix · Dashboard comercial · São Luís-MA"), M + 18, 20);
  doc.setFontSize(8.2);
  const gerado = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  [...op.filtros, `Gerado em ${gerado}`].slice(0, 4).forEach((f, i) => {
    doc.text(limpa(f), A4_W - M, 9 + i * 4.6, { align: "right" });
  });

  // KPIs (até 5 por linha)
  let y = 38;
  const porLinha = Math.min(5, op.kpis.length);
  const gap = 3;
  const w = (LARG - (porLinha - 1) * gap) / porLinha;
  op.kpis.forEach((k, i) => {
    const col = i % porLinha;
    if (i > 0 && col === 0) y += 24;
    const x = M + col * (w + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, w, 20, 2, 2, "FD");
    doc.setFillColor(...rgb(k.cor));
    doc.roundedRect(x, y, 1.6, 20, 0.8, 0.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...RGB_CINZA);
    doc.text(caber(doc, k.titulo, w - 7), x + 4, y + 5.5);
    doc.setFont("helvetica", "bold");
    let tam = 12;
    doc.setFontSize(tam);
    while (tam > 7 && doc.getTextWidth(limpa(k.valor)) > w - 7) doc.setFontSize((tam -= 0.5));
    doc.setTextColor(...rgb(k.cor));
    doc.text(limpa(k.valor), x + 4, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...RGB_CINZA);
    doc.text(caber(doc, k.sub, w - 7), x + 4, y + 16.8);
  });
  y += 30;

  for (const t of op.tabelas) y = tabelaPdf(doc, t, y);

  // Rodapés
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...RGB_CINZA);
    doc.text(limpa("Megamix · Nova Obra · dashboard gerado pelo sistema"), M, A4_H - 7);
    doc.text(`Página ${i} de ${n}`, A4_W - M, A4_H - 7, { align: "right" });
  }
  await entregarPdf(doc, op.nome);
}

function tabelaPdf(doc: JsPDF, t: TabelaPdf, y0: number) {
  const LIM = A4_H - M - 10;
  const ALT = 6.6;
  let y = y0;
  // título + cabeçalho + pelo menos 2 linhas na mesma página
  if (y + 7 + 7 + ALT * Math.min(2, Math.max(1, t.linhas.length)) > LIM) {
    doc.addPage();
    y = M;
  }
  const xs: number[] = [];
  let acc = M;
  t.colunas.forEach((c) => {
    xs.push(acc);
    acc += c.w * LARG;
  });
  const cabecalho = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(M, y, LARG, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...RGB_CINZA);
    t.colunas.forEach((c, i) => {
      const larg = c.w * LARG - 3;
      const txt = caber(doc, c.t.toUpperCase(), larg);
      if (c.dir) doc.text(txt, xs[i] + c.w * LARG - 2, y + 4.7, { align: "right" });
      else doc.text(txt, xs[i] + 2, y + 4.7);
    });
    y += 7;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...RGB_TEXTO);
  doc.text(limpa(t.titulo), M, y + 4);
  y += 7;
  cabecalho();

  if (!t.linhas.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...RGB_CINZA);
    doc.text(limpa("Não há dados no período."), M + 2, y + 4.6);
    return y + ALT + 6;
  }

  for (const linha of t.linhas) {
    if (y + ALT > LIM) {
      doc.addPage();
      y = M;
      cabecalho();
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...RGB_TEXTO);
    t.colunas.forEach((c, i) => {
      const larg = c.w * LARG - 3;
      const txt = caber(doc, linha[i] ?? "", larg);
      if (c.dir) doc.text(txt, xs[i] + c.w * LARG - 2, y + 4.6, { align: "right" });
      else doc.text(txt, xs[i] + 2, y + 4.6);
    });
    doc.setDrawColor(226, 232, 240);
    doc.line(M, y + ALT, M + LARG, y + ALT);
    y += ALT;
  }
  return y + 8;
}

/** No celular abre o menu de compartilhar (WhatsApp, e-mail...); senão baixa o arquivo. */
async function entregarPdf(doc: JsPDF, nome: string) {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function") {
    try {
      const arquivo = new File([doc.output("blob")], nome, { type: "application/pdf" });
      const celular = window.matchMedia?.("(pointer: coarse)").matches;
      if (celular && navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: nome });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // a pessoa fechou o menu
    }
  }
  doc.save(nome);
}
