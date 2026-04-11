/**
 * Gera posições de assinatura para documentos Autentique:
 * - INITIALS (rubrica) em todas as páginas exceto a última
 * - SIGNATURE (assinatura completa) na última página
 * 
 * O total de páginas é estimado dinamicamente a partir do HTML.
 * Páginas inexistentes são ignoradas pela API da Autentique,
 * então é seguro usar um número ligeiramente acima do real.
 */

export interface PosicoesConfig {
  rubricaX?: string;
  rubricaY?: string;
  assinaturaX?: string;
  assinaturaY?: string;
  totalPaginas?: number;
}

/**
 * Estima o número de páginas de um HTML A4 baseado no tamanho do conteúdo.
 * Heurística conservadora: ~2000 caracteres de HTML = ~1 página A4.
 * Adiciona margem de +2 páginas para garantir que SIGNATURE fique na última página real.
 * Páginas excedentes são ignoradas pela API da Autentique.
 */
export function estimarPaginasHTML(html: string): number {
  if (!html) return 1;
  
  // Remover tags de estilo/script para contar apenas conteúdo visual
  const semEstilos = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  
  // Contar page-breaks explícitos
  const pageBreaks = (html.match(/page-break-before\s*:\s*always/gi) || []).length;
  
  // Estimar pela quantidade de conteúdo (~2000 chars HTML = 1 página A4 — conservador)
  const paginasPorConteudo = Math.ceil(semEstilos.length / 2000);
  
  // Usar o maior entre os dois métodos
  const estimativa = Math.max(paginasPorConteudo, pageBreaks + 1);
  
  // Adicionar 2 de margem, mínimo 2 (para ter ao menos 1 página de rubrica + 1 de assinatura)
  const total = Math.max(2, estimativa + 2);
  
  console.log(`[autentique-positions] Estimativa de páginas: ${total} (conteúdo: ${paginasPorConteudo}, page-breaks: ${pageBreaks}, HTML: ${html.length} bytes)`);
  
  return total;
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

  // INITIALS (rubrica) em todas as páginas exceto a última
  for (let p = 1; p < totalPaginas; p++) {
    positions.push({
      x: rubricaX,
      y: rubricaY,
      z: String(p),
      element: "INITIALS",
    });
  }

  // SIGNATURE (assinatura completa) apenas na última página
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
