// ============================================
// MAPEAMENTO CENTRALIZADO DE RESTRIÇÕES POR CATEGORIA DE VEÍCULO
// ============================================

import { supabase } from '@/integrations/supabase/client';

export interface RestricaoCategoria {
  coberturasRemovidas: string[];
  mensagemAlerta: string;
  tipoAlerta: 'warning' | 'info' | 'error';
}

export interface BenefitExclusionData {
  id: string;
  benefit_id: string;
  categoria_veiculo: string;
  benefit_name?: string;
}

/**
 * Mapa de restrições estáticas por categoria de veículo (fallback).
 * As exclusões dinâmicas do banco de dados têm prioridade.
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

// Cache local para exclusões (evita múltiplas queries)
let exclusionsCache: BenefitExclusionData[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Busca as exclusões de benefícios do banco de dados
 */
export async function fetchBenefitExclusions(): Promise<BenefitExclusionData[]> {
  const now = Date.now();
  
  // Retornar cache se ainda válido
  if (exclusionsCache && now - cacheTimestamp < CACHE_DURATION) {
    return exclusionsCache;
  }
  
  try {
    const { data, error } = await supabase
      .from('benefit_category_exclusions')
      .select(`
        id,
        benefit_id,
        categoria_veiculo,
        benefits:benefit_id (name)
      `);
    
    if (error) throw error;
    
    exclusionsCache = (data || []).map((item: any) => ({
      id: item.id,
      benefit_id: item.benefit_id,
      categoria_veiculo: item.categoria_veiculo,
      benefit_name: item.benefits?.name || '',
    }));
    cacheTimestamp = now;
    
    return exclusionsCache;
  } catch (error) {
    console.error('Erro ao buscar exclusões de benefícios:', error);
    return [];
  }
}

/**
 * Limpa o cache de exclusões (chamar após editar um benefício)
 */
export function clearExclusionsCache(): void {
  exclusionsCache = null;
  cacheTimestamp = 0;
}

/**
 * Verifica se uma cobertura/benefício está excluído para a categoria.
 * Usa exclusões do banco de dados + mapa estático como fallback.
 * 
 * @param cobertura - Nome da cobertura/benefício
 * @param categoria - Categoria do veículo
 * @param exclusions - Array de exclusões pré-carregadas (opcional)
 */
export function isCoberturaRemovida(
  cobertura: string, 
  categoria: string | undefined | null,
  exclusions?: BenefitExclusionData[]
): boolean {
  if (!categoria || categoria === 'nenhuma') return false;
  
  const coberturaLower = cobertura.toLowerCase();
  
  // Se exclusões do banco foram passadas, verificar primeiro
  if (exclusions && exclusions.length > 0) {
    const isExcludedInDb = exclusions.some(
      (exc) => 
        exc.categoria_veiculo === categoria &&
        exc.benefit_name?.toLowerCase().includes(coberturaLower)
    );
    if (isExcludedInDb) return true;
  }
  
  // Fallback para mapa estático
  const restricoes = RESTRICOES_CATEGORIA[categoria];
  if (!restricoes) return false;
  
  return restricoes.coberturasRemovidas.some(
    removida => coberturaLower.includes(removida.toLowerCase())
  );
}

/**
 * Verifica se um benefício (por ID) está excluído para a categoria.
 * Versão mais precisa que usa o ID do benefício.
 */
export function isBenefitExcludedById(
  benefitId: string,
  categoria: string | undefined | null,
  exclusions: BenefitExclusionData[]
): boolean {
  if (!categoria || categoria === 'nenhuma' || !benefitId) return false;
  
  return exclusions.some(
    (exc) => exc.benefit_id === benefitId && exc.categoria_veiculo === categoria
  );
}

/**
 * Obtém as coberturas removidas para uma categoria específica (estáticas).
 */
export function getCoberturasRemovidas(categoria: string | undefined | null): string[] {
  if (!categoria || categoria === 'nenhuma') return [];
  
  const restricoes = RESTRICOES_CATEGORIA[categoria];
  return restricoes?.coberturasRemovidas || [];
}

/**
 * Obtém a restrição completa para uma categoria.
 */
export function getRestricaoCategoria(categoria: string | undefined | null): RestricaoCategoria | null {
  if (!categoria || categoria === 'nenhuma') return null;
  return RESTRICOES_CATEGORIA[categoria] || null;
}

/**
 * Obtém nomes de benefícios excluídos para uma categoria (do banco)
 */
export function getBenefitsExcludedForCategory(
  categoria: string,
  exclusions: BenefitExclusionData[]
): string[] {
  if (!categoria || categoria === 'nenhuma') return [];
  
  return exclusions
    .filter((exc) => exc.categoria_veiculo === categoria)
    .map((exc) => exc.benefit_name || '')
    .filter(Boolean);
}

/**
 * Labels amigáveis para as categorias de veículo
 */
const CATEGORIA_LABELS: Record<string, string> = {
  leilao: 'Veículo de leilão',
  chassi_remarcado: 'Chassi remarcado',
  ressarcimento_integral: 'Ressarcimento integral',
  taxi: 'Táxi',
  ex_taxi: 'Ex-Táxi',
  placa_vermelha: 'Placa vermelha',
  aplicativo: 'Uso para aplicativo',
};

/**
 * Gera mensagem de alerta dinâmica baseada nas exclusões configuradas no banco.
 * Usa fallback para mensagem estática se não houver exclusões.
 */
export function gerarMensagemAlertaCategoria(
  categoria: string | undefined | null,
  exclusions: BenefitExclusionData[]
): string | null {
  if (!categoria || categoria === 'nenhuma') return null;
  
  // Buscar benefícios excluídos para esta categoria
  const beneficiosExcluidos = getBenefitsExcludedForCategory(categoria, exclusions);
  
  if (beneficiosExcluidos.length === 0) {
    // Fallback para mensagem estática se não houver exclusões configuradas
    const restricaoEstatica = RESTRICOES_CATEGORIA[categoria];
    return restricaoEstatica?.mensagemAlerta || null;
  }
  
  // Gerar mensagem dinâmica
  const prefixo = CATEGORIA_LABELS[categoria] || 'Esta categoria';
  
  if (beneficiosExcluidos.length === 1) {
    return `${prefixo}: sem cobertura de ${beneficiosExcluidos[0]}`;
  }
  
  // Múltiplos benefícios excluídos
  const ultimoBeneficio = beneficiosExcluidos.pop();
  const beneficiosTexto = beneficiosExcluidos.join(', ') + ' e ' + ultimoBeneficio;
  return `${prefixo}: sem cobertura de ${beneficiosTexto}`;
}
