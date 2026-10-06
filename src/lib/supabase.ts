import { createClient } from "@supabase/supabase-js";

// A chave publishable é pública por natureza; o fallback garante que o deploy
// funcione mesmo sem variáveis de ambiente configuradas. Em produção, prefira
// definir VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no painel da Vercel.
const url =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://hdpqnzwjynsziuqhrnxq.supabase.co";
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_XHNCTRQvSxbuwQ2fC5a3ug_dPflVqZm";

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "nova-obra-auth",
  },
});
