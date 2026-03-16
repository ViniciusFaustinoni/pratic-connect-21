// ============================================
// UTILITÁRIO: Resolução de preço para planos APP
// 100% dinâmico — nenhuma região ou linha hardcoded
// ============================================

/**
 * Configuração dinâmica para resolução de preço de aplicativo.
 * Todos os valores vêm do banco de dados.
 */
export interface ConfigAdicionalApp {
  /** Regiões onde o uso como aplicativo exige adicional mensal (ex: ["rj","lagos"]) */
  regioesComAdicional: string[];
  /** Linhas que possuem coluna dedicada 'aplicativo' na tabela de preços (ex: ["select-one"]) */
  linhasComColunaApp: string[];
  /** Linhas que suportam uso de aplicativo (campo supports_app=true em product_lines) */
  linhasSupportsApp: string[];
}

/**
 * Determina qual tipo_uso usar na query de busca em tabelas_preco_mensalidade.
 *
 * - Se a linha tem coluna dedicada 'aplicativo' na tabela de preços E
 *   a região exige adicional → busca 'aplicativo' (valor direto)
 * - Todos os outros → busca 'particular' (o adicional é somado depois se necessário)
 * - Tipos que não são 'aplicativo' nem 'particular' (ex: 'advanced', 'advanced-plus')
 *   são retornados diretamente (usados por motos)
 */
export function resolverTipoUsoQuery(
  linhaSlug: string,
  regiao: string,
  tipoUso: string,
  config: ConfigAdicionalApp,
): string {
  const tipoUsoLower = tipoUso.toLowerCase();
  const linhaLower = linhaSlug.toLowerCase();
  const regiaoLower = regiao.toLowerCase();

  // Se o tipo_uso não é 'particular' nem 'aplicativo', é um tipo específico de linha (motos)
  if (tipoUsoLower !== 'particular' && tipoUsoLower !== 'aplicativo') {
    return tipoUsoLower;
  }

  // Se não é aplicativo, retorna particular
  if (tipoUsoLower !== 'aplicativo') {
    return 'particular';
  }

  // Aplicativo: verificar se a linha tem coluna dedicada E a região exige adicional
  const temColunaApp = config.linhasComColunaApp.includes(linhaLower);
  const regiaoExigeAdicional = config.regioesComAdicional.includes(regiaoLower);

  if (temColunaApp && regiaoExigeAdicional) {
    return 'aplicativo';
  }

  // Todos os outros: busca como 'particular'
  return 'particular';
}

/**
 * Aplica o adicional de aplicativo sobre o valor mensal quando necessário.
 *
 * O adicional só é somado quando TODAS as condições são verdadeiras:
 * 1. tipoUso é 'aplicativo'
 * 2. A linha suporta aplicativo (supports_app=true)
 * 3. A região exige adicional
 * 4. A linha NÃO tem coluna dedicada (se tem, o valor já veio correto da tabela)
 */
export function resolverPrecoApp(
  linhaSlug: string,
  regiao: string,
  tipoUso: string,
  valorMensalParticular: number,
  adicionalApp: number,
  config: ConfigAdicionalApp,
): number {
  if (tipoUso !== 'aplicativo') {
    return valorMensalParticular;
  }

  const linhaLower = linhaSlug.toLowerCase();
  const regiaoLower = regiao.toLowerCase();

  // Se a linha não suporta app, retorna direto
  if (!config.linhasSupportsApp.includes(linhaLower)) {
    return valorMensalParticular;
  }

  // Se a linha tem coluna dedicada na tabela de preços, o valor já veio correto
  if (config.linhasComColunaApp.includes(linhaLower)) {
    return valorMensalParticular;
  }

  // Se a região não exige adicional, retorna direto
  if (!config.regioesComAdicional.includes(regiaoLower)) {
    return valorMensalParticular;
  }

  // Região exige adicional + linha suporta app + sem coluna dedicada → soma adicional
  return valorMensalParticular + adicionalApp;
}
