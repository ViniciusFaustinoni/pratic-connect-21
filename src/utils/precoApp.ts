// ============================================
// UTILITÁRIO: Resolução de preço para planos APP
// Regras de adicional por região/linha/tipo_uso
// ============================================

/**
 * Determina qual tipo_uso usar na query de busca em tabelas_preco_mensalidade.
 * 
 * - select-one + RJ/Lagos + aplicativo → busca 'aplicativo' (coluna própria na tabela)
 * - Todos os outros → busca 'particular' (o adicional é somado depois se necessário)
 */
export function resolverTipoUsoQuery(
  linhaSlug: string,
  regiao: string,
  tipoUso: string,
): string {
  const regiaoLower = regiao.toLowerCase();
  const linhaLower = linhaSlug.toLowerCase();

  // Select One RJ/Lagos app: tem coluna própria na tabela de preços
  if (
    linhaLower === 'select-one' &&
    (regiaoLower === 'rj' || regiaoLower === 'lagos') &&
    tipoUso === 'aplicativo'
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
 * REGRA 4: demais → valor direto
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
