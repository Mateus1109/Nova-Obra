// Edge Function: criar-vendedor
// Apenas ADMIN autenticado pode chamar.
//  - padrão: cria um usuário de login (vendedor) já aprovado + profile
//  - { acao: "confirmar_email", id }: confirma o e-mail de quem se cadastrou sozinho (usado ao aprovar)
// verify_jwt = false porque a autenticação/autorização é feita manualmente aqui.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
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

  // 2) Confirma que é admin
  const { data: perfil } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", userData.user.id)
    .single();
  if (!perfil || perfil.role !== "admin" || perfil.status !== "ativo")
    return json({ error: "Apenas o diretor (admin) pode cadastrar vendedores." }, 403);

  // 3) Lê os dados do novo vendedor
  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }
  if (body.acao === "confirmar_email") {
    if (!body.id) return json({ error: "Informe o usuário." }, 400);
    const { error } = await admin.auth.admin.updateUserById(body.id, { email_confirm: true });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  const nome = (body.nome ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const senha = body.senha ?? "";
  const telefone = (body.telefone ?? "").trim();
  const zona_atuacao = (body.zona_atuacao ?? "").trim();

  if (!nome || !email || senha.length < 6)
    return json({ error: "Informe nome, e-mail e senha (mín. 6 caracteres)." }, 400);

  // 4) Cria o usuário de login (já confirmado)
  const { data: novo, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (createErr || !novo.user) {
    const msg = /already been registered/i.test(createErr?.message ?? "")
      ? "Já existe um usuário com esse e-mail."
      : createErr?.message ?? "Erro ao criar o vendedor.";
    return json({ error: msg }, 400);
  }

  // 5) Atualiza o profile (o trigger handle_new_user já criou a linha)
  const { error: upErr } = await admin
    .from("profiles")
    .update({
      nome,
      telefone,
      zona_atuacao,
      role: "vendedor",
      status: "ativo",
      permissoes: { cadastrar_obras: true, mover_funil: true },
    })
    .eq("id", novo.user.id);
  if (upErr) return json({ error: upErr.message }, 400);

  return json({ ok: true, id: novo.user.id });
});
