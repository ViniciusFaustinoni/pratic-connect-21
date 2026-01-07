// ============================================
// TIPOS ESPECIALIZADOS PARA MÓDULO DE COTAÇÃO
// SGA Pratic 2.0 - Proteção Veicular
// ============================================

// ============================================
// ENUMS
// ============================================

export type TipoUso = 'particular' | 'aplicativo' | 'comercial' | 'moto';

// Extensão do StatusCotacao existente (adiciona 'visualizada')
export type StatusCotacaoExtended = 
  | 'rascunho' 
  | 'enviada' 
  | 'visualizada'
  | 'aceita' 
  | 'recusada' 
  | 'expirada';

// ============================================
// LABELS
// ============================================

export const TIPO_USO_LABELS: Record<TipoUso, string> = {
  particular: 'Particular',
  aplicativo: 'Aplicativo (Uber, 99, etc)',
  comercial: 'Comercial',
  moto: 'Moto',
};

export const STATUS_COTACAO_EXTENDED_LABELS: Record<StatusCotacaoExtended, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  visualizada: 'Visualizada',
  aceita: 'Aceita',
  recusada: 'Recusada',
  expirada: 'Expirada',
};

export const STATUS_COTACAO_EXTENDED_COLORS: Record<StatusCotacaoExtended, string> = {
  rascunho: 'bg-gray-100 text-gray-800',
  enviada: 'bg-blue-100 text-blue-800',
  visualizada: 'bg-yellow-100 text-yellow-800',
  aceita: 'bg-green-100 text-green-800',
  recusada: 'bg-red-100 text-red-800',
  expirada: 'bg-gray-100 text-gray-600',
};

// ============================================
// INTERFACES - PLANOS
// ============================================

export interface PlanoParaCotacao {
  id: string;
  codigo: string;
  nome: string;
  tipo_uso: TipoUso;
  fipe_minimo: number | null;
  fipe_maximo: number | null;
  valor_adesao: number;
  coberturas: string[];
  ativo: boolean;
  created_at: string;
}

// ============================================
// INTERFACES - TABELA DE PREÇOS (FAIXAS FIPE)
// ============================================

export interface FaixaPreco {
  id: string;
  nome: string;
  tipo_uso: TipoUso;
  fipe_minimo: number;
  fipe_maximo: number;
  valor_cota: number;           // Valor base da cota mensal
  taxa_administrativa: number;  // Taxa fixa mensal
  valor_rastreamento: number;   // Valor do rastreamento
  valor_assistencia: number;    // Valor assistência 24h
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativo: boolean;
}

// ============================================
// INTERFACES - COTAÇÃO
// ============================================

export interface DadosVeiculo {
  marca: string;
  modelo: string;
  ano: number;
  placa?: string;
  codigo_fipe?: string;
  valor_fipe: number;
  uso_aplicativo: boolean;
}

export interface ResultadoCotacao {
  plano: PlanoParaCotacao;
  faixa: FaixaPreco;
  valores: {
    valor_fipe: number;
    valor_cota: number;          // Valor base
    taxa_administrativa: number;
    valor_rastreamento: number;
    valor_assistencia: number;
    valor_mensal: number;        // Soma de tudo
    valor_adesao: number;
  };
}

export interface CotacaoCompleta {
  id: string;
  numero: string;
  lead_id: string;
  plano_id: string;
  vendedor_id: string;

  // Dados do veículo
  veiculo_marca: string;
  veiculo_modelo: string;
  veiculo_ano: number;
  veiculo_placa?: string;
  codigo_fipe?: string;
  valor_fipe: number;
  uso_aplicativo: boolean;

  // Valores calculados
  valor_cota: number;
  taxa_administrativa: number;
  valor_rastreamento: number;
  valor_assistencia: number;
  valor_mensal: number;
  valor_adesao: number;

  // Status e datas
  status: StatusCotacaoExtended;
  validade_dias: number;
  created_at: string;
  updated_at: string;

  // Joins opcionais
  lead?: {
    id: string;
    nome: string;
    telefone: string;
    email?: string;
  };
  plano?: PlanoParaCotacao;
  vendedor?: {
    id: string;
    nome: string;
  };
}

// ============================================
// PAYLOADS
// ============================================

export interface CalcularCotacaoPayload {
  valor_fipe: number;
  tipo_uso: TipoUso;
  plano_id?: string; // Se não informado, retorna todos os planos disponíveis
}

export interface CriarCotacaoPayload {
  lead_id: string;
  plano_id: string;
  veiculo_marca: string;
  veiculo_modelo: string;
  veiculo_ano: number;
  veiculo_placa?: string;
  codigo_fipe?: string;
  valor_fipe: number;
  uso_aplicativo: boolean;
}
