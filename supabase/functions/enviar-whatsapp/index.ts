// Edge Function: enviar-whatsapp
// Envia WhatsApp por um dos provedores escolhidos em Configurações (tabela config):
//   - "openwa"  : gateway self-hosted OpenWA (API não oficial)
//   - "oficial" : WhatsApp Business Cloud API (Meta, oficial)
// As URLs/chaves ficam em segredos do Supabase, nunca no navegador.
// Qualquer usuário ATIVO pode enviar; a autenticação é conferida aqui.
//
// Segredos:
//   OpenWA:  OPENWA_URL, OPENWA_KEY, OPENWA_SESSION
//   Oficial: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
// verify_jwt = false: autenticação/autorização feitas manualmente aqui.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

/** "(98) 98888-1234" → "5598988881234" (assume Brasil quando vem sem DDI) */
function soNumero(telefone: string): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return d.length <= 11 ? "55" + d : d;
}

async function viaOpenWA(numero: string, mensagem: string): Promise<{ ok: boolean; status: number; dados: unknown; faltaConfig?: boolean }> {
  let base = (Deno.env.get("OPENWA_URL") ?? "").trim().replace(/\/+$/, "");
  if (base.endsWith("/api")) base = base.slice(0, -4);
  const apiKey = (Deno.env.get("OPENWA_KEY") ?? "").trim();
  const session = (Deno.env.get("OPENWA_SESSION") ?? "").trim();
  if (!base || !apiKey || !session) return { ok: false, status: 503, dados: null, faltaConfig: true };
  const resp = await fetch(`${base}/api/sessions/${encodeURIComponent(session)}/messages/send-text`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ chatId: `${numero}@c.us`, text: mensagem }),
  });
  const texto = await resp.text();
  let dados: unknown = texto;
  try { dados = JSON.parse(texto); } catch { /* não-JSON */ }
  return { ok: resp.ok, status: resp.status, dados };
}

async function viaOficial(numero: string, mensagem: string): Promise<{ ok: boolean; status: number; dados: unknown; faltaConfig?: boolean }> {
  const token = (Deno.env.get("WHATSAPP_TOKEN") ?? "").trim();
  const phoneId = (Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "").trim();
  if (!token || !phoneId) return { ok: false, status: 503, dados: null, faltaConfig: true };
  const resp = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: numero, type: "text", text: { preview_url: false, body: mensagem } }),
  });
  const texto = await resp.text();
  let dados: unknown = texto;
  try { dados = JSON.parse(texto); } catch { /* não-JSON */ }
  return { ok: resp.ok, status: resp.status, dados };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "Não autenticado." }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "Sessão inválida." }, 401);
  const { data: perfil } = await admin.from("profiles").select("status").eq("id", userData.user.id).single();
  if (!perfil || perfil.status !== "ativo") return json({ error: "Seu acesso não está ativo." }, 403);

  let body: { telefone?: string; mensagem?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido." }, 400); }
  const mensagem = (body.mensagem ?? "").trim();
  if (!mensagem) return json({ error: "Escreva a mensagem." }, 400);
  const numero = soNumero(body.telefone ?? "");
  if (!numero) return json({ error: "Telefone inválido." }, 400);

  // provedor escolhido em Configurações (ou override por env)
  const { data: cfg } = await admin.from("config").select("valor").eq("chave", "whatsapp_provedor").single();
  const provedor = ((Deno.env.get("WHATSAPP_PROVEDOR") ?? cfg?.valor ?? "openwa") as string).trim().toLowerCase();

  const r = provedor === "oficial" ? await viaOficial(numero, mensagem) : await viaOpenWA(numero, mensagem);
  if (r.faltaConfig)
    return json({ error: provedor === "oficial"
      ? "WhatsApp oficial ainda não configurado. Defina WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID."
      : "OpenWA ainda não configurado. Defina OPENWA_URL, OPENWA_KEY e OPENWA_SESSION." }, 503);
  if (!r.ok) return json({ error: `O provedor (${provedor}) recusou (${r.status}).`, detalhe: r.dados }, 502);
  return json({ ok: true, provedor, resposta: r.dados });
});
