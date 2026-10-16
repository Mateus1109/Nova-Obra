// Edge Function: receber-whatsapp
// Webhook do OpenWA: recebe os eventos "message.received" e grava a mensagem no chat do CRM.
// Cadastre esta URL no OpenWA (Dashboard → Webhooks) para a sessão conectada.
//
// Segredo opcional (recomendado):
//   OPENWA_WEBHOOK_SECRET  -> se definido, confere a assinatura HMAC-SHA256 do corpo
//
// verify_jwt = false: é um webhook externo; a validação é por assinatura.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function assinaturaOk(raw: string, header: string, segredo: string): Promise<boolean> {
  const esperado = header.replace(/^sha256=/i, "").trim().toLowerCase();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return esperado === hex;
}

// extrai o primeiro valor presente dentre vários caminhos (ex.: "data.message.body")
function pega(obj: Record<string, unknown>, caminhos: string[]): unknown {
  for (const c of caminhos) {
    let v: unknown = obj;
    for (const parte of c.split(".")) v = v && typeof v === "object" ? (v as Record<string, unknown>)[parte] : undefined;
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const soDigitos = (t: string) => t.replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const raw = await req.text();

  // Assinatura (quando configurada)
  const segredo = (Deno.env.get("OPENWA_WEBHOOK_SECRET") ?? "").trim();
  if (segredo) {
    const header =
      req.headers.get("x-webhook-signature") ||
      req.headers.get("x-signature") ||
      req.headers.get("x-hub-signature-256") ||
      req.headers.get("x-openwa-signature") ||
      "";
    if (!header || !(await assinaturaOk(raw, header, segredo))) return json({ error: "Assinatura inválida." }, 401);
  }

  let corpo: Record<string, unknown> = {};
  try {
    corpo = JSON.parse(raw);
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }

  // Aceita variações de formato: payload achatado ou aninhado em data/message/payload
  const evento = str(pega(corpo, ["event", "type", "data.event"])).toLowerCase();
  // só mensagens recebidas; ignora status/ack/connection
  if (evento && !/message/.test(evento)) return json({ ok: true, ignorado: evento });

  const d = (corpo.data ?? corpo.message ?? corpo.payload ?? corpo) as Record<string, unknown>;
  const fromMe = pega(d, ["fromMe", "key.fromMe", "self"]) === true;
  const isGroup = pega(d, ["isGroup", "group"]) === true;
  if (fromMe || isGroup) return json({ ok: true, ignorado: "fromMe/grupo" });

  const chatId = str(pega(d, ["chatId", "from", "sender", "remoteJid", "key.remoteJid", "author"]));
  const telefone = soDigitos(chatId.split("@")[0]);
  if (telefone.length < 8) return json({ ok: true, ignorado: "sem telefone" });

  const texto = str(pega(d, ["body", "text", "content", "message.text", "message.conversation", "caption"]));
  const nome = str(pega(d, ["pushName", "notifyName", "senderName", "contactName", "name"]));
  let tipo = str(pega(d, ["type", "messageType", "mediaType"])).toLowerCase();
  if (/image|imagem/.test(tipo)) tipo = "imagem";
  else if (/audio|ptt|voice/.test(tipo)) tipo = "audio";
  else if (/video/.test(tipo)) tipo = "video";
  else if (/doc|file|application/.test(tipo)) tipo = "documento";
  else tipo = "texto";
  const midiaUrl = str(pega(d, ["mediaUrl", "fileUrl", "media.url", "url"])) || null;
  const waId = str(pega(d, ["id", "messageId", "key.id", "msgId"])) || null;
  const conexao = str(pega(corpo, ["sessionId", "session", "data.sessionId", "instance"]));

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("registrar_msg_recebida", {
    p_telefone: telefone,
    p_nome: nome,
    p_texto: texto,
    p_tipo: tipo,
    p_midia_url: midiaUrl,
    p_wa_id: waId,
    p_conexao: conexao,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, conversa_id: data });
});
