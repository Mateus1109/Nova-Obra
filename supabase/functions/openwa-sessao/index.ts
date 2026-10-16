// Edge Function: openwa-sessao
// Liga o OpenWA ao CRM sem abrir o painel dele: status da conexão, criar/iniciar a sessão,
// QR code para escanear dentro do CRM e cadastro automático do webhook de recebimento.
// Só o administrador chama. URL/chave vêm de Configurações → WhatsApp (tabela
// integracoes_segredos) ou, se vazias, dos segredos OPENWA_URL / OPENWA_KEY / OPENWA_SESSION.
// verify_jwt = false: autenticação/autorização feitas manualmente aqui.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Cfg = { url: string; key: string; sessao: string; token: string; webhookOk: boolean };

async function lerCfg(admin: SupabaseClient): Promise<Cfg> {
  const { data } = await admin.from("integracoes_segredos").select("chave, valor");
  const m = new Map((data ?? []).map((r: { chave: string; valor: string }) => [r.chave, (r.valor ?? "").trim()]));
  let url = (m.get("openwa_url") || Deno.env.get("OPENWA_URL") || "").trim().replace(/\/+$/, "");
  if (url.endsWith("/api")) url = url.slice(0, -4);
  return {
    url,
    key: (m.get("openwa_key") || Deno.env.get("OPENWA_KEY") || "").trim(),
    sessao: (m.get("openwa_sessao") || Deno.env.get("OPENWA_SESSION") || "").trim(),
    token: m.get("openwa_webhook_token") || "",
    webhookOk: m.get("openwa_webhook_sessao") === (m.get("openwa_sessao") || ""),
  };
}
const salvar = (admin: SupabaseClient, chave: string, valor: string) =>
  admin.from("integracoes_segredos").upsert({ chave, valor, atualizado_em: new Date().toISOString() });

async function openwa(cfg: Cfg, path: string, init: RequestInit = {}) {
  const resp = await fetch(`${cfg.url}/api${path}`, {
    ...init,
    headers: { "X-API-Key": cfg.key, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const tipo = resp.headers.get("content-type") ?? "";
  if (tipo.startsWith("image/")) {
    const bytes = new Uint8Array(await resp.arrayBuffer());
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return { resp, dados: { __imagem: `data:${tipo};base64,${btoa(bin)}` } as Record<string, unknown> };
  }
  const texto = await resp.text();
  let dados: Record<string, unknown> = {};
  try { dados = JSON.parse(texto); } catch { dados = { texto }; }
  return { resp, dados };
}

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
function campo(o: Record<string, unknown>, nomes: string[]): unknown {
  const d = (o.data && typeof o.data === "object" ? o.data : {}) as Record<string, unknown>;
  for (const n of nomes) {
    if (o[n] != null && o[n] !== "") return o[n];
    if (d[n] != null && d[n] !== "") return d[n];
  }
  return undefined;
}
function resumo(dados: Record<string, unknown>) {
  const bruto = s(campo(dados, ["status", "state", "connectionStatus"])).toLowerCase();
  let status = bruto || "desconhecido";
  if (/qr/.test(bruto)) status = "qr";
  else if (/disconn|logout|logged_out|fail|stop|close|offline/.test(bruto)) status = "desconectado";
  else if (/connected|working|authenticated|open|ready|online/.test(bruto)) status = "conectado";
  else if (/start|init|connecting|loading|pairing/.test(bruto)) status = "iniciando";
  const me = campo(dados, ["me", "account", "info"]) as Record<string, unknown> | undefined;
  const telefone = s(campo(dados, ["phoneNumber", "phone", "number", "wid"]) ?? me?.id ?? me?.user ?? me?.phone).split("@")[0];
  return { status, status_bruto: bruto, telefone: telefone || null, nome: s(campo(dados, ["pushName", "pushname"]) ?? me?.name) || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supaUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!jwt) return json({ error: "Não autenticado." }, 401);
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return json({ error: "Sessão inválida." }, 401);
  const { data: perfil } = await admin.from("profiles").select("role, status").eq("id", u.user.id).single();
  if (!perfil || perfil.role !== "admin" || perfil.status !== "ativo") return json({ error: "Só o administrador gerencia a conexão." }, 403);

  let body: { acao?: string } = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const acao = body.acao ?? "status";

  const cfg = await lerCfg(admin);
  if (!cfg.url || !cfg.key) return json({ configurado: false, status: "sem_config" });

  try {
    // ---- status ----
    const lerStatus = async () => {
      if (!cfg.sessao) return { configurado: true, sessao: null, status: "sem_sessao" };
      const { resp, dados } = await openwa(cfg, `/sessions/${encodeURIComponent(cfg.sessao)}`);
      if (resp.status === 404) return { configurado: true, sessao: cfg.sessao, status: "sem_sessao" };
      if (resp.status === 401 || resp.status === 403) return { configurado: true, sessao: cfg.sessao, status: "chave_invalida" };
      if (!resp.ok) return { configurado: true, sessao: cfg.sessao, status: "erro", detalhe: dados };
      return { configurado: true, sessao: cfg.sessao, webhook: cfg.webhookOk, ...resumo(dados) };
    };

    if (acao === "status") return json(await lerStatus());

    if (acao === "conectar") {
      // cria a sessão se ainda não existe
      let existe = false;
      if (cfg.sessao) {
        const { resp } = await openwa(cfg, `/sessions/${encodeURIComponent(cfg.sessao)}`);
        if (resp.status === 401 || resp.status === 403) return json({ error: "A chave do OpenWA foi recusada. Confira a API key." }, 400);
        existe = resp.ok;
      }
      if (!existe) {
        const { resp, dados } = await openwa(cfg, "/sessions", { method: "POST", body: JSON.stringify({ name: "megamix-crm" }) });
        if (!resp.ok) return json({ error: `Não foi possível criar a sessão no OpenWA (${resp.status}).`, detalhe: dados }, 502);
        const id = s(campo(dados, ["id", "sessionId", "name"]));
        if (!id) return json({ error: "O OpenWA não devolveu o id da sessão.", detalhe: dados }, 502);
        cfg.sessao = id;
        cfg.webhookOk = false;
        await salvar(admin, "openwa_sessao", id);
      }
      // inicia (se já estiver iniciada o OpenWA só responde que está)
      await openwa(cfg, `/sessions/${encodeURIComponent(cfg.sessao)}/start`, { method: "POST" });

      // webhook de recebimento apontando para o CRM, protegido por token na URL
      if (!cfg.webhookOk) {
        let token = cfg.token;
        if (!token) {
          token = crypto.randomUUID().replace(/-/g, "");
          await salvar(admin, "openwa_webhook_token", token);
        }
        const alvo = `${supaUrl}/functions/v1/receber-whatsapp?token=${token}`;
        const { resp } = await openwa(cfg, `/sessions/${encodeURIComponent(cfg.sessao)}/webhooks`, {
          method: "POST",
          body: JSON.stringify({ url: alvo, events: ["message.received"] }),
        });
        if (resp.ok) await salvar(admin, "openwa_webhook_sessao", cfg.sessao);
        cfg.webhookOk = resp.ok;
      }
      return json(await lerStatus());
    }

    if (acao === "qr") {
      if (!cfg.sessao) return json({ qr: null, status: "sem_sessao" });
      const { resp, dados } = await openwa(cfg, `/sessions/${encodeURIComponent(cfg.sessao)}/qr`);
      if (!resp.ok) return json({ qr: null, detalhe: dados });
      const img = s(dados.__imagem ?? campo(dados, ["qrImage", "image", "base64", "qrCodeImage"]));
      if (img.startsWith("data:image")) return json({ qr_imagem: img });
      if (img && /^[A-Za-z0-9+/=]+$/.test(img) && img.length > 200) return json({ qr_imagem: `data:image/png;base64,${img}` });
      const txt = s(campo(dados, ["qr", "qrCode", "code", "value"]));
      if (txt.startsWith("data:image")) return json({ qr_imagem: txt });
      return json(txt ? { qr_texto: txt } : { qr: null, detalhe: dados });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ error: "Não foi possível falar com o OpenWA. Confira a URL e se ele está no ar.", detalhe: String(e) }, 502);
  }
});
