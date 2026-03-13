/**
 * Gera posições de assinatura para documentos Autentique:
 * - INITIALS (rubrica) em todas as páginas exceto a última
 * - SIGNATURE (assinatura completa) na última página
 * 
 * Páginas inexistentes são ignoradas pela API da Autentique,
 * então é seguro usar um número alto como máximo.
 */
export function gerarPosicoesAssinatura(totalPaginas = 20) {
  const positions: Array<{ x: string; y: string; z: string; element: string }> = [];

  // Rubrica (INITIALS) em todas as páginas exceto a última
  for (let p = 1; p < totalPaginas; p++) {
    positions.push({
      x: "78.0",
      y: "95.0",
      z: String(p),
      element: "INITIALS",
    });
  }

  // Assinatura completa na última página
  positions.push({
    x: "65.0",
    y: "85.0",
    z: String(totalPaginas),
    element: "SIGNATURE",
  });

  return positions;
}
