// Edge Function: enviar-whatsapp
// Envia uma mensagem de WhatsApp pelo gateway OpenWA (self-hosted).
// A URL e a chave do gateway ficam em segredos do Supabase, nunca no navegador.
// Qualquer usuário ATIVO pode enviar; a autenticação é conferida aqui.
//
// Segredos necessários (Supabase → Edge Functions → Secrets):
//   OPENWA_URL      ex.: http://meu-host:2785   (origem do OpenWA, sem barra no fim)
//   OPENWA_KEY      a API key do OpenWA (header X-API-Key)
//   OPENWA_SESSION  o id da sessão conectada (ex.: default)
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

/** "(98) 98888-1234" → "5598988881234@c.us" (assume Brasil quando vem sem DDI) */
function paraChatId(telefone: string): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  const numero = d.length <= 11 ? "55" + d : d;
  return `${numero}@c.us`;
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

  // 3) Configuração do gateway OpenWA
  let base = (Deno.env.get("OPENWA_URL") ?? "").trim().replace(/\/+$/, "");
  if (base.endsWith("/api")) base = base.slice(0, -4); // aceita URL com ou sem /api no fim
  const apiKey = (Deno.env.get("OPENWA_KEY") ?? "").trim();
  const session = (Deno.env.get("OPENWA_SESSION") ?? "").trim();
  if (!base || !apiKey || !session)
    return json({ error: "O gateway de WhatsApp ainda não foi configurado. Defina OPENWA_URL, OPENWA_KEY e OPENWA_SESSION." }, 503);

  // 4) Dados da mensagem
  let body: { telefone?: string; chatId?: string; mensagem?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }
  const mensagem = (body.mensagem ?? "").trim();
  if (!mensagem) return json({ error: "Escreva a mensagem." }, 400);
  const chatId = (body.chatId && body.chatId.includes("@") ? body.chatId : null) ?? paraChatId(body.telefone ?? "");
  if (!chatId) return json({ error: "Telefone inválido." }, 400);

  // 5) Chama o OpenWA: POST /api/sessions/{session}/messages/send-text  { chatId, text }
  try {
    const resp = await fetch(`${base}/api/sessions/${encodeURIComponent(session)}/messages/send-text`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, text: mensagem }),
    });
    const texto = await resp.text();
    let dados: unknown = texto;
    try {
      dados = JSON.parse(texto);
    } catch {
      /* resposta não-JSON */
    }
    if (!resp.ok) return json({ error: `O gateway recusou (${resp.status}).`, detalhe: dados }, 502);
    return json({ ok: true, chatId, resposta: dados });
  } catch (e) {
    return json({ error: "Não foi possível falar com o gateway de WhatsApp.", detalhe: String(e) }, 502);
  }
});
