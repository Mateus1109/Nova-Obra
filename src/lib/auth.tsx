import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Permissao, Vendedor } from "./types";

interface Cadastro {
  nome: string;
  telefone: string;
  email: string;
  senha: string;
}

interface AuthCtx {
  session: Session | null;
  profile: Vendedor | null;
  loading: boolean;
  isAdmin: boolean;
  pode: (p: Permissao) => boolean;
  entrar: (email: string, senha: string) => Promise<{ error: string | null }>;
  cadastrar: (c: Cadastro) => Promise<{ error: string | null; precisaConfirmar?: boolean }>;
  recarregarPerfil: () => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Vendedor | null>(null);
  const [loading, setLoading] = useState(true);

  const carregarProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile((data as Vendedor) ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await carregarProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s) await carregarProfile(s.user.id);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [carregarProfile]);

  // Aprovação, bloqueio ou mudança de permissões valem na hora, sem sair e entrar de novo
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`perfil-${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
        (p) => setProfile(p.new as Vendedor)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid]);

  const entrar = async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    return { error: error ? traduzErro(error.message) : null };
  };

  const cadastrar = async ({ nome, telefone, email, senha }: Cadastro) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome, telefone }, emailRedirectTo: window.location.origin },
    });
    if (error) return { error: traduzErro(error.message) };
    // Sem sessão = o projeto exige confirmação por e-mail antes do primeiro acesso
    if (!data.session) return { error: null, precisaConfirmar: true };
    return { error: null };
  };

  const recarregarPerfil = async () => {
    if (uid) await carregarProfile(uid);
  };

  const sair = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const ativo = profile?.status === "ativo";
  const isAdmin = ativo && profile?.role === "admin";
  const pode = (p: Permissao) => isAdmin || (ativo && !!profile?.permissoes?.[p]);

  return (
    <Ctx.Provider
      value={{ session, profile, loading, isAdmin, pode, entrar, cadastrar, recarregarPerfil, sair }}
    >
      {children}
    </Ctx.Provider>
  );
}

function traduzErro(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha inválidos.";
  if (/email not confirmed/i.test(msg))
    return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (/already registered|already exists/i.test(msg)) return "Já existe uma conta com esse e-mail. Use “Entrar”.";
  if (/password should be at least/i.test(msg)) return "A senha precisa ter pelo menos 8 caracteres.";
  if (/signups not allowed|signup is disabled/i.test(msg))
    return "Cadastro desativado no momento. Fale com o administrador.";
  if (/rate limit|too many/i.test(msg)) return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  if (/invalid.*email|email.*invalid/i.test(msg)) return "E-mail inválido.";
  return msg;
}
