/**
 * Resolve o nome do veículo no formato canônico esperado pelo termo de filiação
 * e pelas filas operacionais (Cadastro, Monitoramento).
 *
 * Ordem de preferência:
 *   1. Descrição oficial da FIPE (ex.: "ARGO 1.0 FIRE FLEX 5p")
 *   2. Marca/Modelo cru do DETRAN sem o prefixo da marca (ex.: "ARGO 1.0")
 *   3. Fallback: modelo curto do DETRAN (ex.: "argo")
 *
 * Por que isso importa: salvar só "argo" no `veiculo_modelo` faz o termo sair
 * como "FIAT ARGO" sem cilindrada/variante. A string canônica já carrega
 * cilindrada, combustível e número de portas — não precisa de coluna extra.
 *
 * Ver `mem://logic/quotation/fipe-variant-selection-heuristica`.
 */
export function resolverModeloCanonico(opts: {
  fipeDescricao?: string | null;
  marcaModeloDetran?: string | null;
  modeloCurtoDetran?: string | null;
  marca?: string | null;
}): string {
  const fipe = (opts.fipeDescricao || '').trim();
  if (fipe) return fipe;

  const marcaModelo = (opts.marcaModeloDetran || '').trim();
  if (marcaModelo) {
    // "FIAT/ARGO 1.0" → "ARGO 1.0"
    const partes = marcaModelo.split('/');
    if (partes.length > 1) {
      const semMarca = partes.slice(1).join('/').trim();
      if (semMarca) return semMarca;
    }
    // Sem barra: tenta remover marca duplicada do início ("FIAT ARGO 1.0" → "ARGO 1.0")
    const marca = (opts.marca || '').trim().toUpperCase();
    const up = marcaModelo.toUpperCase();
    if (marca && up.startsWith(marca + ' ')) {
      return marcaModelo.slice(marca.length).trim();
    }
    return marcaModelo;
  }

  return (opts.modeloCurtoDetran || '').trim();
}
