import type { Obra } from "./types";

export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export const dataBR = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export const diasDesde = (iso: string | null | undefined) => {
  if (!iso) return 0;
  const d = new Date(iso);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
};

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
