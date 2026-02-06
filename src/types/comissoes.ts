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

export type TipoComissao = 'adesao' | 'recorrente' | 'producao' | 'classificacao' | 'crescimento' | 'recorde';

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
  // Novos campos da migration
  tipo_comissao?: TipoComissao;
  cobranca_id?: string | null;
  campanha_id?: string | null;
  associado_id?: string | null;
  valor_bruto?: number;
  valor_deducoes?: number;
  deducoes_detalhes?: Record<string, unknown>[];
  recalculada?: boolean;
  recalculada_em?: string | null;
  recalculada_motivo?: string | null;
  contestada?: boolean;
  contestada_em?: string | null;
  contestacao_motivo?: string | null;
  contestacao_resposta?: string | null;
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
  config?: Partial<ComissaoConfig>;
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

// ========================================
// NOVOS TYPES — Faixas de Comissionamento
// ========================================

export interface FaixaAdesao {
  id: string;
  tipo_consultor: 'interno' | 'externo';
  quantidade_vendas_minima: number;
  percentual_adesao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaixaRecorrente {
  id: string;
  tipo_consultor: 'interno' | 'externo';
  placas_minima: number;
  placas_maxima: number | null;
  percentual_recorrente: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaixaProducao {
  id: string;
  tipo_consultor: 'externo';
  placas_confirmadas_minima: number;
  valor_remuneracao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaixaCrescimento {
  id: string;
  tipo_consultor: string;
  placas_confirmadas: number;
  valor_remuneracao: number;
  percentual_minimo_recorrente: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaixaClassificacao {
  id: string;
  tipo_consultor: string;
  categoria_tempo: 'mais_1_ano' | 'menos_1_ano' | 'todos';
  posicao_ranking: number;
  faixa_placas_base: number;
  valor_premio: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campanha {
  id: string;
  nome: string;
  mes: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
  data_pagamento_1a_fase: string | null;
  data_apuracao_boletos: string | null;
  data_pagamento_descontos: string | null;
  status: 'aberta' | 'em_apuracao' | 'fechada' | 'paga';
  total_vendas_confirmadas: number;
  total_comissoes_geradas: number;
  fechada_por: string | null;
  fechada_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface RankingMensal {
  id: string;
  campanha_id: string;
  vendedor_id: string;
  tipo_consultor: string;
  categoria_tempo: string;
  vendas_confirmadas: number;
  vendas_canceladas: number;
  vendas_liquidas: number;
  trocas_titularidade: number;
  posicao_ranking: number | null;
  valor_premio: number;
  placas_ativas: number;
  created_at: string;
  updated_at: string;
  vendedor?: { nome: string; avatar_url: string | null };
}

export interface ComissaoRecorrente {
  id: string;
  vendedor_id: string;
  campanha_id: string | null;
  mes_referencia: number;
  ano_referencia: number;
  placas_ativas: number;
  total_boletos_pagos: number;
  percentual_aplicado: number;
  valor_recorrente: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Deducao {
  id: string;
  comissao_id: string | null;
  vendedor_id: string;
  campanha_id: string | null;
  tipo: 'repasse_volante' | 'taxa_cartao' | 'pendencia_associado' | 'cancelamento' | 'inadimplencia_2_boletos' | 'fraude';
  descricao: string | null;
  valor: number;
  contrato_id: string | null;
  associado_id: string | null;
  cobranca_id: string | null;
  aplicada_em: string;
  created_at: string;
}

export interface ParametroComissao {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
  tipo_dado: 'numero' | 'texto' | 'booleano';
  ativo: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface CrescimentoLog {
  id: string;
  vendedor_id: string;
  marco_placas: number;
  data_atingido: string;
  valor_pago: number;
  percentual_recorrente_garantido: number;
  campanha_id: string | null;
  created_at: string;
}

// Labels para exibição
export const TIPO_COMISSAO_LABELS: Record<TipoComissao, string> = {
  adesao: 'Bonificação sobre Adesão',
  recorrente: 'Recorrente (Boletos)',
  producao: 'Produção Mensal',
  classificacao: 'Classificação/Ranking',
  crescimento: 'Crescimento de Base',
  recorde: 'Bônus de Recorde',
};

export const TIPO_DEDUCAO_LABELS: Record<string, string> = {
  repasse_volante: 'Repasse Volante (R$50)',
  taxa_cartao: 'Taxa Cartão Crédito/Débito',
  pendencia_associado: 'Pendência do Associado',
  cancelamento: 'Cancelamento na Campanha',
  inadimplencia_2_boletos: 'Inadimplência 2 Primeiros Boletos',
  fraude: 'Penalidade por Fraude',
};
