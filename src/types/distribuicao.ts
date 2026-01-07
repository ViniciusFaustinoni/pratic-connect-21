// ============================================
// ENUMS E CONSTANTES
// ============================================

export type StatusDistribuicao = 'ativo' | 'pausado' | 'ferias' | 'inativo';
export type TipoAtribuicao = 'automatica' | 'manual' | 'fallback' | 'reatribuicao';

export const STATUS_DISTRIBUICAO_LABELS: Record<StatusDistribuicao, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  ferias: 'Férias',
  inativo: 'Inativo',
};

export const STATUS_DISTRIBUICAO_COLORS: Record<StatusDistribuicao, string> = {
  ativo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pausado: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ferias: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  inativo: 'bg-muted text-muted-foreground',
};

export const TIPO_ATRIBUICAO_LABELS: Record<TipoAtribuicao, string> = {
  automatica: 'Automática',
  manual: 'Manual',
  fallback: 'Fallback',
  reatribuicao: 'Reatribuição',
};

export const TIPO_ATRIBUICAO_COLORS: Record<TipoAtribuicao, string> = {
  automatica: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  manual: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  fallback: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  reatribuicao: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

// ============================================
// CONFIGURAÇÃO GERAL
// ============================================

export interface ConfiguracaoDistribuicao {
  id: string;
  ativo: boolean;
  tipo_distribuicao: string;
  proximo_vendedor: number;
  limite_diario_padrao: number | null;
  resetar_contadores_hora: number | null;
  fallback_vendedor_id: string | null;
  distribuir_fins_semana: boolean | null;
  created_at: string;
  updated_at: string;
  fallback_vendedor?: {
    id: string;
    nome: string;
  } | null;
}

// ============================================
// VENDEDOR NA DISTRIBUIÇÃO
// ============================================

export interface VendedorDistribuicao {
  id: string;
  vendedor_id: string;
  recebendo_leads: boolean;
  max_leads_dia: number | null;
  max_leads_mes: number | null;
  leads_recebidos_hoje: number;
  leads_recebidos_mes: number;
  status: StatusDistribuicao;
  ordem: number;
  total_leads_historico: number;
  ultima_atribuicao: string | null;
  regioes: string[] | null;
  canais: string[] | null;
  created_at: string;
  updated_at: string;
  vendedor?: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    avatar_url: string | null;
  } | null;
}

// ============================================
// HISTÓRICO DE ATRIBUIÇÕES
// ============================================

export interface HistoricoDistribuicao {
  id: string;
  lead_id: string;
  vendedor_id: string;
  vendedor_anterior_id: string | null;
  tipo: TipoAtribuicao;
  motivo: string | null;
  created_at: string;
  created_by: string | null;
  lead?: {
    id: string;
    nome: string;
    telefone: string;
  } | null;
  vendedor?: {
    id: string;
    nome: string;
  } | null;
  vendedor_anterior?: {
    id: string;
    nome: string;
  } | null;
}

// ============================================
// ESTATÍSTICAS
// ============================================

export interface EstatisticasDistribuicao {
  total_vendedores_ativos: number;
  total_leads_hoje: number;
  leads_distribuidos_hoje: number;
  leads_sem_vendedor: number;
  media_por_vendedor: number;
  vendedor_mais_leads: {
    vendedor: string;
    quantidade: number;
  } | null;
  vendedor_menos_leads: {
    vendedor: string;
    quantidade: number;
  } | null;
}

// ============================================
// PAYLOADS
// ============================================

export interface AtualizarConfigPayload {
  ativo?: boolean;
  tipo_distribuicao?: string;
  limite_diario_padrao?: number;
  resetar_contadores_hora?: number;
  fallback_vendedor_id?: string | null;
  distribuir_fins_semana?: boolean;
}

export interface AtualizarStatusVendedorPayload {
  vendedor_id: string;
  status: StatusDistribuicao;
}

export interface AtualizarVendedorPayload {
  id: string;
  recebendo_leads?: boolean;
  max_leads_dia?: number | null;
  max_leads_mes?: number | null;
  status?: StatusDistribuicao;
  ordem?: number;
  regioes?: string[];
  canais?: string[];
}

export interface DistribuirLeadManualPayload {
  lead_id: string;
  vendedor_id: string;
  motivo?: string;
}
