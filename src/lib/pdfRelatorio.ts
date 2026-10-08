// Gera o PDF dos relatórios de visita (com fotos) direto no navegador.
// O jsPDF é carregado só quando alguém exporta, para não pesar na abertura do app.
import type { jsPDF as JsPDF } from "jspdf";
import { urlsAssinadas } from "./fotos";
import {
  CLASSIFICACOES,
  FASE_LABEL,
  RESULTADO_VISITA,
  TIPO_RELATORIO,
  type RelatorioVisita,
  type TipoRelatorio,
} from "./types";
import { dataBR, hojeISO } from "./utils";

interface Opcoes {
  /** ex.: "Últimos 30 dias" */
  periodo: string;
  /** ex.: "Todos os vendedores" ou o nome do vendedor */
  vendedor: string;
  onProgresso?: (texto: string) => void;
}

const MARINHO: [number, number, number] = [23, 58, 94];
const ACO: [number, number, number] = [46, 120, 168];
const CINZA: [number, number, number] = [100, 116, 139];
const TEXTO: [number, number, number] = [17, 44, 71];

const A4_W = 210;
const A4_H = 297;
const M = 14; // margem
const LARG = A4_W - M * 2;
const FOTO_W = (LARG - 10 - 3 * 3) / 4; // 4 fotos por linha, 5mm de respiro de cada lado
const FOTO_H = FOTO_W * 0.75;
const MAX_FOTOS_PDF = 8;

// As fontes padrão do PDF só têm o alfabeto latino: troca símbolos que não existem nelas
const limpa = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x00-\xff]/g, "");

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** Baixa a foto e devolve uma miniatura JPEG recortada em 4:3 (deixa o PDF leve). */
async function miniatura(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const W = 640;
    const H = 480;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    const escala = Math.max(W / bmp.width, H / bmp.height);
    const w = bmp.width * escala;
    const h = bmp.height * escala;
    ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
    bmp.close?.();
    return c.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  }
}

export async function exportarRelatoriosPDF(rows: RelatorioVisita[], op: Opcoes) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Fotos: URLs assinadas + miniaturas
  const paths = rows.flatMap((r) => (r.fotos ?? []).slice(0, MAX_FOTOS_PDF));
  const urls = paths.length ? await urlsAssinadas(paths) : {};
  const imgs: Record<string, string | null> = {};
  let feitas = 0;
  const fila = [...paths];
  async function trabalhador() {
    while (fila.length) {
      const p = fila.shift()!;
      imgs[p] = urls[p] ? await miniatura(urls[p]) : null;
      feitas++;
      op.onProgresso?.(`Preparando fotos ${feitas} de ${paths.length}...`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, paths.length) }, trabalhador));
  op.onProgresso?.("Montando o PDF...");

  // Vários vendedores: agrupa as visitas por vendedor (mais recentes primeiro dentro de cada um)
  const nomeVend = (r: RelatorioVisita) => r.vendedor?.nome ?? "Sem vendedor";
  const vendedores = Array.from(new Set(rows.map(nomeVend))).sort((a, b) => a.localeCompare(b));
  const agrupar = vendedores.length > 1;
  const ordenadas = agrupar
    ? [...rows].sort(
        (a, b) =>
          nomeVend(a).localeCompare(nomeVend(b)) ||
          b.data_visita.localeCompare(a.data_visita) ||
          (b.hora_inicio ?? "").localeCompare(a.hora_inicio ?? "")
      )
    : rows;

  let y = cabecalho(doc, op, rows.length);
  y = resumo(doc, rows, y);
  if (agrupar) y = tabelaVendedores(doc, rows, vendedores, nomeVend, y);

  let atual = "";
  for (const r of ordenadas) {
    const altura = alturaBloco(doc, r);
    const novoGrupo = agrupar && nomeVend(r) !== atual;
    if (y + altura + (novoGrupo ? 12 : 0) > A4_H - M - 8) {
      doc.addPage();
      y = M;
    }
    if (novoGrupo) {
      atual = nomeVend(r);
      y = tituloGrupo(doc, atual, rows.filter((x) => nomeVend(x) === atual).length, y);
    }
    y = bloco(doc, r, y, imgs) + 5;
  }

  rodapes(doc);
  const nome =
    rows.length === 1
      ? `visita-${limpa(rows[0].nome_obra).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${rows[0].data_visita}.pdf`
      : `relatorio-visitas-${hojeISO()}.pdf`;
  await entregar(doc, nome);
}

/** No celular abre o menu de compartilhar (WhatsApp, Arquivos, e-mail); no computador baixa o arquivo. */
async function entregar(doc: JsPDF, nome: string) {
  const celular = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  if (celular && typeof navigator.share === "function") {
    try {
      const arquivo = new File([doc.output("blob")], nome, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: nome });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // a pessoa fechou o menu
    }
  }
  doc.save(nome);
}

function tituloGrupo(doc: JsPDF, nome: string, qtd: number, y: number) {
  doc.setFillColor(...MARINHO);
  doc.roundedRect(M, y, LARG, 9, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(limpa(nome), M + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`${qtd} visita${qtd === 1 ? "" : "s"}`, A4_W - M - 4, y + 6, { align: "right" });
  return y + 13;
}

function tabelaVendedores(
  doc: JsPDF,
  rows: RelatorioVisita[],
  vendedores: string[],
  nomeVend: (r: RelatorioVisita) => string,
  y: number
) {
  const cols = [
    { t: "Vendedor", x: M + 3 },
    { t: "Visitas", x: M + 92 },
    { t: "Clientes", x: M + 112 },
    { t: "Novas obras", x: M + 134 },
    { t: "Pedidos", x: M + 160 },
  ];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXTO);
  doc.text("Visitas por vendedor", M, y + 4);
  y += 7;
  doc.setFillColor(241, 245, 249);
  doc.rect(M, y, LARG, 7, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(...CINZA);
  cols.forEach((c) => doc.text(c.t.toUpperCase(), c.x, y + 4.8));
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const v of vendedores) {
    const m = rows.filter((r) => nomeVend(r) === v);
    const vals = [
      limpa(v),
      String(m.length),
      String(m.filter((r) => r.tipo === "cliente").length),
      String(m.filter((r) => r.tipo === "aquisicao").length),
      String(m.filter((r) => r.resultado === "pedido_fechado").length),
    ];
    doc.setTextColor(...TEXTO);
    cols.forEach((c, i) => doc.text(vals[i], c.x, y + 5));
    doc.setDrawColor(226, 232, 240);
    doc.line(M, y + 7.5, M + LARG, y + 7.5);
    y += 7.5;
  }
  return y + 7;
}

function cabecalho(doc: JsPDF, op: Opcoes, total: number) {
  doc.setFillColor(...MARINHO);
  doc.rect(0, 0, A4_W, 30, "F");
  // Marca da Megamix (wordmark): quadradinho azul com "M" + nome em caixa alta
  doc.setFillColor(...ACO);
  doc.roundedRect(M, 8, 13, 13, 2.5, 2.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("M", M + 6.5, 16.6, { align: "center" });
  doc.setFontSize(17);
  doc.setCharSpace(0.6);
  doc.text("MEGAMIX", M + 18, 14.5);
  doc.setCharSpace(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(211, 232, 243);
  doc.text("Concreto usinado e bombeado · São Luís-MA", M + 18, 19.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(limpa(total === 1 ? "Relatório de visita" : "Relatório de visitas"), M + 18, 25);

  doc.setFontSize(8.5);
  const gerado = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  doc.text(limpa(`Período: ${op.periodo}`), A4_W - M, 11, { align: "right" });
  doc.text(limpa(`Vendedor: ${op.vendedor}`), A4_W - M, 16, { align: "right" });
  doc.text(`Gerado em ${gerado}`, A4_W - M, 21, { align: "right" });
  return 38;
}

function resumo(doc: JsPDF, rows: RelatorioVisita[], y: number) {
  if (rows.length < 2) return y;
  const conta = (t: TipoRelatorio) => rows.filter((r) => r.tipo === t).length;
  const itens: [string, number, [number, number, number]][] = [
    ["Visitas", rows.length, MARINHO],
    ["Visita a cliente", conta("cliente"), hex(TIPO_RELATORIO.cliente.fg)],
    ["Nova obra", conta("aquisicao"), hex(TIPO_RELATORIO.aquisicao.fg)],
    ["Pedidos fechados", rows.filter((r) => r.resultado === "pedido_fechado").length, [180, 83, 9]],
  ];
  const w = (LARG - (itens.length - 1) * 3) / itens.length;
  itens.forEach(([label, n, cor], i) => {
    const x = M + i * (w + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, w, 17, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...cor);
    doc.text(String(n), x + 4, y + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text(label, x + 4, y + 13.5);
  });
  return y + 24;
}

/** Linhas de detalhe de uma visita (rótulo, valor) já filtradas */
function linhas(r: RelatorioVisita): [string, string][] {
  const local = [r.endereco, r.bairro].filter(Boolean).join(" · ");
  const contato = [r.contato_nome, r.contato_telefone].filter(Boolean).join(" · ");
  const out: [string, string][] = [
    ["Vendedor", r.vendedor?.nome ?? ""],
    ["Construtora / cliente", r.construtora],
    ["Local", local],
    ["Resultado", RESULTADO_VISITA[r.resultado]?.label ?? ""],
    ["Fase da obra", r.fase_obra ? FASE_LABEL[r.fase_obra] : ""],
    ["Contato", contato],
    ["Fornecedor atual", r.concorrente],
    ["Volume estimado", r.volume_estimado_m3 ? `${r.volume_estimado_m3} m³` : ""],
  ];
  return out.filter(([, v]) => v && v.trim()).map(([k, v]) => [k, limpa(v)]);
}

function alturaBloco(doc: JsPDF, r: RelatorioVisita) {
  doc.setFontSize(8.5);
  const n = linhas(r).length;
  const obs = r.resumo ? doc.splitTextToSize(limpa(r.resumo), LARG - 8).length : 0;
  const qtdFotos = Math.min(r.fotos?.length ?? 0, MAX_FOTOS_PDF);
  const linhasFoto = Math.ceil(qtdFotos / 4);
  return 22 + Math.ceil(n / 2) * 9 + (obs ? 6 + obs * 4 : 0) + linhasFoto * (FOTO_H + 3) + 6;
}

function bloco(doc: JsPDF, r: RelatorioVisita, y0: number, imgs: Record<string, string | null>) {
  const tp = TIPO_RELATORIO[r.tipo];
  const h = alturaBloco(doc, r);
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, y0, LARG, h, 3, 3, "FD");
  // faixa colorida do tipo
  doc.setFillColor(...hex(tp.fg));
  doc.roundedRect(M, y0, 2.2, h, 1, 1, "F");

  let y = y0 + 7;
  // selo do tipo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const selo = limpa(tp.label.toUpperCase());
  const sw = doc.getTextWidth(selo) + 6;
  doc.setFillColor(...hex(tp.bg));
  doc.roundedRect(M + 6, y - 4, sw, 5.6, 2.8, 2.8, "F");
  doc.setTextColor(...hex(tp.fg));
  doc.text(selo, M + 9, y);

  // data e hora (à direita)
  doc.setFontSize(9);
  doc.setTextColor(...TEXTO);
  const hora = r.hora_inicio ? ` às ${r.hora_inicio.slice(0, 5)}` : "";
  doc.text(`${dataBR(r.data_visita)}${hora}`, A4_W - M - 5, y, { align: "right" });

  // nome da obra
  y += 8;
  doc.setFontSize(12.5);
  doc.text(limpa(r.nome_obra) || "-", M + 6, y, { maxWidth: LARG - 50 });

  // link do mapa (onde o vendedor estava)
  if (r.latitude != null && r.longitude != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...ACO);
    doc.textWithLink("Ver local no mapa >", A4_W - M - 5 - doc.getTextWidth("Ver local no mapa >"), y, {
      url: `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`,
    });
  }

  // detalhes em 2 colunas
  y += 4;
  const ls = linhas(r);
  const colW = (LARG - 12) / 2;
  ls.forEach(([k, v], i) => {
    const x = M + 6 + (i % 2) * colW;
    const yy = y + Math.floor(i / 2) * 9 + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    doc.text(k.toUpperCase(), x, yy);
    doc.setFontSize(9);
    doc.setTextColor(...TEXTO);
    doc.text(v, x, yy + 4, { maxWidth: colW - 4 });
  });
  y += Math.ceil(ls.length / 2) * 9 + 2;

  // observação
  if (r.resumo) {
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    doc.text("OBSERVAÇÃO", M + 6, y + 4);
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXTO);
    const txt = doc.splitTextToSize(limpa(r.resumo), LARG - 8);
    doc.text(txt, M + 6, y + 8);
    y += 6 + txt.length * 4;
  }

  // fotos
  const fotos = (r.fotos ?? []).slice(0, MAX_FOTOS_PDF);
  if (fotos.length) {
    y += 2;
    fotos.forEach((p, i) => {
      const x = M + 5 + (i % 4) * (FOTO_W + 3);
      const yy = y + Math.floor(i / 4) * (FOTO_H + 3);
      const w = FOTO_W;
      const hh = FOTO_H;
      const img = imgs[p];
      if (img) doc.addImage(img, "JPEG", x, yy, w, hh, undefined, "FAST");
      else {
        doc.setFillColor(241, 245, 249);
        doc.rect(x, yy, w, hh, "F");
        doc.setFontSize(7);
        doc.setTextColor(...CINZA);
        doc.text("foto indisponível", x + w / 2, yy + hh / 2, { align: "center" });
      }
    });
    const extra = (r.fotos?.length ?? 0) - fotos.length;
    if (extra > 0) {
      doc.setFontSize(7.5);
      doc.setTextColor(...CINZA);
      doc.text(`+${extra} foto(s) no sistema`, A4_W - M - 5, y0 + h - 2.5, { align: "right" });
    }
  }
  return y0 + h;
}

function rodapes(doc: JsPDF) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text("Megamix · Nova Obra · relatório gerado pelo sistema", M, A4_H - 7);
    doc.text(`Página ${i} de ${n}`, A4_W - M, A4_H - 7, { align: "right" });
  }
}
