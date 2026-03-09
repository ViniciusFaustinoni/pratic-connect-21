// ============================================
// MAPEAMENTO CENTRALIZADO DE RESTRIÇÕES POR CATEGORIA DE VEÍCULO
// Fonte primária: tabela benefit_category_exclusions (banco de dados)
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
 * Labels amigáveis para as categorias de veículo.
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

// Cache local para exclusões
let exclusionsCache: BenefitExclusionData[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export async function fetchBenefitExclusions(): Promise<BenefitExclusionData[]> {
  const now = Date.now();
  if (exclusionsCache && now - cacheTimestamp < CACHE_DURATION) {
    return exclusionsCache;
  }
  try {
    const { data, error } = await supabase
      .from('benefit_category_exclusions')
      .select(`id, benefit_id, categoria_veiculo, benefits:benefit_id (name)`);
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

export function clearExclusionsCache(): void {
  exclusionsCache = null;
  cacheTimestamp = 0;
}

export function isCoberturaRemovida(
  cobertura: string, 
  categoria: string | undefined | null,
  exclusions?: BenefitExclusionData[]
): boolean {
  if (!categoria || categoria === 'nenhuma') return false;
  const coberturaLower = cobertura.toLowerCase();
  if (exclusions && exclusions.length > 0) {
    return exclusions.some(
      (exc) => exc.categoria_veiculo === categoria &&
        exc.benefit_name?.toLowerCase().includes(coberturaLower)
    );
  }
  return false;
}

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

export function getCoberturasRemovidas(categoria: string | undefined | null): string[] {
  if (!categoria || categoria === 'nenhuma') return [];
  return [];
}

export function getCoberturasRemovidasDinamico(
  categoria: string | undefined | null,
  exclusions: BenefitExclusionData[]
): string[] {
  if (!categoria || categoria === 'nenhuma') return [];
  return exclusions
    .filter(exc => exc.categoria_veiculo === categoria)
    .map(exc => exc.benefit_name || '')
    .filter(Boolean);
}

export function getRestricaoCategoria(categoria: string | undefined | null): RestricaoCategoria | null {
  if (!categoria || categoria === 'nenhuma') return null;
  return null;
}

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

export function gerarMensagemAlertaCategoria(
  categoria: string | undefined | null,
  exclusions: BenefitExclusionData[]
): string | null {
  if (!categoria || categoria === 'nenhuma') return null;
  const beneficiosExcluidos = [...getBenefitsExcludedForCategory(categoria, exclusions)];
  if (beneficiosExcluidos.length === 0) return null;
  const prefixo = CATEGORIA_LABELS[categoria] || 'Esta categoria';
  if (beneficiosExcluidos.length === 1) {
    return `${prefixo}: sem cobertura de ${beneficiosExcluidos[0]}`;
  }
  const ultimoBeneficio = beneficiosExcluidos.pop();
  return `${prefixo}: sem cobertura de ${beneficiosExcluidos.join(', ')} e ${ultimoBeneficio}`;
}

export function gerarResumoExclusoesParaPreview(exclusions: Map<string, string[]>): string[] {
  const alertas: string[] = [];
  exclusions.forEach((categorias) => {
    if (categorias.length === 0) return;
    const labels = categorias.map(cat => CATEGORIA_LABELS[cat] || cat);
    if (labels.length === 1) alertas.push(`${labels[0]}`);
    else if (labels.length === 2) alertas.push(`${labels[0]} e ${labels[1]}`);
    else { const ultimo = labels.pop(); alertas.push(`${labels.join(', ')} e ${ultimo}`); }
  });
  return alertas;
}

export function gerarAlertasExclusaoPreview(
  exclusions: Map<string, string[]>,
  benefitsMap: Map<string, string>
): Array<{ benefitName: string; categorias: string[] }> {
  const alertas: Array<{ benefitName: string; categorias: string[] }> = [];
  exclusions.forEach((categorias, benefitId) => {
    if (categorias.length === 0) return;
    const benefitName = benefitsMap.get(benefitId) || benefitId;
    const categoriasLabels = categorias.map(cat => CATEGORIA_LABELS[cat] || cat);
    alertas.push({ benefitName, categorias: categoriasLabels });
  });
  return alertas;
}
