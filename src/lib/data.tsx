import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import {
  ORIGENS,
  SEGMENTOS,
  type Atividade,
  type CampoAdicional,
  type Classificacao,
  type Etapa,
  type Lead,
  type MotivoPerda,
  type NomeLista,
  type Obra,
  type OpcaoLista,
  type Oportunidade,
  type Pipeline,
  type PipelineMembro,
  type TagConfig,
  type TipoAtividadeConfig,
  type Vendedor,
} from "./types";

export interface Card extends Oportunidade {
  obra: Obra | null;
  vendedor: Vendedor | null;
  lead: Lead | null;
}

/** Nome que aparece no card: o lead (construtora/cliente) ou, sem lead, a obra */
export const tituloCard = (c: Card) => c.lead?.nome_exibicao || c.lead?.nome || c.obra?.nome_obra || "Sem nome";

export interface NovoNegocio {
  lead_id: string | null;
  obra_id?: string | null;
  etapa_id: string;
  valor_estimado?: number;
  vendedor_id?: string | null;
  classificacao?: Classificacao;
}

/** Tabelas da tela Configurações (lista simples, só o administrador altera) */
export interface LinhasConfig {
  motivos_perda: MotivoPerda;
  tags: TagConfig;
  tipos_atividade: TipoAtividadeConfig;
  listas_opcoes: OpcaoLista;
  campos_adicionais: CampoAdicional;
}
export type TabelaConfig = keyof LinhasConfig;

interface DataCtx {
  loading: boolean;
  /* ---- Configurações ---- */
  motivosPerda: MotivoPerda[];
  tagsConfig: TagConfig[];
  tiposAtividade: TipoAtividadeConfig[];
  listas: OpcaoLista[];
  camposAdicionais: CampoAdicional[];
  pipelineMembros: PipelineMembro[];
  /** valores da lista (origem/segmento) configurada; cai no padrão se ainda vazia */
  opcoesLista: (lista: NomeLista) => string[];
  /** cor configurada da tag (ou o azul padrão) */
  corTag: (nome: string) => string;
  salvarConfig: <T extends TabelaConfig>(tabela: T, linha: Partial<LinhasConfig[T]>) => Promise<boolean>;
  excluirConfig: (tabela: TabelaConfig, id: string) => Promise<boolean>;
  /* ---- Status do negócio (ações individuais e em massa) ---- */
  ganharNegocios: (ids: string[]) => Promise<boolean>;
  perderNegocios: (ids: string[], motivoId: string | null, descricao: string) => Promise<boolean>;
  restaurarStatus: (ids: string[]) => Promise<boolean>;
  /** envia para a lixeira (dá para restaurar em Configurações → Lixeira) */
  excluirNegocios: (ids: string[]) => Promise<boolean>;
  restaurarDaLixeira: (ids: string[]) => Promise<boolean>;
  excluirDefinitivo: (ids: string[]) => Promise<boolean>;
  moverNegocios: (ids: string[], etapaId: string) => Promise<boolean>;
  /* ---- Pipeline ---- */
  duplicarPipeline: (id: string, nome: string) => Promise<string | null>;
  salvarPermissoesPipeline: (id: string, restrito: boolean, usuarioIds: string[]) => Promise<boolean>;
  pipelines: Pipeline[];
  etapas: Etapa[];
  cards: Card[];
  obras: Obra[];
  leads: Lead[];
  atividades: Atividade[];
  vendedores: Vendedor[];
  avisar: (msg: string, tipo?: "erro" | "ok") => void;
  recarregar: () => Promise<void>;
  moverEtapa: (id: string, etapaId: string, extra?: Partial<Oportunidade>) => Promise<void>;
  setClassificacao: (id: string, c: Classificacao) => Promise<void>;
  atualizarOportunidade: (id: string, mudanca: Partial<Oportunidade>) => Promise<void>;
  setResponsavel: (id: string, vendedorId: string | null) => Promise<void>;
  atualizarObra: (obraId: string, mudanca: Partial<Obra>) => Promise<boolean>;
  criarEtapa: (nome: string, pipelineId: string) => Promise<void>;
  criarPipeline: (nome: string, descricao: string) => Promise<string | null>;
  atualizarPipeline: (id: string, mudanca: Partial<Pipeline>) => Promise<void>;
  excluirPipeline: (id: string) => Promise<boolean>;
  criarLead: (l: Partial<Lead>) => Promise<Lead | null>;
  atualizarLead: (id: string, mudanca: Partial<Lead>) => Promise<boolean>;
  criarNegocio: (n: NovoNegocio) => Promise<string | null>;
  criarAtividade: (a: Partial<Atividade>) => Promise<boolean>;
  atualizarAtividade: (id: string, mudanca: Partial<Atividade>) => Promise<void>;
  atualizarEtapa: (id: string, mudanca: Partial<Etapa>) => Promise<void>;
  moverColuna: (id: string, direcao: -1 | 1) => Promise<void>;
  excluirEtapa: (id: string, destinoId: string | null) => Promise<void>;
  moverTodosDaColuna: (origemId: string, destinoId: string) => Promise<boolean>;
}

const Ctx = createContext<DataCtx>(null!);
export const useData = () => useContext(Ctx);

// Ecos do realtime de uma alteração feita aqui mesmo são ignorados por este tempo
const JANELA_ECO_MS = 2000;

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [aviso, setAviso] = useState<{ msg: string; tipo: "erro" | "ok" } | null>(null);
  const [motivosPerda, setMotivosPerda] = useState<MotivoPerda[]>([]);
  const [tagsConfig, setTagsConfig] = useState<TagConfig[]>([]);
  const [tiposAtividade, setTiposAtividade] = useState<TipoAtividadeConfig[]>([]);
  const [listas, setListas] = useState<OpcaoLista[]>([]);
  const [camposAdicionais, setCamposAdicionais] = useState<CampoAdicional[]>([]);
  const [pipelineMembros, setPipelineMembros] = useState<PipelineMembro[]>([]);

  const carregou = useRef(false);
  const cardsRef = useRef<Card[]>([]);
  const etapasRef = useRef<Etapa[]>([]);
  const pipelinesRef = useRef<Pipeline[]>([]);
  const vendedoresRef = useRef<Vendedor[]>([]);
  const editadosAqui = useRef(new Map<string, number>());
  const timer = useRef<number>();

  cardsRef.current = cards;
  etapasRef.current = etapas;
  pipelinesRef.current = pipelines;
  vendedoresRef.current = vendedores;

  const avisoTimer = useRef<number>();
  const avisar = (msg: string, tipo: "erro" | "ok" = "erro") => {
    setAviso({ msg, tipo });
    window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), 4000);
  };

  // Só a PRIMEIRA carga mostra o spinner; as demais acontecem em segundo plano.
  const recarregar = useCallback(async () => {
    if (!session) return;
    if (!carregou.current) setLoading(true);
    const [piRes, etRes, opRes, obRes, leRes, atRes, veRes, moRes, tgRes, taRes, liRes, caRes, pmRes] = await Promise.all([
      supabase.from("pipelines").select("*").order("ordem").order("criado_em"),
      supabase.from("etapas").select("*").order("ordem"),
      supabase
        .from("oportunidades")
        .select("*, obra:obras(*), vendedor:profiles(*), lead:leads(*)")
        .is("excluido_em", null)
        .order("criado_em", { ascending: false }),
      supabase.from("obras").select("*").order("criado_em", { ascending: false }),
      supabase.from("leads").select("*").order("nome"),
      supabase.from("atividades").select("*").eq("concluida", false).order("data_hora", { ascending: true, nullsFirst: false }),
      supabase.from("profiles").select("*").eq("role", "vendedor").eq("status", "ativo").order("nome"),
      supabase.from("motivos_perda").select("*").order("ordem").order("criado_em"),
      supabase.from("tags").select("*").order("nome"),
      supabase.from("tipos_atividade").select("*").order("ordem").order("criado_em"),
      supabase.from("listas_opcoes").select("*").order("ordem").order("valor"),
      supabase.from("campos_adicionais").select("*").order("ordem").order("criado_em"),
      supabase.from("pipeline_membros").select("*"),
    ]);
    if (!piRes.error) setPipelines((piRes.data as Pipeline[]) ?? []);
    if (!etRes.error) setEtapas((etRes.data as Etapa[]) ?? []);
    if (!opRes.error) setCards((opRes.data as Card[]) ?? []);
    if (!obRes.error) setObras((obRes.data as Obra[]) ?? []);
    if (!leRes.error) setLeads((leRes.data as Lead[]) ?? []);
    if (!atRes.error) setAtividades((atRes.data as Atividade[]) ?? []);
    if (!veRes.error) setVendedores((veRes.data as Vendedor[]) ?? []);
    if (!moRes.error) setMotivosPerda((moRes.data as MotivoPerda[]) ?? []);
    if (!tgRes.error) setTagsConfig((tgRes.data as TagConfig[]) ?? []);
    if (!taRes.error) setTiposAtividade((taRes.data as TipoAtividadeConfig[]) ?? []);
    if (!liRes.error) setListas((liRes.data as OpcaoLista[]) ?? []);
    if (!caRes.error) setCamposAdicionais((caRes.data as CampoAdicional[]) ?? []);
    if (!pmRes.error) setPipelineMembros((pmRes.data as PipelineMembro[]) ?? []);
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
        if (novo.excluido_em) {
          setCards((cs) => cs.filter((c) => c.id !== novo.id));
          return;
        }
        const atual = cardsRef.current.find((c) => c.id === novo.id);
        if (!atual) return agendarSync();
        const vendedor =
          novo.vendedor_id === atual.vendedor_id
            ? atual.vendedor
            : vendedoresRef.current.find((v) => v.id === novo.vendedor_id) ?? null;
        setCards((cs) =>
          cs.map((c) => (c.id === novo.id ? { ...c, ...novo, obra: c.obra, lead: c.lead, vendedor } : c))
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "oportunidades" }, agendarSync)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "oportunidades" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setCards((cs) => cs.filter((c) => c.id !== id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "obras" }, agendarSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "etapas" }, agendarSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "pipelines" }, agendarSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, agendarSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "atividades" }, agendarSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "motivos_perda" }, agendarSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "tags" }, agendarSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "tipos_atividade" }, agendarSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "listas_opcoes" }, agendarSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "campos_adicionais" }, agendarSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_membros" }, agendarSync)
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

  const moverEtapa: DataCtx["moverEtapa"] = (id, etapaId, extra = {}) =>
    atualizarOportunidade(id, { etapa_id: etapaId, ...extra });

  const setResponsavel: DataCtx["setResponsavel"] = async (id, vendedorId) => {
    const vendedor = vendedoresRef.current.find((v) => v.id === vendedorId) ?? null;
    marcarEditado(id);
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, vendedor_id: vendedorId, vendedor } : c)));
    const { error } = await supabase.from("oportunidades").update({ vendedor_id: vendedorId }).eq("id", id);
    if (error) {
      avisar("Não foi possível trocar o responsável.");
      agendarSync();
    }
  };

  const atualizarObra: DataCtx["atualizarObra"] = async (obraId, mudanca) => {
    const aplicar = (o: Obra) => (o.id === obraId ? { ...o, ...mudanca } : o);
    setObras((os) => os.map(aplicar));
    setCards((cs) => cs.map((c) => (c.obra && c.obra_id === obraId ? { ...c, obra: aplicar(c.obra) } : c)));
    const { error } = await supabase.from("obras").update(mudanca).eq("id", obraId);
    if (error) {
      avisar("Não foi possível salvar os dados da obra.");
      agendarSync();
      return false;
    }
    return true;
  };

  /* ---------- Colunas do funil (só diretor) ---------- */

  // `lista` = colunas de UM pipeline, já na ordem desejada
  const gravarOrdem = async (lista: Etapa[]) => {
    const nova = lista.map((e, i) => ({ ...e, ordem: i + 1 }));
    const mudou = nova.filter((e) => etapasRef.current.find((x) => x.id === e.id)?.ordem !== e.ordem);
    const pid = lista[0]?.pipeline_id;
    setEtapas((es) => [...es.filter((e) => e.pipeline_id !== pid), ...nova].sort((a, b) => a.ordem - b.ordem));
    const res = await Promise.all(
      mudou.map((e) => supabase.from("etapas").update({ ordem: e.ordem }).eq("id", e.id))
    );
    if (res.some((r) => r.error)) {
      avisar("Não foi possível reordenar as colunas.");
      agendarSync();
    }
  };

  const criarEtapa: DataCtx["criarEtapa"] = async (nome, pipelineId) => {
    const lista = etapasRef.current.filter((e) => e.pipeline_id === pipelineId);
    // nova coluna entra antes de "Ganho"/"Perdido"
    const pos = lista.findIndex((e) => e.tipo !== "aberta");
    const ordemTemp = (lista[lista.length - 1]?.ordem ?? 0) + 1;
    const { data, error } = await supabase
      .from("etapas")
      .insert({ nome, cor: "#3385FF", ordem: ordemTemp, tipo: "aberta", pipeline_id: pipelineId })
      .select()
      .single();
    if (error || !data) return avisar("Não foi possível criar a coluna.");
    lista.splice(pos === -1 ? lista.length : pos, 0, data as Etapa);
    await gravarOrdem(lista);
  };

  const atualizarEtapa: DataCtx["atualizarEtapa"] = async (id, mudanca) => {
    setEtapas((es) => es.map((e) => (e.id === id ? { ...e, ...mudanca } : e)));
    const { error } = await supabase.from("etapas").update(mudanca).eq("id", id);
    if (error) {
      avisar("Não foi possível salvar a coluna.");
      agendarSync();
    }
  };

  const moverColuna: DataCtx["moverColuna"] = async (id, direcao) => {
    const pid = etapasRef.current.find((e) => e.id === id)?.pipeline_id;
    const lista = etapasRef.current.filter((e) => e.pipeline_id === pid);
    const i = lista.findIndex((e) => e.id === id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    await gravarOrdem(lista);
  };

  const moverTodosDaColuna: DataCtx["moverTodosDaColuna"] = async (origemId, destinoId) => {
    const anteriores = cardsRef.current.filter((c) => c.etapa_id === origemId);
    if (!anteriores.length || origemId === destinoId) return true;
    anteriores.forEach((c) => marcarEditado(c.id));
    setCards((cs) => cs.map((c) => (c.etapa_id === origemId ? { ...c, etapa_id: destinoId } : c)));
    const { error } = await supabase.from("oportunidades").update({ etapa_id: destinoId }).eq("etapa_id", origemId);
    if (error) {
      avisar("Não foi possível mover os negócios.");
      agendarSync();
      return false;
    }
    avisar(`${anteriores.length} negócio(s) movido(s).`, "ok");
    return true;
  };

  const excluirEtapa: DataCtx["excluirEtapa"] = async (id, destinoId) => {
    const temCards = cardsRef.current.some((c) => c.etapa_id === id);
    if (temCards) {
      if (!destinoId) return avisar("Escolha para qual coluna mover os cards.");
      setCards((cs) => cs.map((c) => (c.etapa_id === id ? { ...c, etapa_id: destinoId } : c)));
      const { error } = await supabase.from("oportunidades").update({ etapa_id: destinoId }).eq("etapa_id", id);
      if (error) {
        avisar("Não foi possível mover os cards da coluna.");
        return agendarSync();
      }
    }
    setEtapas((es) => es.filter((e) => e.id !== id));
    const { error } = await supabase.from("etapas").delete().eq("id", id);
    if (error) {
      avisar("Não foi possível excluir a coluna.");
      agendarSync();
    }
  };

  const setClassificacao: DataCtx["setClassificacao"] = (id, classificacao) =>
    atualizarOportunidade(id, { classificacao });

  /* ---------- Pipelines ---------- */

  const criarPipeline: DataCtx["criarPipeline"] = async (nome, descricao) => {
    const ordem = (pipelinesRef.current[pipelinesRef.current.length - 1]?.ordem ?? 0) + 1;
    const { data, error } = await supabase.from("pipelines").insert({ nome, descricao, ordem }).select().single();
    if (error || !data) {
      avisar("Não foi possível criar o pipeline.");
      return null;
    }
    // colunas iniciais, como no funil básico
    const colunas = [
      { nome: "Novo", cor: "#64748b", tipo: "aberta" },
      { nome: "Em andamento", cor: "#3385FF", tipo: "aberta" },
      { nome: "Ganho", cor: "#22c55e", tipo: "ganho" },
      { nome: "Perdido", cor: "#ef4444", tipo: "perdido" },
    ].map((c, i) => ({ ...c, ordem: i + 1, pipeline_id: data.id }));
    await supabase.from("etapas").insert(colunas);
    await recarregar();
    return data.id as string;
  };

  const atualizarPipeline: DataCtx["atualizarPipeline"] = async (id, mudanca) => {
    setPipelines((ps) => ps.map((p) => (p.id === id ? { ...p, ...mudanca } : p)));
    const { error } = await supabase.from("pipelines").update(mudanca).eq("id", id);
    if (error) {
      avisar("Não foi possível salvar o pipeline.");
      agendarSync();
    }
  };

  const excluirPipeline: DataCtx["excluirPipeline"] = async (id) => {
    const colunas = new Set(etapasRef.current.filter((e) => e.pipeline_id === id).map((e) => e.id));
    if (cardsRef.current.some((c) => colunas.has(c.etapa_id))) {
      avisar("Mova ou exclua os negócios deste pipeline antes de apagá-lo.");
      return false;
    }
    const { error } = await supabase.from("pipelines").delete().eq("id", id);
    if (error) {
      avisar("Não foi possível excluir o pipeline.");
      return false;
    }
    await recarregar();
    return true;
  };

  /* ---------- Leads, negócios e atividades ---------- */

  const criarLead: DataCtx["criarLead"] = async (l) => {
    const { data, error } = await supabase
      .from("leads")
      .insert({ responsavel_id: profile?.id ?? null, ...l })
      .select()
      .single();
    if (error || !data) {
      avisar("Não foi possível criar o lead.");
      return null;
    }
    setLeads((ls) => [...ls, data as Lead].sort((a, b) => a.nome.localeCompare(b.nome)));
    return data as Lead;
  };

  const atualizarLead: DataCtx["atualizarLead"] = async (id, mudanca) => {
    const aplicar = (l: Lead) => (l.id === id ? { ...l, ...mudanca } : l);
    setLeads((ls) => ls.map(aplicar));
    setCards((cs) => cs.map((c) => (c.lead?.id === id ? { ...c, lead: aplicar(c.lead) } : c)));
    const { error } = await supabase.from("leads").update(mudanca).eq("id", id);
    if (error) {
      avisar("Não foi possível salvar o lead.");
      agendarSync();
      return false;
    }
    return true;
  };

  const criarNegocio: DataCtx["criarNegocio"] = async (n) => {
    const { data, error } = await supabase
      .from("oportunidades")
      .insert({
        lead_id: n.lead_id,
        obra_id: n.obra_id ?? null,
        etapa_id: n.etapa_id,
        valor_estimado: n.valor_estimado ?? 0,
        vendedor_id: n.vendedor_id === undefined ? profile?.id ?? null : n.vendedor_id,
        classificacao: n.classificacao ?? "morno",
      })
      .select("id")
      .single();
    if (error || !data) {
      avisar("Não foi possível criar o negócio.");
      return null;
    }
    await recarregar();
    return data.id as string;
  };

  const criarAtividade: DataCtx["criarAtividade"] = async (a) => {
    const { data, error } = await supabase
      .from("atividades")
      .insert({ responsavel_id: profile?.id ?? null, ...a })
      .select()
      .single();
    if (error || !data) {
      avisar("Não foi possível criar a atividade.");
      return false;
    }
    setAtividades((as) =>
      [...as, data as Atividade].sort((x, y) => (x.data_hora ?? "9").localeCompare(y.data_hora ?? "9"))
    );
    return true;
  };

  const atualizarAtividade: DataCtx["atualizarAtividade"] = async (id, mudanca) => {
    setAtividades((as) =>
      mudanca.concluida ? as.filter((a) => a.id !== id) : as.map((a) => (a.id === id ? { ...a, ...mudanca } : a))
    );
    const { error } = await supabase.from("atividades").update(mudanca).eq("id", id);
    if (error) {
      avisar("Não foi possível salvar a atividade.");
      agendarSync();
    }
  };



  /* ---------- Configurações ---------- */

  const opcoesLista: DataCtx["opcoesLista"] = (lista) => {
    const v = listas.filter((o) => o.lista === lista).map((o) => o.valor);
    return v.length ? v : lista === "origem" ? ORIGENS : SEGMENTOS;
  };

  const corTag: DataCtx["corTag"] = (nome) =>
    tagsConfig.find((t) => t.nome.toLowerCase() === nome.toLowerCase())?.cor ?? "#3385FF";

  const salvarConfig: DataCtx["salvarConfig"] = async (tabela, linha) => {
    const { id, criado_em, ...resto } = linha as Record<string, unknown>;
    void criado_em;
    const { error } = id
      ? await supabase.from(tabela).update(resto).eq("id", id as string)
      : await supabase.from(tabela).insert(resto);
    if (error) {
      avisar(/duplicate|unique/i.test(error.message) ? "Já existe um item com esse nome." : "Não foi possível salvar.");
      return false;
    }
    await recarregar();
    return true;
  };

  const excluirConfig: DataCtx["excluirConfig"] = async (tabela, id) => {
    const { error } = await supabase.from(tabela).delete().eq("id", id);
    if (error) {
      avisar("Não foi possível excluir.");
      return false;
    }
    await recarregar();
    return true;
  };

  /* ---------- Status e ações em massa ---------- */

  // Aplica a mudança na tela na hora e grava tudo de uma vez; se o banco recusar, sincroniza de novo
  const atualizarVarios = async (ids: string[], mudanca: Partial<Oportunidade>, msgOk: string, msgErro: string) => {
    if (!ids.length) return true;
    ids.forEach(marcarEditado);
    setCards((cs) => cs.map((c) => (ids.includes(c.id) ? { ...c, ...mudanca } : c)));
    const { error } = await supabase.from("oportunidades").update(mudanca).in("id", ids);
    if (error) {
      avisar(/permiss/i.test(error.message) ? error.message : msgErro);
      agendarSync();
      return false;
    }
    avisar(msgOk, "ok");
    return true;
  };

  const plural = (n: number, um: string, varios: string) => (n === 1 ? um : `${n} ${varios}`);

  const ganharNegocios: DataCtx["ganharNegocios"] = (ids) =>
    atualizarVarios(
      ids,
      { status: "ganho", status_em: new Date().toISOString(), motivo_perda_id: null },
      plural(ids.length, "Negócio ganho! 🎉", "negócios marcados como ganhos"),
      "Não foi possível marcar como ganho."
    );

  const perderNegocios: DataCtx["perderNegocios"] = (ids, motivoId, descricao) =>
    atualizarVarios(
      ids,
      { status: "perdido", status_em: new Date().toISOString(), motivo_perda_id: motivoId, motivo_perda: descricao || null },
      plural(ids.length, "Negócio marcado como perdido.", "negócios marcados como perdidos"),
      "Não foi possível marcar como perdido."
    );

  const restaurarStatus: DataCtx["restaurarStatus"] = (ids) =>
    atualizarVarios(
      ids,
      { status: "aberto", status_em: null, motivo_perda_id: null, motivo_perda: null },
      plural(ids.length, "Negócio reaberto.", "negócios reabertos"),
      "Não foi possível restaurar o status."
    );

  const moverNegocios: DataCtx["moverNegocios"] = (ids, etapaId) =>
    atualizarVarios(ids, { etapa_id: etapaId }, plural(ids.length, "Negócio movido.", "negócios movidos"), "Não foi possível mover.");

  const excluirNegocios: DataCtx["excluirNegocios"] = async (ids) => {
    if (!ids.length) return true;
    const anteriores = cardsRef.current.filter((c) => ids.includes(c.id));
    ids.forEach(marcarEditado);
    setCards((cs) => cs.filter((c) => !ids.includes(c.id)));
    const { error } = await supabase.from("oportunidades").update({ excluido_em: new Date().toISOString() }).in("id", ids);
    if (error) {
      setCards((cs) => [...anteriores, ...cs]);
      avisar(/permiss/i.test(error.message) ? error.message : "Não foi possível excluir.");
      return false;
    }
    avisar(plural(ids.length, "Negócio enviado para a lixeira.", "negócios enviados para a lixeira"), "ok");
    return true;
  };

  const restaurarDaLixeira: DataCtx["restaurarDaLixeira"] = async (ids) => {
    const { error } = await supabase.from("oportunidades").update({ excluido_em: null }).in("id", ids);
    if (error) {
      avisar(/permiss/i.test(error.message) ? error.message : "Não foi possível restaurar.");
      return false;
    }
    await recarregar();
    avisar(plural(ids.length, "Negócio restaurado.", "negócios restaurados"), "ok");
    return true;
  };

  const excluirDefinitivo: DataCtx["excluirDefinitivo"] = async (ids) => {
    const { error } = await supabase.from("oportunidades").delete().in("id", ids);
    if (error) {
      avisar("Não foi possível excluir definitivamente.");
      return false;
    }
    avisar(plural(ids.length, "Negócio excluído definitivamente.", "negócios excluídos definitivamente"), "ok");
    return true;
  };

  /* ---------- Pipeline: duplicar e permissões ---------- */

  const duplicarPipeline: DataCtx["duplicarPipeline"] = async (id, nome) => {
    const orig = pipelinesRef.current.find((p) => p.id === id);
    if (!orig) return null;
    const ordem = (pipelinesRef.current[pipelinesRef.current.length - 1]?.ordem ?? 0) + 1;
    const { data, error } = await supabase
      .from("pipelines")
      .insert({ nome, descricao: orig.descricao, grupo: orig.grupo, restrito: orig.restrito, ordem })
      .select()
      .single();
    if (error || !data) {
      avisar("Não foi possível duplicar o pipeline.");
      return null;
    }
    const colunas = etapasRef.current
      .filter((e) => e.pipeline_id === id)
      .map((e) => ({ nome: e.nome, cor: e.cor, ordem: e.ordem, tipo: e.tipo, requisitos: e.requisitos ?? [], pipeline_id: data.id }));
    if (colunas.length) await supabase.from("etapas").insert(colunas);
    const membros = pipelineMembros.filter((m) => m.pipeline_id === id).map((m) => ({ pipeline_id: data.id, usuario_id: m.usuario_id }));
    if (membros.length) await supabase.from("pipeline_membros").insert(membros);
    await recarregar();
    avisar(`Pipeline "${nome}" criado.`, "ok");
    return data.id as string;
  };

  const salvarPermissoesPipeline: DataCtx["salvarPermissoesPipeline"] = async (id, restrito, usuarioIds) => {
    const atuais = pipelineMembros.filter((m) => m.pipeline_id === id).map((m) => m.usuario_id);
    const sair = atuais.filter((u) => !usuarioIds.includes(u));
    const entrar = usuarioIds.filter((u) => !atuais.includes(u));
    const r1 = await supabase.from("pipelines").update({ restrito }).eq("id", id);
    const r2 = sair.length
      ? await supabase.from("pipeline_membros").delete().eq("pipeline_id", id).in("usuario_id", sair)
      : { error: null };
    const r3 = entrar.length
      ? await supabase.from("pipeline_membros").insert(entrar.map((u) => ({ pipeline_id: id, usuario_id: u })))
      : { error: null };
    await recarregar();
    if (r1.error || r2.error || r3.error) {
      avisar("Não foi possível salvar as permissões.");
      return false;
    }
    avisar("Permissões do pipeline salvas.", "ok");
    return true;
  };

  return (
    <Ctx.Provider
      value={{
        loading,
        motivosPerda,
        tagsConfig,
        tiposAtividade,
        listas,
        camposAdicionais,
        pipelineMembros,
        opcoesLista,
        corTag,
        salvarConfig,
        excluirConfig,
        ganharNegocios,
        perderNegocios,
        restaurarStatus,
        excluirNegocios,
        restaurarDaLixeira,
        excluirDefinitivo,
        moverNegocios,
        duplicarPipeline,
        salvarPermissoesPipeline,
        pipelines,
        etapas,
        cards,
        obras,
        leads,
        atividades,
        vendedores,
        avisar,
        recarregar,
        moverEtapa,
        setClassificacao,
        atualizarOportunidade,
        setResponsavel,
        atualizarObra,
        criarEtapa,
        atualizarEtapa,
        moverColuna,
        excluirEtapa,
        moverTodosDaColuna,
        criarPipeline,
        atualizarPipeline,
        excluirPipeline,
        criarLead,
        atualizarLead,
        criarNegocio,
        criarAtividade,
        atualizarAtividade,
      }}
    >
      {children}
      {aviso && (
        <div
          className={
            "no-print fixed bottom-24 right-4 z-[80] flex max-w-sm items-center gap-2.5 rounded-lg border bg-white px-4 py-3 text-sm font-medium shadow-cardhover lg:bottom-6 " +
            (aviso.tipo === "ok" ? "border-green-200 text-green-700" : "border-red-200 text-red-700")
          }
        >
          <span
            className={
              "grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold text-white " +
              (aviso.tipo === "ok" ? "bg-green-600" : "bg-red-600")
            }
          >
            {aviso.tipo === "ok" ? "✓" : "!"}
          </span>
          {aviso.msg}
        </div>
      )}
    </Ctx.Provider>
  );
}
