import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export const BUCKET_FOTOS = "relatorios-fotos";

// URLs assinadas das fotos (bucket privado), com cache para não pedir de novo a cada render
const cacheUrls = new Map<string, { url: string; expira: number }>();

export async function urlsAssinadas(paths: string[]): Promise<Record<string, string>> {
  const agora = Date.now();
  const out: Record<string, string> = {};
  const faltam: string[] = [];
  for (const p of paths) {
    const c = cacheUrls.get(p);
    if (c && c.expira > agora) out[p] = c.url;
    else faltam.push(p);
  }
  if (faltam.length) {
    const { data } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(faltam, 3600);
    for (const d of data ?? []) {
      if (d.signedUrl && d.path) {
        out[d.path] = d.signedUrl;
        cacheUrls.set(d.path, { url: d.signedUrl, expira: agora + 50 * 60 * 1000 });
      }
    }
  }
  return out;
}

export function useUrls(paths: string[]) {
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
