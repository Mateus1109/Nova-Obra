import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import type {
  Etapa,
  Obra,
  Oportunidade,
  Vendedor,
  Visita,
  Classificacao,
} from "./types";

export interface Card extends Oportunidade {
  obra: Obra;
  vendedor: Vendedor | null;
}

interface DataCtx {
  loading: boolean;
  cards: Card[];
  obras: Obra[];
  vendedores: Vendedor[];
  visitas: (Visita & { obra: Obra })[];
  recarregar: () => Promise<void>;
  moverEtapa: (id: string, etapa: Etapa, extra?: Partial<Oportunidade>) => Promise<void>;
  setClassificacao: (id: string, c: Classificacao) => Promise<void>;
  criarObra: (
    o: Partial<Obra>,
    vendedorId: string,
    valorEstimado: number,
    classificacao: Classificacao
  ) => Promise<{ error: string | null }>;
  salvarVisita: (v: Partial<Visita> & { id?: string }) => Promise<void>;
}

const Ctx = createContext<DataCtx>(null!);
export const useData = () => useContext(Ctx);

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [visitas, setVisitas] = useState<(Visita & { obra: Obra })[]>([]);

  const recarregar = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const [opRes, obRes, veRes, viRes] = await Promise.all([
      supabase
        .from("oportunidades")
        .select("*, obra:obras(*), vendedor:profiles(*)")
        .order("criado_em", { ascending: false }),
      supabase.from("obras").select("*").order("criado_em", { ascending: false }),
      supabase.from("profiles").select("*").eq("role", "vendedor").order("nome"),
      supabase
        .from("visitas")
        .select("*, obra:obras(*)")
        .order("data_visita", { ascending: true }),
    ]);
    setCards((opRes.data as Card[]) ?? []);
    setObras((obRes.data as Obra[]) ?? []);
    setVendedores((veRes.data as Vendedor[]) ?? []);
    setVisitas((viRes.data as (Visita & { obra: Obra })[]) ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) recarregar();
  }, [session, recarregar]);

  // Realtime: qualquer mudança no funil/obras/visitas recarrega
  useEffect(() => {
    if (!session) return;
    const ch = supabase
      .channel("nova-obra-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "oportunidades" }, () =>
        recarregar()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "obras" }, () => recarregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "visitas" }, () =>
        recarregar()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session, recarregar]);

  const moverEtapa: DataCtx["moverEtapa"] = async (id, etapa, extra = {}) => {
    // otimista
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, etapa, ...extra } : c)));
    await supabase.from("oportunidades").update({ etapa, ...extra }).eq("id", id);
  };

  const setClassificacao: DataCtx["setClassificacao"] = async (id, classificacao) => {
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, classificacao } : c)));
    await supabase.from("oportunidades").update({ classificacao }).eq("id", id);
  };

  const criarObra: DataCtx["criarObra"] = async (o, vendedorId, valorEstimado, classificacao) => {
    const payload = { ...o, criado_por: profile?.id ?? null };
    const { data: obra, error } = await supabase
      .from("obras")
      .insert(payload)
      .select()
      .single();
    if (error || !obra) return { error: error?.message ?? "Erro ao salvar a obra." };
    const { error: e2 } = await supabase.from("oportunidades").insert({
      obra_id: obra.id,
      vendedor_id: vendedorId || profile?.id,
      etapa: "qualificacao",
      classificacao,
      valor_estimado: valorEstimado,
    });
    if (e2) return { error: e2.message };
    await recarregar();
    return { error: null };
  };

  const salvarVisita: DataCtx["salvarVisita"] = async (v) => {
    if (v.id) {
      const { id, ...rest } = v;
      await supabase.from("visitas").update(rest).eq("id", id);
    } else {
      await supabase.from("visitas").insert(v);
    }
    await recarregar();
  };

  return (
    <Ctx.Provider
      value={{
        loading,
        cards,
        obras,
        vendedores,
        visitas,
        recarregar,
        moverEtapa,
        setClassificacao,
        criarObra,
        salvarVisita,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
