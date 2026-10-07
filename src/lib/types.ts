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

// Colunas do funil — configuráveis pelo diretor (tabela public.etapas)
export type TipoEtapa = "aberta" | "ganho" | "perdido";
export interface Etapa {
  id: string;
  pipeline_id: string;
  nome: string;
  cor: string;
  ordem: number;
  tipo: TipoEtapa;
  /** condições para um negócio SAIR desta etapa (chaves de REQUISITOS_ETAPA) */
  requisitos: RequisitoEtapa[];
}

/** Condições que podem ser exigidas para um negócio sair de uma etapa */
export type RequisitoEtapa =
  | "valor"
  | "atendente"
  | "obra"
  | "previsao_fechamento"
  | "telefone_lead"
  | "fase_obra"
  | "atividade_pendente";

export const REQUISITOS_ETAPA: { key: RequisitoEtapa; label: string; desc: string }[] = [
  { key: "valor", label: "Valor estimado preenchido", desc: "O negócio precisa ter valor maior que zero" },
  { key: "atendente", label: "Atendente definido", desc: "O negócio precisa ter um responsável" },
  { key: "obra", label: "Obra vinculada", desc: "O negócio precisa estar ligado a uma obra" },
  { key: "previsao_fechamento", label: "Previsão de fechamento", desc: "Data prevista para fechar preenchida" },
  { key: "telefone_lead", label: "Telefone do lead", desc: "O lead precisa ter telefone/WhatsApp" },
  { key: "fase_obra", label: "Fase da obra", desc: "A fase da obra precisa estar informada" },
  { key: "atividade_pendente", label: "Próxima atividade agendada", desc: "Precisa haver uma atividade em aberto" },
];

export interface Pipeline {
  id: string;
  nome: string;
  descricao: string;
  grupo: string;
  ordem: number;
  /** true = só administradores e membros listados em pipeline_membros enxergam */
  restrito: boolean;
}

export interface PipelineMembro {
  pipeline_id: string;
  usuario_id: string;
}

export type StatusNegocio = "aberto" | "ganho" | "perdido";

export const STATUS_NEGOCIO: Record<StatusNegocio, { label: string; bg: string; fg: string }> = {
  aberto: { label: "Em aberto", bg: "#eff6ff", fg: "#1f6fe5" },
  ganho: { label: "Ganho", bg: "#dcfce7", fg: "#15803d" },
  perdido: { label: "Perdido", bg: "#fee2e2", fg: "#b91c1c" },
};

export interface MotivoPerda {
  id: string;
  nome: string;
  /** exige descrição ao perder com este motivo */
  obrigatorio: boolean;
  ordem: number;
  ativo: boolean;
  criado_em: string;
}

export interface TagConfig {
  id: string;
  nome: string;
  cor: string;
  criado_em: string;
}

export interface TipoAtividadeConfig {
  id: string;
  nome: string;
  icone: TipoAtividade;
  ordem: number;
  ativo: boolean;
  criado_em: string;
}

export type NomeLista = "origem" | "segmento";

export interface OpcaoLista {
  id: string;
  lista: NomeLista;
  valor: string;
  ordem: number;
  criado_em: string;
}

export type TipoCampo = "texto" | "numero" | "data" | "opcoes" | "sim_nao";

export const TIPO_CAMPO_LABEL: Record<TipoCampo, string> = {
  texto: "Texto",
  numero: "Número",
  data: "Data",
  opcoes: "Lista de opções",
  sim_nao: "Sim / Não",
};

export interface CampoAdicional {
  id: string;
  entidade: "lead" | "negocio";
  nome: string;
  tipo: TipoCampo;
  opcoes: string[];
  ordem: number;
  ativo: boolean;
  criado_em: string;
}

/** valores dos campos adicionais, indexados pelo id do campo */
export type ValoresCampos = Record<string, string | number | boolean | null>;

export type TipoLead = "pessoa" | "empresa";

export interface Lead {
  id: string;
  tipo: TipoLead;
  nome: string;
  nome_exibicao: string;
  telefone: string;
  email: string;
  documento: string;
  segmento: string;
  cargo: string;
  origem: string;
  data_referencia: string | null;
  instagram: string;
  site: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  notas: string;
  tags: string[];
  empresa_id: string | null;
  contato_principal_id: string | null;
  responsavel_id: string | null;
  criado_por: string | null;
  criado_em: string;
  campos: ValoresCampos;
}

export const SEGMENTOS = [
  "Construtora",
  "Incorporadora",
  "Engenharia / projetos",
  "Pré-moldados",
  "Órgão público",
  "Pessoa física (obra própria)",
  "Outro",
];

export const ORIGENS = ["Prospecção em campo", "Indicação", "Cowork / pesquisa", "Instagram", "Site", "WhatsApp", "Ligação", "Outro"];

export type TipoAtividade = "tarefa" | "ligacao" | "whatsapp" | "visita" | "reuniao" | "email" | "proposta";

export const TIPO_ATIVIDADE: Record<TipoAtividade, string> = {
  tarefa: "Tarefa",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  visita: "Visita",
  reuniao: "Reunião",
  email: "E-mail",
  proposta: "Enviar proposta",
};

export interface Atividade {
  id: string;
  oportunidade_id: string | null;
  lead_id: string | null;
  tipo: TipoAtividade;
  tipo_id: string | null;
  titulo: string;
  descricao: string;
  data_hora: string | null;
  concluida: boolean;
  concluida_em: string | null;
  responsavel_id: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface Historico {
  id: string;
  oportunidade_id: string | null;
  lead_id: string | null;
  usuario_id: string | null;
  acao: string;
  detalhe: string;
  criado_em: string;
  usuario?: { nome: string } | null;
}

export type FaseObra = "projeto" | "terraplanagem" | "fundacao" | "estrutura" | "alvenaria" | "acabamento";

export type Classificacao = "frio" | "morno" | "quente";

export type StatusVisita = "agendada" | "realizada" | "remarcada" | "cancelada";
export type TipoInteracao = "visita" | "ligacao" | "whatsapp" | "email";

// ---------- Entidades ----------
export type StatusUsuario = "pendente" | "ativo" | "bloqueado";

export type Permissao =
  | "cadastrar_obras"
  | "mover_funil"
  | "ver_todas_obras"
  | "excluir_obras"
  | "ver_relatorios_equipe"
  | "ver_painel";

export const PERMISSOES: { key: Permissao; label: string; desc: string }[] = [
  { key: "cadastrar_obras", label: "Cadastrar obras", desc: "Cria obras novas e coloca no funil" },
  { key: "mover_funil", label: "Mover cards no funil", desc: "Muda etapa, temperatura e dados da obra" },
  { key: "ver_todas_obras", label: "Ver todas as obras", desc: "Enxerga o funil inteiro, não só as obras dele" },
  { key: "excluir_obras", label: "Excluir obras", desc: "Apaga obras e oportunidades" },
  { key: "ver_relatorios_equipe", label: "Ver relatórios da equipe", desc: "Vê visitas, fotos e PDFs de todos os vendedores" },
  { key: "ver_painel", label: "Ver painel comercial", desc: "Acessa o painel com números e gráficos" },
];

/** Permissões ligadas por padrão ao aprovar um vendedor */
export const PERMISSOES_PADRAO: Partial<Record<Permissao, boolean>> = {
  cadastrar_obras: true,
  mover_funil: true,
};

export interface Vendedor {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  role: Role;
  zona_atuacao: string;
  ativo: boolean;
  status: StatusUsuario;
  permissoes: Partial<Record<Permissao, boolean>>;
  criado_em?: string;
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
  fase_obra: FaseObra | null;
  previsao_concretagem: string | null;
  pavimentos: number | null;
  area_m2: number | null;
  fornecedor_atual: string;
  criado_por: string;
  criado_em: string;
}

export interface Oportunidade {
  id: string;
  obra_id: string | null;
  lead_id: string | null;
  tags: string[];
  vendedor_id: string | null;
  etapa_id: string;
  classificacao: Classificacao;
  proxima_etapa_data: string | null;
  previsao_fechamento: string | null;
  motivo_perda: string | null;
  concorrente: string | null;
  valor_estimado: number;
  criado_em: string;
  atualizado_em: string;
  status: StatusNegocio;
  status_em: string | null;
  motivo_perda_id: string | null;
  excluido_em: string | null;
  excluido_por: string | null;
  campos: ValoresCampos;
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
// Paleta para colorir colunas do funil
export const CORES_ETAPA = ["#64748b", "#0891b2", "#2E78A8", "#7c3aed", "#db2777", "#f59e0b", "#16a34a", "#dc2626"];

export const FASE_OBRA: { key: FaseObra; label: string }[] = [
  { key: "projeto", label: "Projeto" },
  { key: "terraplanagem", label: "Terraplanagem" },
  { key: "fundacao", label: "Fundação" },
  { key: "estrutura", label: "Estrutura" },
  { key: "alvenaria", label: "Alvenaria" },
  { key: "acabamento", label: "Acabamento" },
];
export const FASE_LABEL = Object.fromEntries(FASE_OBRA.map((f) => [f.key, f.label])) as Record<FaseObra, string>;

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
export type TipoRelatorio = "cliente" | "novo_cliente" | "aquisicao";
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
  fase_obra: FaseObra | null;
  fotos: string[];
  criado_em: string;
  vendedor?: { nome: string } | null;
}

export const TIPO_RELATORIO: Record<TipoRelatorio, { label: string; curto: string; bg: string; fg: string }> = {
  cliente: { label: "Visita a cliente", curto: "Cliente", bg: "#dcfce7", fg: "#15803d" },
  novo_cliente: { label: "Novo cliente", curto: "Novo cliente", bg: "#fef3c7", fg: "#b45309" },
  aquisicao: { label: "Aquisição de nova obra", curto: "Nova obra", bg: "#dbeafe", fg: "#1d4ed8" },
};

export const RESULTADO_VISITA: Record<ResultadoVisita, { label: string; bg: string; fg: string }> = {
  pedido_fechado: { label: "Pedido fechado", bg: "#dcfce7", fg: "#15803d" },
  proposta_solicitada: { label: "Proposta solicitada", bg: "#ede9fe", fg: "#6d28d9" },
  em_negociacao: { label: "Em negociação", bg: "#dbeafe", fg: "#1d4ed8" },
  retornar: { label: "Retornar depois", bg: "#fef3c7", fg: "#b45309" },
  sem_interesse: { label: "Sem interesse", bg: "#fee2e2", fg: "#b91c1c" },
};
