import type { Obra } from "./types";

export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const dataBR = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

// Data local (yyyy-mm-dd) — evita que à noite o "hoje" vire o dia seguinte por causa do UTC
export const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const hojeISO = () => isoLocal(new Date());

// Reduz a foto para no máx. 1600px e JPEG ~75% antes do upload (economiza dados no campo)
export async function comprimirImagem(file: File, max = 1600, qualidade = 0.75): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise((ok) => canvas.toBlob((b) => ok(b ?? file), "image/jpeg", qualidade));
  } catch {
    return file;
  }
}

export const diasDesde = (iso: string | null | undefined) => {
  if (!iso) return 0;
  const d = new Date(iso);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
};

// Link de rota da obra: o link colado (Google Maps/Waze) tem prioridade sobre as coordenadas
export const rotaObra = (o: { maps_url?: string | null; latitude?: number | null; longitude?: number | null; endereco?: string | null; bairro?: string | null }) =>
  (o.maps_url && o.maps_url.trim()) || mapsLink(o.latitude, o.longitude, o.endereco || o.bairro || "");

export const mapsLink = (lat?: number | null, lng?: number | null, fallback?: string) => {
  if (lat != null && lng != null)
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    fallback || "São Luís MA"
  )}`;
};

// Extrai lat/long de um link do Google Maps colado pelo usuário
export const extrairCoords = (texto: string): { lat: number; lng: number } | null => {
  if (!texto) return null;
  const at = texto.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const q = texto.match(/(?:q=|query=|destination=)(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  const par = texto.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
  if (par) return { lat: parseFloat(par[1]), lng: parseFloat(par[2]) };
  return null;
};

// Agrupa obras por bairro e ordena (rota do dia por proximidade)
export const agruparPorProximidade = (obras: Obra[]): Obra[] => {
  const grupos = new Map<string, Obra[]>();
  for (const o of obras) {
    const k = o.bairro || "Sem bairro";
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(o);
  }
  return Array.from(grupos.values()).flat();
};

export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

// Cor do avatar/banner a partir do nome (sempre a mesma para o mesmo lead), no estilo DataCrazy
const PALETA_AVATAR = [
  { bg: "#ffe4e6", fg: "#e11d48", banner: "#fb7185" },
  { bg: "#dbeafe", fg: "#2563eb", banner: "#60a5fa" },
  { bg: "#dcfce7", fg: "#16a34a", banner: "#4ade80" },
  { bg: "#fef3c7", fg: "#d97706", banner: "#fbbf24" },
  { bg: "#ede9fe", fg: "#7c3aed", banner: "#a78bfa" },
  { bg: "#cffafe", fg: "#0891b2", banner: "#22d3ee" },
  { bg: "#fce7f3", fg: "#db2777", banner: "#f472b6" },
  { bg: "#e0e7ff", fg: "#4f46e5", banner: "#818cf8" },
];
export function corAvatar(nome: string) {
  let h = 0;
  for (const ch of nome || "?") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA_AVATAR[h % PALETA_AVATAR.length];
}

export const iniciais = (nome: string) =>
  (nome || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 1)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** "(98) 98888-1234" → "5598988881234" para links de WhatsApp */
export const linkWhatsApp = (tel?: string | null) => {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return `https://wa.me/${d.length <= 11 ? "55" + d : d}`;
};
