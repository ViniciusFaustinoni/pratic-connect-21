export type TipoLancamentoComissao = 'todos' | 'comum' | 'vitalicia' | 'valor_fixo' | 'percentual' | string;

export const COMISSOES_STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'paga', label: 'Paga' },
  { value: 'contestada', label: 'Contestada' },
  { value: 'cancelada', label: 'Cancelada' },
] as const;

export const COMISSOES_TIPO_LANCAMENTO_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'comum', label: 'Comum/recorrente' },
  { value: 'vitalicia', label: 'Vitalícia' },
  { value: 'valor_fixo', label: 'Valor fixo' },
  { value: 'percentual', label: 'Percentual' },
] as const;

export const isComissaoVitalicia = (item: { tipo_comissao?: string | null; parcela_numero?: number | null }) =>
  (item.tipo_comissao || '').toLowerCase().includes('vitalicia') || (item.parcela_numero || 0) > 12;

export const matchesTipoLancamentoComissao = (
  item: { tipo_comissao?: string | null; tipo_calculo?: string | null; percentual_aplicado?: number | string | null; parcela_numero?: number | null },
  tipo: TipoLancamentoComissao,
) => {
  if (!tipo || tipo === 'todos') return true;
  const tipoComissao = (item.tipo_comissao || '').toLowerCase();
  const tipoCalculo = (item.tipo_calculo || '').toLowerCase();
  const percentual = Number(item.percentual_aplicado || 0);

  if (tipo === 'vitalicia') return isComissaoVitalicia(item);
  if (tipo === 'valor_fixo') return tipoCalculo === 'valor_fixo' || tipoComissao === 'valor_fixo';
  if (tipo === 'percentual') return tipoCalculo === 'percentual' || percentual > 0;
  if (tipo === 'comum') return !isComissaoVitalicia(item) && tipoCalculo !== 'valor_fixo' && tipoComissao !== 'valor_fixo';

  return tipoComissao === tipo || tipoCalculo === tipo;
};

export const dateStringToDate = (value: string) => new Date(`${value}T00:00:00`);
export const dateToDateString = (date: Date) => date.toISOString().slice(0, 10);