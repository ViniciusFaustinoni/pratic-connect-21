// ============================================
// UTILITÁRIO: Resolução de preço para planos APP
// Regras de adicional por região/linha/tipo_uso
// ============================================

// Tipos de uso que são específicos de linha (motos, etc.)
// e devem ser passados diretamente para a query sem alteração.
const TIPOS_USO_ESPECIFICOS = ['advanced', 'advanced-plus'];

/**
 * Determina qual tipo_uso usar na query de busca em tabelas_preco_mensalidade.
 * 
 * - Valores específicos de linha (advanced, advanced-plus) → retorna direto
 * - select-one + RJ/Lagos + aplicativo → busca 'aplicativo' (coluna própria na tabela)
 * - Todos os outros → busca 'particular' (o adicional é somado depois se necessário)
 */
export function resolverTipoUsoQuery(
  linhaSlug: string,
  regiao: string,
  tipoUso: string,
): string {
  const tipoUsoLower = tipoUso.toLowerCase();

  // Tipos específicos de linha (motos advanced/advanced-plus) → retorna direto
  if (TIPOS_USO_ESPECIFICOS.includes(tipoUsoLower)) {
    return tipoUsoLower;
  }

  const regiaoLower = regiao.toLowerCase();
  const linhaLower = linhaSlug.toLowerCase();

  // Select One RJ/Lagos app: tem coluna própria na tabela de preços
  if (
    linhaLower === 'select-one' &&
    (regiaoLower === 'rj' || regiaoLower === 'lagos') &&
    tipoUsoLower === 'aplicativo'
  ) {
    return 'aplicativo';
  }

  // Todos os outros: busca como 'particular'
  return 'particular';
}

/**
 * Aplica o adicional de aplicativo sobre o valor mensal quando necessário.
 * 
 * REGRA 1: select/lancamento + RJ/Lagos + aplicativo → particular + adicionalApp
 * REGRA 2: select-one + RJ/Lagos + aplicativo → valor direto (já veio da coluna 'aplicativo')
 * REGRA 3: SP + aplicativo → valor direto (SP não tem distinção passeio/app)
 * REGRA 4: advanced/advanced-plus → valor direto (motos não têm adicional app)
 * REGRA 5: demais → valor direto
 */
export function resolverPrecoApp(
  linhaSlug: string,
  regiao: string,
  tipoUso: string,
  valorMensalParticular: number,
  adicionalApp: number,
): number {
  if (tipoUso !== 'aplicativo') {
    return valorMensalParticular;
  }

  const regiaoLower = regiao.toLowerCase();
  const linhaLower = linhaSlug.toLowerCase();

  // Advanced/Advanced-plus (motos): sem adicional app
  if (TIPOS_USO_ESPECIFICOS.includes(linhaLower)) {
    return valorMensalParticular;
  }

  // SP: valor único para passeio e app — sem adicional
  if (regiaoLower === 'sp') {
    return valorMensalParticular;
  }

  // Select One RJ/Lagos: coluna própria na tabela — retornado direto
  if (linhaLower === 'select-one') {
    return valorMensalParticular;
  }

  // Select / Lançamento RJ/Lagos: particular + adicional_app
  if (
    (linhaLower === 'select' || linhaLower === 'lancamento') &&
    (regiaoLower === 'rj' || regiaoLower === 'lagos')
  ) {
    return valorMensalParticular + adicionalApp;
  }

  // Todos os demais: valor direto
  return valorMensalParticular;
}
