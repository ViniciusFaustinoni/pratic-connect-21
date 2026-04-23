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

/** Contexto de dados para renderizar um preview de mensagem. */
export interface PreviewContexto {
  nome?: string | null;
  valor?: number | null;
  vencimento?: string | null; // ISO ou yyyy-mm-dd
  mes_ano?: string | null;
  placa?: string | null;
  modelo?: string | null;
  linha_digitavel?: string | null;
}

const MOCK_PADRAO: Required<PreviewContexto> = {
  nome: 'João da Silva',
  valor: 189.9,
  vencimento: new Date().toISOString().slice(0, 10),
  mes_ano: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  placa: 'ABC1D23',
  modelo: 'Honda Civic',
  linha_digitavel: '23793.38128 60082.345678 90000.123456 7 98760000018990',
};

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDataBR = (iso: string) => {
  if (!iso) return '';
  // Aceita "yyyy-mm-dd" ou ISO completo
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR');
};

const formatMesAno = (iso: string) => {
  if (!iso) return '';
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

/**
 * Resolve o valor textual de uma variável para preview, usando o contexto
 * e caindo em mocks padrão quando o campo está vazio.
 */
export function resolveVarValue(v: CobrancaVar, ctx: PreviewContexto): string {
  switch (v) {
    case 'nome':
      return (ctx.nome ?? MOCK_PADRAO.nome) || MOCK_PADRAO.nome;
    case 'valor':
      return formatBRL(ctx.valor ?? MOCK_PADRAO.valor);
    case 'vencimento':
      return formatDataBR(ctx.vencimento ?? MOCK_PADRAO.vencimento);
    case 'mes_ano':
      return ctx.mes_ano ?? formatMesAno(ctx.vencimento ?? MOCK_PADRAO.vencimento);
    case 'placa':
      return (ctx.placa ?? MOCK_PADRAO.placa) || MOCK_PADRAO.placa;
    case 'modelo':
      return (ctx.modelo ?? MOCK_PADRAO.modelo) || MOCK_PADRAO.modelo;
    case 'linha_digitavel':
      return (ctx.linha_digitavel ?? MOCK_PADRAO.linha_digitavel) || MOCK_PADRAO.linha_digitavel;
    default:
      return '';
  }
}

/**
 * Substitui {{1}}, {{2}}, ... no corpo do template pelos valores
 * reais (ou mocks) do contexto, na ordem definida em TEMPLATE_PARAMS_MAP.
 */
export function renderTemplatePreview(
  templateNome: string | null | undefined,
  corpo: string | null | undefined,
  ctx: PreviewContexto
): string {
  if (!corpo) return '';
  const vars = templateNome ? TEMPLATE_PARAMS_MAP[templateNome] : null;
  if (!vars) {
    // Sem mapeamento conhecido — devolve o corpo cru, mantendo {{N}} visível
    return corpo;
  }
  return corpo.replace(/\{\{(\d+)\}\}/g, (_match, idxStr) => {
    const idx = parseInt(idxStr, 10) - 1;
    const v = vars[idx];
    if (!v) return `{{${idxStr}}}`;
    return resolveVarValue(v, ctx);
  });
}
