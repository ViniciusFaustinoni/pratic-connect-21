/**
 * Mapeamento dos templates Meta de cobrança → variáveis a preencher.
 *
 * Cada entrada descreve, em ordem, os campos que serão enviados como
 * `components.parameters` no payload da Meta. Usado tanto pela UI
 * (`/cobranca/regua`) para mostrar preview ao operador, quanto pela
 * edge function `executar-regua-cobranca` (que duplica este mapa
 * inline porque edge functions não importam de `src/`).
 *
 * Mantenha os dois lugares em sincronia ao adicionar templates novos.
 */

export type CobrancaVar =
  | 'nome'
  | 'valor'
  | 'vencimento'
  | 'mes_ano'
  | 'placa'
  | 'modelo'
  | 'linha_digitavel';

export const VAR_LABELS: Record<CobrancaVar, string> = {
  nome: 'Nome do associado',
  valor: 'Valor (R$)',
  vencimento: 'Data de vencimento',
  mes_ano: 'Mês/Ano de referência',
  placa: 'Placa do veículo',
  modelo: 'Modelo do veículo',
  linha_digitavel: 'Linha digitável (boleto SGA)',
};

export const TEMPLATE_PARAMS_MAP: Record<string, CobrancaVar[]> = {
  cobranca_mensalidade: ['nome', 'mes_ano', 'vencimento'],
  d_6_lembrete_desconto_v1: ['nome', 'vencimento', 'linha_digitavel'],
  d0_boleto_vence_hoje_v1: ['nome', 'valor', 'vencimento', 'modelo', 'placa', 'linha_digitavel'],
  d1_a_d4_boleto_vencido_v1: ['nome'],
  d5_ultimo_dia_sem_revistoria_v1: ['vencimento'],
  d6_impedimento_pagamento_v1: ['nome', 'vencimento', 'valor', 'placa'],
  d7_reforco_contato_v1: ['nome', 'vencimento'],
  d8_urgencia_revistoria_v1: ['nome'],
  d9_alerta_retirada_v1: ['nome', 'vencimento'],
  d10_ultima_tentativa_v1: ['nome'],
  d11_aviso_negativacao_v1: ['nome', 'vencimento', 'valor', 'placa'],
  d12_debito_com_multa_v1: ['nome', 'vencimento', 'valor', 'placa'],
  d13_regularize_cadastro_v1: ['nome', 'vencimento'],
  d14_d61_reativacao_protecao_v1: ['nome'],
};

/** Templates que dependem da linha digitável vinda do SGA. */
export const TEMPLATES_REQUEREM_SGA: string[] = Object.entries(TEMPLATE_PARAMS_MAP)
  .filter(([, vars]) => vars.includes('linha_digitavel'))
  .map(([nome]) => nome);

export function getTemplateParams(nome?: string | null): CobrancaVar[] | null {
  if (!nome) return null;
  return TEMPLATE_PARAMS_MAP[nome] ?? null;
}
