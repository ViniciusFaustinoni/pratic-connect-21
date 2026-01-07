// ============================================
// ENUMS E CONSTANTES
// ============================================

export type StatusDistribuicao = 'ativo' | 'pausado' | 'ferias' | 'inativo';

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

// ============================================
// CONFIGURAÇÃO GERAL
// ============================================

export interface ConfiguracaoDistribuicao {
  id: string;
  ativo: boolean;
  limite_diario_padrao: number;
  resetar_contadores_hora: number;
  fallback_usuario_id: string | null;
  distribuir_fins_semana: boolean;
  created_at: string;
  updated_at: string;
  fallback_usuario?: {
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
  status: StatusDistribuicao;
  limite_diario: number;
  leads_hoje: number;
  total_leads: number;
  ultima_atribuicao: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
  vendedor?: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
  } | null;
}

// ============================================
// HISTÓRICO DE ATRIBUIÇÕES
// ============================================

export interface HistoricoDistribuicao {
  id: string;
  lead_id: string;
  vendedor_id: string;
  atribuido_automaticamente: boolean;
  motivo: string;
  created_at: string;
  lead?: {
    id: string;
    nome: string;
    telefone: string;
  } | null;
  vendedor?: {
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

export interface AtualizarStatusVendedorPayload {
  vendedor_id: string;
  status: StatusDistribuicao;
}

export interface AtualizarLimiteVendedorPayload {
  vendedor_id: string;
  limite_diario: number;
}

export interface DistribuirLeadManualPayload {
  lead_id: string;
  vendedor_id: string;
}
