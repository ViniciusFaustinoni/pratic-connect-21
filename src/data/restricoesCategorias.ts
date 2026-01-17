// ============================================
// MAPEAMENTO CENTRALIZADO DE RESTRIÇÕES POR CATEGORIA DE VEÍCULO
// ============================================

export interface RestricaoCategoria {
  coberturasRemovidas: string[];
  mensagemAlerta: string;
  tipoAlerta: 'warning' | 'info' | 'error';
}

/**
 * Mapa de restrições por categoria de veículo.
 * Define quais coberturas são removidas e mensagens de alerta específicas.
 */
export const RESTRICOES_CATEGORIA: Record<string, RestricaoCategoria> = {
  leilao: {
    coberturasRemovidas: ['incêndio', 'incendio'],
    mensagemAlerta: 'Veículo de leilão: sem cobertura de incêndio',
    tipoAlerta: 'warning',
  },
  chassi_remarcado: {
    coberturasRemovidas: ['incêndio', 'incendio'],
    mensagemAlerta: 'Chassi remarcado: sem cobertura de incêndio, sujeito à análise',
    tipoAlerta: 'warning',
  },
  ressarcimento_integral: {
    coberturasRemovidas: ['incêndio', 'incendio', 'perda total'],
    mensagemAlerta: 'Ressarcimento integral anterior: coberturas limitadas',
    tipoAlerta: 'warning',
  },
  taxi: {
    coberturasRemovidas: [],
    mensagemAlerta: 'Categoria Táxi: valores diferenciados aplicados',
    tipoAlerta: 'info',
  },
  ex_taxi: {
    coberturasRemovidas: [],
    mensagemAlerta: 'Ex-Táxi: análise de quilometragem pode ser necessária',
    tipoAlerta: 'info',
  },
  placa_vermelha: {
    coberturasRemovidas: [],
    mensagemAlerta: 'Placa vermelha: veículo de teste/exposição',
    tipoAlerta: 'info',
  },
  aplicativo: {
    coberturasRemovidas: [],
    mensagemAlerta: 'Uso APP: cota de participação 8% (mín R$ 3.000)',
    tipoAlerta: 'info',
  },
  nenhuma: {
    coberturasRemovidas: [],
    mensagemAlerta: '',
    tipoAlerta: 'info',
  },
};

/**
 * Verifica se uma cobertura específica está removida para a categoria do veículo.
 * @param cobertura - Nome da cobertura a verificar
 * @param categoria - Categoria do veículo
 * @returns true se a cobertura não está disponível para esta categoria
 */
export function isCoberturaRemovida(cobertura: string, categoria: string | undefined | null): boolean {
  if (!categoria || categoria === 'nenhuma') return false;
  
  const restricoes = RESTRICOES_CATEGORIA[categoria];
  if (!restricoes) return false;
  
  const coberturaLower = cobertura.toLowerCase();
  
  return restricoes.coberturasRemovidas.some(
    removida => coberturaLower.includes(removida.toLowerCase())
  );
}

/**
 * Obtém as coberturas removidas para uma categoria específica.
 * @param categoria - Categoria do veículo
 * @returns Lista de nomes de coberturas que estão removidas
 */
export function getCoberturasRemovidas(categoria: string | undefined | null): string[] {
  if (!categoria || categoria === 'nenhuma') return [];
  
  const restricoes = RESTRICOES_CATEGORIA[categoria];
  return restricoes?.coberturasRemovidas || [];
}

/**
 * Obtém a restrição completa para uma categoria.
 * @param categoria - Categoria do veículo
 * @returns Objeto com informações de restrição ou null
 */
export function getRestricaoCategoria(categoria: string | undefined | null): RestricaoCategoria | null {
  if (!categoria || categoria === 'nenhuma') return null;
  return RESTRICOES_CATEGORIA[categoria] || null;
}
