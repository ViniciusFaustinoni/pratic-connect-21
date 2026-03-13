/**
 * Gera posições de assinatura para documentos Autentique:
 * - INITIALS (rubrica) em todas as páginas exceto a última
 * - SIGNATURE (assinatura completa) na última página
 * 
 * Páginas inexistentes são ignoradas pela API da Autentique,
 * então é seguro usar um número alto como máximo.
 */

export interface PosicoesConfig {
  rubricaX?: string;
  rubricaY?: string;
  assinaturaX?: string;
  assinaturaY?: string;
  totalPaginas?: number;
}

export function gerarPosicoesAssinatura(config: PosicoesConfig = {}) {
  const {
    rubricaX = "78.0",
    rubricaY = "95.0",
    assinaturaX = "65.0",
    assinaturaY = "85.0",
    totalPaginas = 20,
  } = config;

  const positions: Array<{ x: string; y: string; z: string; element: string }> = [];

  // Rubrica (INITIALS) em todas as páginas exceto a última
  for (let p = 1; p < totalPaginas; p++) {
    positions.push({
      x: rubricaX,
      y: rubricaY,
      z: String(p),
      element: "INITIALS",
    });
  }

  // Assinatura completa na última página
  positions.push({
    x: assinaturaX,
    y: assinaturaY,
    z: String(totalPaginas),
    element: "SIGNATURE",
  });

  return positions;
}

/**
 * Busca as configurações de posição do banco de dados.
 * Requer um client Supabase já autenticado como service_role.
 */
export async function buscarPosicoesConfig(supabaseClient: any): Promise<PosicoesConfig> {
  const chaves = [
    'rubrica_posicao_x',
    'rubrica_posicao_y',
    'assinatura_posicao_x',
    'assinatura_posicao_y',
    'assinatura_total_paginas',
  ];

  const { data } = await supabaseClient
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', chaves);

  const map: Record<string, string> = {};
  data?.forEach((row: { chave: string; valor: string | null }) => {
    if (row.valor) map[row.chave] = row.valor;
  });

  return {
    rubricaX: map['rubrica_posicao_x'],
    rubricaY: map['rubrica_posicao_y'],
    assinaturaX: map['assinatura_posicao_x'],
    assinaturaY: map['assinatura_posicao_y'],
    totalPaginas: map['assinatura_total_paginas'] ? Number(map['assinatura_total_paginas']) : undefined,
  };
}
