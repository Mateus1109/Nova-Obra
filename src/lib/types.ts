// ---------- Enums (espelham os ENUMs do Postgres/Supabase) ----------
export type Role = "admin" | "vendedor";

export type TipoObra = "vertical" | "condominio" | "comercial" | "galpao" | "publica";
export type StatusObra = "lancamento" | "em_andamento";
export type ProdutoAlvo =
  | "concreto_usinado"
  | "bombeado"
  | "bomba_lanca"
  | "locacao_bomba";
export type Origem = "levantamento" | "indicacao" | "licitacao" | "outro";

export type Etapa =
  | "qualificacao"
  | "necessita_analise"
  | "apresentacao"
  | "proposta"
  | "ganho"
  | "perdido";

export type Classificacao = "frio" | "morno" | "quente";

export type StatusVisita = "agendada" | "realizada" | "remarcada" | "cancelada";
export type TipoInteracao = "visita" | "ligacao" | "whatsapp" | "email";

// ---------- Entidades ----------
export interface Vendedor {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  role: Role;
  zona_atuacao: string;
  ativo: boolean;
}

export interface Obra {
  id: string;
  nome_obra: string;
  construtora: string;
  tipo: TipoObra;
  status_obra: StatusObra;
  bairro: string;
  cidade: string;
  uf: string;
  endereco: string;
  latitude: number;
  longitude: number;
  produto_alvo: ProdutoAlvo;
  volume_estimado_m3: number;
  contato_nome: string;
  contato_cargo: string;
  contato_telefone: string;
  contato_email: string;
  origem: Origem;
  observacoes: string;
  criado_por: string;
  criado_em: string;
}

export interface Oportunidade {
  id: string;
  obra_id: string;
  vendedor_id: string;
  etapa: Etapa;
  classificacao: Classificacao;
  proxima_etapa_data: string | null;
  previsao_fechamento: string | null;
  motivo_perda: string | null;
  concorrente: string | null;
  valor_estimado: number;
  criado_em: string;
  atualizado_em: string;
}

export interface Visita {
  id: string;
  obra_id: string;
  vendedor_id: string;
  data_visita: string; // ISO date (yyyy-mm-dd)
  status_visita: StatusVisita;
  resultado: string;
  proximo_passo: string;
  criado_em: string;
}

export interface Interacao {
  id: string;
  oportunidade_id: string;
  tipo: TipoInteracao;
  descricao: string;
  data: string;
  usuario_id: string;
}

// ---------- Rótulos legíveis ----------
export const ETAPAS: { key: Etapa; label: string; cor: string }[] = [
  { key: "qualificacao", label: "Qualificação", cor: "#64748b" },
  { key: "necessita_analise", label: "Necessita Análise", cor: "#0891b2" },
  { key: "apresentacao", label: "Apresentação", cor: "#2E78A8" },
  { key: "proposta", label: "Proposta", cor: "#7c3aed" },
  { key: "ganho", label: "Ganho", cor: "#16a34a" },
  { key: "perdido", label: "Perdido", cor: "#dc2626" },
];

export const CLASSIFICACOES: Record<Classificacao, { label: string; bg: string; fg: string }> = {
  frio: { label: "Frio", bg: "#e2e8f0", fg: "#475569" },
  morno: { label: "Morno", bg: "#fef3c7", fg: "#b45309" },
  quente: { label: "Quente", bg: "#fee2e2", fg: "#b91c1c" },
};

export const TIPO_OBRA_LABEL: Record<TipoObra, string> = {
  vertical: "Vertical",
  condominio: "Condomínio",
  comercial: "Comercial",
  galpao: "Galpão",
  publica: "Pública",
};

export const STATUS_OBRA_LABEL: Record<StatusObra, string> = {
  lancamento: "Lançamento",
  em_andamento: "Em andamento",
};

export const PRODUTO_LABEL: Record<ProdutoAlvo, string> = {
  concreto_usinado: "Concreto usinado",
  bombeado: "Bombeado",
  bomba_lanca: "Bomba lança",
  locacao_bomba: "Locação de bomba",
};

export const ORIGEM_LABEL: Record<Origem, string> = {
  levantamento: "Levantamento de obra",
  indicacao: "Indicação",
  licitacao: "Licitação",
  outro: "Outro",
};

export const STATUS_VISITA_LABEL: Record<StatusVisita, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  remarcada: "Remarcada",
  cancelada: "Cancelada",
};

// ---------- Relatórios de visita ----------
export type TipoRelatorio = "cliente" | "aquisicao";
export type ResultadoVisita =
  | "pedido_fechado"
  | "proposta_solicitada"
  | "em_negociacao"
  | "retornar"
  | "sem_interesse";

export interface RelatorioVisita {
  id: string;
  vendedor_id: string;
  obra_id: string | null;
  oportunidade_id: string | null;
  tipo: TipoRelatorio;
  nome_obra: string;
  construtora: string;
  contato_nome: string;
  contato_cargo: string;
  contato_telefone: string;
  bairro: string;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  data_visita: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  objetivo: string;
  resumo: string;
  resultado: ResultadoVisita;
  interesse: Classificacao;
  produto_interesse: ProdutoAlvo | null;
  volume_estimado_m3: number | null;
  concorrente: string;
  proximo_passo: string;
  data_retorno: string | null;
  fotos: string[];
  criado_em: string;
  vendedor?: { nome: string } | null;
}

export const TIPO_RELATORIO: Record<TipoRelatorio, { label: string; curto: string; bg: string; fg: string }> = {
  cliente: { label: "Visita a cliente", curto: "Cliente", bg: "#dcfce7", fg: "#15803d" },
  aquisicao: { label: "Aquisição de nova obra", curto: "Nova obra", bg: "#dbeafe", fg: "#1d4ed8" },
};

export const RESULTADO_VISITA: Record<ResultadoVisita, { label: string; bg: string; fg: string }> = {
  pedido_fechado: { label: "Pedido fechado", bg: "#dcfce7", fg: "#15803d" },
  proposta_solicitada: { label: "Proposta solicitada", bg: "#ede9fe", fg: "#6d28d9" },
  em_negociacao: { label: "Em negociação", bg: "#dbeafe", fg: "#1d4ed8" },
  retornar: { label: "Retornar depois", bg: "#fef3c7", fg: "#b45309" },
  sem_interesse: { label: "Sem interesse", bg: "#fee2e2", fg: "#b91c1c" },
};
