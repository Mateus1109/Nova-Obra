// Edge Function: enviar-whatsapp
// Envia uma mensagem de WhatsApp pelo gateway WA-AKG (self-hosted).
// A URL e a chave do gateway ficam em segredos do Supabase, nunca no navegador.
// Qualquer usuário ATIVO pode enviar; a autenticação é conferida aqui.
//
// Segredos necessários (Supabase → Edge Functions → Secrets):
//   WA_AKG_URL      ex.: https://meu-gateway.com   (sem barra no fim)
//   WA_AKG_KEY      a API key do gateway (header X-API-Key)
//   WA_AKG_SESSION  o id da sessão conectada (ex.: session_01)
//
// verify_jwt = false: a autenticação/autorização é feita manualmente aqui.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

/** "(98) 98888-1234" → "5598988881234@s.whatsapp.net" (assume Brasil quando sem DDI) */
function paraJid(telefone: string): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  const numero = d.length <= 11 ? "55" + d : d;
  return `${numero}@s.whatsapp.net`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1) Identifica quem está chamando (JWT do usuário logado)
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "Não autenticado." }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "Sessão inválida." }, 401);

  // 2) Só usuário ativo envia
  const { data: perfil } = await admin.from("profiles").select("status").eq("id", userData.user.id).single();
  if (!perfil || perfil.status !== "ativo") return json({ error: "Seu acesso não está ativo." }, 403);

  // 3) Configuração do gateway
  const base = (Deno.env.get("WA_AKG_URL") ?? "").trim().replace(/\/+$/, "");
  const apiKey = (Deno.env.get("WA_AKG_KEY") ?? "").trim();
  const session = (Deno.env.get("WA_AKG_SESSION") ?? "").trim();
  if (!base || !apiKey || !session)
    return json({ error: "O gateway de WhatsApp ainda não foi configurado. Defina WA_AKG_URL, WA_AKG_KEY e WA_AKG_SESSION." }, 503);

  // 4) Dados da mensagem
  let body: { telefone?: string; jid?: string; mensagem?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }
  const mensagem = (body.mensagem ?? "").trim();
  if (!mensagem) return json({ error: "Escreva a mensagem." }, 400);
  const jid = (body.jid && body.jid.includes("@") ? body.jid : null) ?? paraJid(body.telefone ?? "");
  if (!jid) return json({ error: "Telefone inválido." }, 400);

  // 5) Chama o WA-AKG
  try {
    const resp = await fetch(`${base}/api/messages/${encodeURIComponent(session)}/${encodeURIComponent(jid)}/send`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { text: mensagem } }),
    });
    const texto = await resp.text();
    let dados: unknown = texto;
    try {
      dados = JSON.parse(texto);
    } catch {
      /* resposta não-JSON */
    }
    if (!resp.ok) return json({ error: `O gateway recusou (${resp.status}).`, detalhe: dados }, 502);
    return json({ ok: true, jid, resposta: dados });
  } catch (e) {
    return json({ error: "Não foi possível falar com o gateway de WhatsApp.", detalhe: String(e) }, 502);
  }
});
