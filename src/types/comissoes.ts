// Tipos para o sistema de comissões

export type TipoVendedor = 'vendedor_clt' | 'vendedor_externo' | 'todos';
export type BaseCalculo = 'valor_adesao' | 'valor_mensal' | 'ambos';
export type TipoCalculo = 'percentual_fixo' | 'escalonado_metas' | 'escalonado_valor';
export type StatusComissao = 'pendente' | 'aprovada' | 'paga' | 'cancelada';

export interface ComissaoConfig {
  id: string;
  nome: string;
  tipo_vendedor: TipoVendedor;
  base_calculo: BaseCalculo;
  tipo_calculo: TipoCalculo;
  percentual_base: number;
  bonus_meta_atingida: number | null;
  bonus_meta_superada: number | null;
  valor_minimo: number | null;
  valor_maximo: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Comissao {
  id: string;
  vendedor_id: string;
  contrato_id: string;
  config_id: string | null;
  mes_referencia: number;
  ano_referencia: number;
  valor_base: number;
  percentual_aplicado: number;
  valor_comissao: number;
  bonus_meta: number | null;
  valor_total: number;
  status: StatusComissao;
  aprovado_por: string | null;
  aprovado_em: string | null;
  pago_em: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  vendedor?: {
    id: string;
    nome: string;
    avatar_url?: string;
  };
  contrato?: {
    id: string;
    numero?: string;
    associado?: {
      nome: string;
    };
    veiculo?: {
      placa: string;
    };
  };
  config?: ComissaoConfig;
}

export interface ComissaoPagamento {
  id: string;
  vendedor_id: string;
  mes_referencia: number;
  ano_referencia: number;
  valor_total: number;
  quantidade_comissoes: number;
  data_pagamento: string;
  comprovante_url: string | null;
  observacoes: string | null;
  created_at: string;
  // Joins
  vendedor?: {
    id: string;
    nome: string;
    avatar_url?: string;
  };
}

export interface ComissaoResumo {
  totalPendente: number;
  totalAprovada: number;
  totalPago: number;
  quantidadePendente: number;
  quantidadeAprovada: number;
  quantidadePago: number;
}

export interface ComissaoConfigFormData {
  nome: string;
  tipo_vendedor: TipoVendedor;
  base_calculo: BaseCalculo;
  tipo_calculo: TipoCalculo;
  percentual_base: number;
  bonus_meta_atingida: number;
  bonus_meta_superada: number;
  valor_minimo: number;
  valor_maximo: number | null;
  ativo: boolean;
}
