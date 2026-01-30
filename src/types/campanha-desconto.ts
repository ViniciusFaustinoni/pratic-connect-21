// ============================================
// TIPOS - CAMPANHAS DE DESCONTO
// SGA Pratic 2.0 - Proteção Veicular
// ============================================

export type TipoBeneficio = 'percentual' | 'valor_fixo';
export type StatusCampanha = 'ativa' | 'inativa';

export interface CampanhaDesconto {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_beneficio: TipoBeneficio;
  valor_beneficio: number;
  data_inicio: string;
  data_fim: string;
  meses_aplicacao: number;
  status: StatusCampanha;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampanhaDescontoFormData {
  nome: string;
  descricao?: string;
  tipo_beneficio: TipoBeneficio;
  valor_beneficio: number;
  data_inicio: string;
  data_fim: string;
  meses_aplicacao: number;
  status: StatusCampanha;
}

// Resultado do cálculo de desconto
export interface DescontoCalculado {
  valorOriginal: number;
  valorPromocional: number;
  economia: number;
  economiaMensal: number;
  economiaTotal: number;
  percentualDesconto: number;
}

// Função auxiliar para calcular desconto
export function calcularDesconto(
  valorOriginal: number,
  campanha: CampanhaDesconto | null
): DescontoCalculado {
  if (!campanha) {
    return {
      valorOriginal,
      valorPromocional: valorOriginal,
      economia: 0,
      economiaMensal: 0,
      economiaTotal: 0,
      percentualDesconto: 0,
    };
  }

  let valorPromocional: number;
  let percentualDesconto: number;

  if (campanha.tipo_beneficio === 'percentual') {
    valorPromocional = valorOriginal * (1 - campanha.valor_beneficio / 100);
    percentualDesconto = campanha.valor_beneficio;
  } else {
    valorPromocional = valorOriginal - campanha.valor_beneficio;
    percentualDesconto = valorOriginal > 0 
      ? (campanha.valor_beneficio / valorOriginal) * 100 
      : 0;
  }

  // Garantir valor mínimo
  valorPromocional = Math.max(valorPromocional, 0);
  valorPromocional = Math.round(valorPromocional * 100) / 100;

  const economiaMensal = valorOriginal - valorPromocional;
  const economiaTotal = economiaMensal * campanha.meses_aplicacao;

  return {
    valorOriginal,
    valorPromocional,
    economia: economiaMensal,
    economiaMensal,
    economiaTotal,
    percentualDesconto: Math.round(percentualDesconto * 10) / 10,
  };
}

// Labels
export const TIPO_BENEFICIO_LABELS: Record<TipoBeneficio, string> = {
  percentual: 'Percentual (%)',
  valor_fixo: 'Valor Fixo (R$)',
};

export const STATUS_CAMPANHA_LABELS: Record<StatusCampanha, string> = {
  ativa: 'Ativa',
  inativa: 'Inativa',
};
