import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import type { Etapa, Obra, Oportunidade, Vendedor, Visita, Classificacao } from "./types";

export interface Card extends Oportunidade {
  obra: Obra;
  vendedor: Vendedor | null;
}

type VisitaComObra = Visita & { obra: Obra };

interface DataCtx {
  loading: boolean;
  cards: Card[];
  obras: Obra[];
  vendedores: Vendedor[];
  visitas: VisitaComObra[];
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

// Ecos do realtime de uma alteração feita aqui mesmo são ignorados por este tempo
const JANELA_ECO_MS = 2000;

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [visitas, setVisitas] = useState<VisitaComObra[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregou = useRef(false);
  const cardsRef = useRef<Card[]>([]);
  const vendedoresRef = useRef<Vendedor[]>([]);
  const editadosAqui = useRef(new Map<string, number>());
  const timer = useRef<number>();

  cardsRef.current = cards;
  vendedoresRef.current = vendedores;

  const avisar = (msg: string) => {
    setAviso(msg);
    window.setTimeout(() => setAviso(null), 4000);
  };

  // Só a PRIMEIRA carga mostra o spinner; as demais acontecem em segundo plano.
  const recarregar = useCallback(async () => {
    if (!session) return;
    if (!carregou.current) setLoading(true);
    const [opRes, obRes, veRes, viRes] = await Promise.all([
      supabase
        .from("oportunidades")
        .select("*, obra:obras(*), vendedor:profiles(*)")
        .order("criado_em", { ascending: false }),
      supabase.from("obras").select("*").order("criado_em", { ascending: false }),
      supabase.from("profiles").select("*").eq("role", "vendedor").order("nome"),
      supabase.from("visitas").select("*, obra:obras(*)").order("data_visita", { ascending: true }),
    ]);
    if (!opRes.error) setCards((opRes.data as Card[]) ?? []);
    if (!obRes.error) setObras((obRes.data as Obra[]) ?? []);
    if (!veRes.error) setVendedores((veRes.data as Vendedor[]) ?? []);
    if (!viRes.error) setVisitas((viRes.data as VisitaComObra[]) ?? []);
    carregou.current = true;
    setLoading(false);
  }, [session]);

  // Agrupa várias mudanças seguidas numa única sincronização silenciosa
  const agendarSync = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => recarregar(), 500);
  }, [recarregar]);

  useEffect(() => {
    if (session) recarregar();
  }, [session, recarregar]);

  const marcarEditado = (id: string) => editadosAqui.current.set(id, Date.now());
  const ehEco = (id: string) => {
    const t = editadosAqui.current.get(id);
    return t != null && Date.now() - t < JANELA_ECO_MS;
  };

  // Realtime: aplica a linha alterada direto no estado (sem recarregar a tela)
  useEffect(() => {
    if (!session) return;
    const ch = supabase
      .channel("nova-obra-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "oportunidades" }, (p) => {
        const novo = p.new as Oportunidade;
        if (ehEco(novo.id)) return;
        const atual = cardsRef.current.find((c) => c.id === novo.id);
        if (!atual) return agendarSync();
        const vendedor =
          novo.vendedor_id === atual.vendedor_id
            ? atual.vendedor
            : vendedoresRef.current.find((v) => v.id === novo.vendedor_id) ?? null;
        setCards((cs) =>
          cs.map((c) => (c.id === novo.id ? { ...c, ...novo, obra: c.obra, vendedor } : c))
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "oportunidades" }, agendarSync)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "oportunidades" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setCards((cs) => cs.filter((c) => c.id !== id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "obras" }, agendarSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "visitas" }, (p) => {
        const id = (p.new as { id?: string })?.id;
        if (id && ehEco(id)) return;
        agendarSync();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session, agendarSync]);

  // Atualiza a tela na hora e grava em segundo plano; desfaz se o banco recusar
  const atualizarOportunidade = async (id: string, mudanca: Partial<Oportunidade>) => {
    const anterior = cardsRef.current.find((c) => c.id === id);
    marcarEditado(id);
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...mudanca } : c)));
    const { error } = await supabase.from("oportunidades").update(mudanca).eq("id", id);
    if (error) {
      if (anterior) setCards((cs) => cs.map((c) => (c.id === id ? anterior : c)));
      avisar("Não foi possível salvar a alteração. Verifique sua conexão.");
    }
  };

  const moverEtapa: DataCtx["moverEtapa"] = (id, etapa, extra = {}) =>
    atualizarOportunidade(id, { etapa, ...extra });

  const setClassificacao: DataCtx["setClassificacao"] = (id, classificacao) =>
    atualizarOportunidade(id, { classificacao });

  const criarObra: DataCtx["criarObra"] = async (o, vendedorId, valorEstimado, classificacao) => {
    const payload = { ...o, criado_por: profile?.id ?? null };
    const { data: obra, error } = await supabase.from("obras").insert(payload).select().single();
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
      const anterior = visitas.find((x) => x.id === id);
      marcarEditado(id);
      setVisitas((vs) => vs.map((x) => (x.id === id ? { ...x, ...rest } : x)));
      const { error } = await supabase.from("visitas").update(rest).eq("id", id);
      if (error) {
        if (anterior) setVisitas((vs) => vs.map((x) => (x.id === id ? anterior : x)));
        avisar("Não foi possível salvar a visita.");
      }
    } else {
      const { error } = await supabase.from("visitas").insert(v);
      if (error) avisar("Não foi possível agendar a visita.");
      else await recarregar();
    }
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
      {aviso && (
        <div className="no-print fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-md rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-cardhover lg:bottom-6">
          {aviso}
        </div>
      )}
    </Ctx.Provider>
  );
}
