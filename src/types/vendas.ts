// ============================================
// TYPES DO MÓDULO DE VENDAS — SGA Pratic 2.0
// ============================================

// Re-exportar tipos base de database.ts
export type {
  EtapaLead,
  OrigemLead,
  MotivoPerda,
  StatusCotacao,
  StatusContrato,
} from './database';

export {
  ETAPA_LABELS,
  ORIGEM_LABELS,
  MOTIVO_PERDA_LABELS,
  STATUS_CONTRATO_LABELS,
} from './database';

import type {
  EtapaLead,
  OrigemLead,
  MotivoPerda,
  StatusCotacao,
  StatusContrato,
} from './database';

// ============================================
// LABELS ADICIONAIS
// ============================================

/** Labels para status de cotação */
export const STATUS_COTACAO_LABELS: Record<StatusCotacao, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aceita: 'Aceita',
  recusada: 'Recusada',
  expirada: 'Expirada',
};

// ============================================
// CORES PARA BADGES — ETAPAS
// ============================================

/** Classes Tailwind para badges de etapas do funil */
export const ETAPA_COLORS: Record<EtapaLead, string> = {
  novo: 'bg-blue-100 text-blue-800',
  contato_inicial: 'bg-sky-100 text-sky-800',
  contato: 'bg-yellow-100 text-yellow-800',
  apresentacao: 'bg-violet-100 text-violet-800',
  qualificado: 'bg-purple-100 text-purple-800',
  cotacao_enviada: 'bg-orange-100 text-orange-800',
  negociacao: 'bg-pink-100 text-pink-800',
  vistoria_agendada: 'bg-cyan-100 text-cyan-800',
  contrato_enviado: 'bg-indigo-100 text-indigo-800',
  contrato_assinado: 'bg-teal-100 text-teal-800',
  instalacao_agendada: 'bg-amber-100 text-amber-800',
  ganho: 'bg-green-100 text-green-800',
  perdido: 'bg-red-100 text-red-800',
};

// ============================================
// CORES PARA BADGES — ORIGENS
// ============================================

/** Classes Tailwind para badges de origem */
export const ORIGEM_COLORS: Record<OrigemLead, string> = {
  indicacao: 'bg-purple-100 text-purple-800',
  site: 'bg-blue-100 text-blue-800',
  whatsapp: 'bg-green-100 text-green-800',
  facebook: 'bg-indigo-100 text-indigo-800',
  instagram: 'bg-pink-100 text-pink-800',
  google: 'bg-red-100 text-red-800',
  telefone: 'bg-emerald-100 text-emerald-800',
  presencial: 'bg-amber-100 text-amber-800',
  parceiro: 'bg-teal-100 text-teal-800',
  outro: 'bg-gray-100 text-gray-800',
  api: 'bg-cyan-100 text-cyan-800',
};

// ============================================
// CORES PARA BADGES — STATUS COTAÇÃO
// ============================================

/** Classes Tailwind para badges de status de cotação */
export const STATUS_COTACAO_COLORS: Record<StatusCotacao, string> = {
  rascunho: 'bg-gray-100 text-gray-800',
  enviada: 'bg-blue-100 text-blue-800',
  aceita: 'bg-green-100 text-green-800',
  recusada: 'bg-red-100 text-red-800',
  expirada: 'bg-gray-100 text-gray-600',
};

// ============================================
// CORES PARA BADGES — STATUS CONTRATO
// ============================================

/** Classes Tailwind para badges de status de contrato */
export const STATUS_CONTRATO_COLORS: Record<StatusContrato, string> = {
  rascunho: 'bg-gray-100 text-gray-800',
  pendente: 'bg-yellow-100 text-yellow-800',
  enviado: 'bg-blue-100 text-blue-800',
  assinado: 'bg-purple-100 text-purple-800',
  ativo: 'bg-green-100 text-green-800',
  suspenso: 'bg-orange-100 text-orange-800',
  cancelado: 'bg-red-100 text-red-800',
};

// ============================================
// CORES PARA BADGES — MOTIVO PERDA
// ============================================

/** Classes Tailwind para badges de motivo de perda */
export const MOTIVO_PERDA_COLORS: Record<MotivoPerda, string> = {
  preco: 'bg-red-100 text-red-800',
  concorrencia: 'bg-orange-100 text-orange-800',
  desistiu: 'bg-yellow-100 text-yellow-800',
  nao_qualificado: 'bg-gray-100 text-gray-800',
  veiculo_reprovado: 'bg-amber-100 text-amber-800',
  nao_respondeu: 'bg-slate-100 text-slate-800',
  outro: 'bg-zinc-100 text-zinc-800',
};

// ============================================
// ARRAYS DE CONSTANTES — ETAPAS
// ============================================

/** Etapas principais para exibição no Kanban (11 etapas conforme PRD) */
export const ETAPAS_KANBAN: EtapaLead[] = [
  'novo',
  'contato',
  'qualificado',
  'cotacao_enviada',
  'negociacao',
  'vistoria_agendada',
  'contrato_enviado',
  'contrato_assinado',
  'instalacao_agendada',
  'ganho',
  'perdido',
];

/** Todas as etapas do funil para Selects */
export const ETAPAS_TODAS: EtapaLead[] = [
  'novo',
  'contato_inicial',
  'contato',
  'apresentacao',
  'qualificado',
  'cotacao_enviada',
  'negociacao',
  'vistoria_agendada',
  'contrato_enviado',
  'contrato_assinado',
  'instalacao_agendada',
  'ganho',
  'perdido',
];

// ============================================
// ARRAYS DE CONSTANTES — ORIGENS
// ============================================

/** Todas as origens para Selects */
export const ORIGENS_TODAS: OrigemLead[] = [
  'indicacao',
  'site',
  'whatsapp',
  'facebook',
  'instagram',
  'google',
  'telefone',
  'presencial',
  'parceiro',
  'api',
  'outro',
];

// ============================================
// ARRAYS DE CONSTANTES — MOTIVOS DE PERDA
// ============================================

/** Todos os motivos de perda para Selects */
export const MOTIVOS_PERDA_TODOS: MotivoPerda[] = [
  'preco',
  'concorrencia',
  'desistiu',
  'nao_qualificado',
  'veiculo_reprovado',
  'nao_respondeu',
  'outro',
];

// ============================================
// INTERFACE — LEAD
// ============================================

/** Interface completa do Lead alinhada com tabela do banco */
export interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cpf: string | null;

  // Dados do veículo (pré-cotação)
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;
  veiculo_placa: string | null;
  veiculo_fipe: number | null;
  codigo_fipe: string | null;

  // Status e classificação
  origem: OrigemLead;
  etapa: EtapaLead;
  motivo_perda: string | null;
  observacao_perda: string | null;
  observacoes: string | null;

  // Relacionamentos
  vendedor_id: string | null;
  fonte_id: string | null;
  campanha_id: string | null;
  indicador_id: string | null;
  associado_id: string | null;

  // Datas de acompanhamento
  data_primeiro_contato: string | null;
  data_ultimo_contato: string | null;
  data_proxima_acao: string | null;
  data_perda: string | null;
  data_conversao: string | null;

  // UTM params
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/** Lead com dados do vendedor (join) */
export interface LeadWithVendedor extends Lead {
  vendedor?: {
    id: string;
    nome: string;
    email: string;
  } | null;
}

/** Lead com todas as relações (join completo) */
export interface LeadWithRelations extends Lead {
  vendedor?: {
    id: string;
    nome: string;
    email: string;
  } | null;
  fonte?: {
    id: string;
    nome: string;
  } | null;
  campanha?: {
    id: string;
    nome: string;
  } | null;
  cotacoes?: Cotacao[];
  contratos?: Contrato[];
}

/** Lead para criação (campos obrigatórios) */
export interface LeadCreate {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_ano?: number;
  veiculo_placa?: string;
  veiculo_fipe?: number;
  codigo_fipe?: string;
  origem?: OrigemLead;
  vendedor_id?: string;
  fonte_id?: string;
  campanha_id?: string;
  observacoes?: string;
}

/** Lead para atualização (campos parciais) */
export interface LeadUpdate {
  nome?: string;
  telefone?: string;
  email?: string | null;
  cpf?: string | null;
  veiculo_marca?: string | null;
  veiculo_modelo?: string | null;
  veiculo_ano?: number | null;
  veiculo_placa?: string | null;
  veiculo_fipe?: number | null;
  codigo_fipe?: string | null;
  origem?: OrigemLead;
  etapa?: EtapaLead;
  motivo_perda?: string | null;
  observacao_perda?: string | null;
  observacoes?: string | null;
  vendedor_id?: string | null;
  fonte_id?: string | null;
  campanha_id?: string | null;
  data_primeiro_contato?: string | null;
  data_ultimo_contato?: string | null;
  data_proxima_acao?: string | null;
  data_perda?: string | null;
  data_conversao?: string | null;
}

// ============================================
// INTERFACE — COTAÇÃO
// ============================================

/** Interface completa da Cotação alinhada com tabela do banco */
export interface Cotacao {
  id: string;
  numero: string;
  lead_id: string | null;
  plano_id: string;
  vendedor_id: string | null;

  // Dados do veículo
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;
  codigo_fipe: string | null;
  valor_fipe: number;

  // Valores calculados
  valor_cota: number;
  taxa_administrativa: number;
  valor_rastreamento: number;
  valor_assistencia: number | null;
  valor_adesao: number;
  valor_total_mensal: number;

  // Status
  status: StatusCotacao;
  validade_dias: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/** Cotação com relacionamentos (join) */
export interface CotacaoWithRelations extends Cotacao {
  lead?: Lead | null;
  plano?: {
    id: string;
    nome: string;
    descricao: string | null;
  } | null;
  vendedor?: {
    id: string;
    nome: string;
  } | null;
}

/** Cotação para criação */
export interface CotacaoCreate {
  lead_id: string;
  plano_id: string;
  vendedor_id?: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_ano?: number;
  codigo_fipe?: string;
  valor_fipe: number;
  valor_cota: number;
  taxa_administrativa: number;
  valor_rastreamento: number;
  valor_assistencia?: number;
  valor_adesao: number;
  valor_total_mensal: number;
  validade_dias?: number;
}

// ============================================
// INTERFACE — CONTRATO
// ============================================

/** Interface completa do Contrato alinhada com tabela do banco */
export interface Contrato {
  id: string;
  numero: string;
  cotacao_id: string | null;
  lead_id: string | null;
  plano_id: string;
  associado_id: string | null;
  vendedor_id: string | null;

  // Valores
  valor_adesao: number;
  valor_mensal: number;
  dia_vencimento: number | null;

  // Datas
  data_inicio: string;
  data_fim: string | null;

  // Status
  status: StatusContrato;

  // Autentique (assinatura digital)
  autentique_documento_id: string | null;
  autentique_url: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/** Contrato com relacionamentos (join) */
export interface ContratoWithRelations extends Contrato {
  lead?: Lead | null;
  plano?: {
    id: string;
    nome: string;
  } | null;
  associado?: {
    id: string;
    nome: string;
    cpf: string;
  } | null;
  vendedor?: {
    id: string;
    nome: string;
  } | null;
  cotacao?: Cotacao | null;
}

// ============================================
// FILTROS E PAGINAÇÃO
// ============================================

/** Filtros para listagem de leads */
export interface LeadFilters {
  search?: string;
  etapa?: EtapaLead | 'all';
  origem?: OrigemLead | 'all';
  vendedor_id?: string | 'all';
  data_de?: string;
  data_ate?: string;
}

/** Filtros para listagem de cotações */
export interface CotacaoFilters {
  search?: string;
  status?: StatusCotacao | 'all';
  vendedor_id?: string | 'all';
  data_de?: string;
  data_ate?: string;
}

/** Filtros para listagem de contratos */
export interface ContratoFilters {
  search?: string;
  status?: StatusContrato | 'all';
  vendedor_id?: string | 'all';
  data_de?: string;
  data_ate?: string;
}

/** Paginação padrão */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

/** Resultado paginado genérico */
export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

// ============================================
// TIPOS AUXILIARES — KANBAN
// ============================================

/** Configuração de coluna do Kanban */
export interface KanbanColumn {
  id: EtapaLead;
  label: string;
  color: string;
}

/** Lead formatado para exibição no Kanban */
export interface LeadKanban {
  id: string;
  nome: string;
  telefone: string;
  veiculo: string; // "Marca Modelo Ano"
  vendedor: string;
  etapa: EtapaLead;
  diasNaEtapa: number;
  valor_fipe: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// TIPOS AUXILIARES — COTADOR
// ============================================

/** Dados do veículo para cotação */
export interface VeiculoCotacao {
  marca: string;
  modelo: string;
  ano: number;
  codigo_fipe?: string;
  valor_fipe: number;
}

/** Resultado da cotação calculada */
export interface ResultadoCotacao {
  plano_id: string;
  plano_nome: string;
  plano_descricao: string | null;
  valor_cota: number;
  taxa_administrativa: number;
  valor_rastreamento: number;
  valor_assistencia: number;
  valor_adesao: number;
  valor_total_mensal: number;
}

/** Plano disponível para cotação */
export interface PlanoParaCotacao {
  id: string;
  nome: string;
  descricao: string | null;
  valor_adesao_base: number;
  percentual_cota: number;
  taxa_administrativa: number;
  valor_rastreamento: number;
  ativo: boolean;
}

// ============================================
// TIPOS AUXILIARES — MÉTRICAS
// ============================================

/** Dados para o funil de vendas */
export interface FunnelData {
  etapa: EtapaLead;
  label: string;
  quantidade: number;
  cor: string;
}

/** Dados de origem para gráficos */
export interface OrigemData {
  origem: OrigemLead;
  label: string;
  quantidade: number;
  cor: string;
}

/** Top vendedor para ranking */
export interface TopVendedor {
  id: string;
  nome: string;
  contratos: number;
  valor_total: number;
}
