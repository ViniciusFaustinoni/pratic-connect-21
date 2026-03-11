/**
 * Mapeamento de regiões do formulário → slugs da tabela de preços.
 * Fonte única de verdade para conversão entre nomes de UI e slugs do banco.
 */

const MAPA_REGIAO_PRICING: Record<string, string> = {
  'rio_de_janeiro': 'rj',
  'regiao_lagos': 'lagos',
  'sao_paulo': 'sp',
  'interior_rj': 'rj',
  'interior_sp': 'sp',
};

/**
 * Converte o nome de região do formulário/cotação no slug esperado
 * pela tabela `tabelas_preco_mensalidade`.
 * Se já for um slug válido (ex: 'rj'), retorna sem alteração.
 */
export function mapearRegiaoParaPricing(regiao: string): string {
  if (!regiao) return 'rj';
  const lower = regiao.toLowerCase();
  return MAPA_REGIAO_PRICING[lower] || lower;
}

/**
 * Normaliza o combustível do veículo para o slug esperado pela tabela de preços.
 * A tabela `tabelas_preco_mensalidade` só tem 'gasolina', 'diesel' ou NULL.
 * Veículos flex, etanol, híbridos, GNV → usam preço de 'gasolina'.
 * Veículos diesel → usam preço de 'diesel'.
 */
export function normalizarCombustivelParaPricing(combustivel?: string | null): string {
  if (!combustivel) return 'gasolina';
  
  const lower = combustivel.toLowerCase().trim();
  
  // Diesel direto
  if (lower === 'diesel') return 'diesel';
  if (lower.includes('diesel') && !lower.includes('gasolina')) return 'diesel';
  
  // Tudo que tem gasolina, flex, etanol, álcool, elétrico, híbrido, GNV → gasolina
  return 'gasolina';
}
