import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  ProductLine, 
  Benefit, 
  MainCoverage,
} from '@/types/plans';

// IDs de benefícios conhecidos
const REBOQUE_BENEFIT_ID = 'be1fa928-b1fe-4bbb-a402-ec0604bc9e8e';
const COB_ASS_CODIGO = 'COB-ASS';

// Tipo para benefícios de plano
export interface PlanBenefitItem {
  id: string;
  plan_id: string;
  benefit_id: string | null;
  custom_text: string | null;
  custom_value: string | null;
  additional_info: string | null;
  is_highlighted: boolean;
  display_order: number;
  benefits: Benefit | null;
}

// Tipo unificado para planos com campos compatíveis para componentes
export interface PlanWithDetails {
  id: string;
  codigo: string;
  nome: string;
  name: string; // alias para compatibilidade
  slug: string | null;
  descricao: string | null;
  tipo_uso: string;
  tipo_veiculo: string | null;
  product_line_id: string | null;
  cobertura_fipe: number | null;
  ano_minimo: number | null;
  linha: string | null;
  ordem: number | null;
  ordem_exibicao: number | null;
  display_order: number; // alias para compatibilidade
  valor_adesao: number;
  adicional_mensal: number | null;
  desconto_percentual: number | null;
  additional_price: number | null; // alias para compatibilidade
  ativo: boolean;
  is_active: boolean; // alias para compatibilidade
  destaque: boolean | null;
  badge_text: string | null;
  badge_color: string | null;
  coverage_type: string | null;
  min_vehicle_year: string | null; // alias para compatibilidade
  restriction_alert: string | null;
  footer_note: string | null;
  cota_participacao: number | null;
  cota_passeio_percent: number | null; // alias para compatibilidade
  cota_minima: number | null;
  cota_passeio_min: number | null; // alias para compatibilidade
  cota_desagio: number | null;
  cota_desagio_percent: number | null; // alias para compatibilidade
  cota_minima_desagio: number | null;
  cota_desagio_min: number | null; // alias para compatibilidade
  cota_app_percent: number | null;
  cota_app_min: number | null;
  created_at: string;
  updated_at: string;
  product_lines?: ProductLine | null;
  plan_benefits: PlanBenefitItem[]; // compatibilidade com componentes existentes
}

// Alias antigo para compatibilidade
export type PlanoUnificado = PlanWithDetails;

/**
 * Busca os km de assistência (COB-ASS) de planos_coberturas para cada plano.
 * Retorna um Map<planoId, valorLimiteKm>
 */
async function fetchAssistenciaKmMap(planoIds: string[]): Promise<Map<string, number>> {
  if (planoIds.length === 0) return new Map();
  
  const { data, error } = await supabase
    .from('planos_coberturas')
    .select('plano_id, valor_limite, coberturas!inner(codigo)')
    .in('plano_id', planoIds)
    .eq('coberturas.codigo', COB_ASS_CODIGO);
  
  if (error) {
    console.warn('Erro ao buscar km de assistência:', error);
    return new Map();
  }
  
  const map = new Map<string, number>();
  for (const row of data || []) {
    if (row.valor_limite) {
      map.set(row.plano_id, row.valor_limite);
    }
  }
  return map;
}

/**
 * Enriquecer plan_benefits com km dinâmico do Reboque
 */
function enrichBenefitsWithKm(
  planBenefits: PlanBenefitItem[],
  kmAssistencia: number | undefined
): PlanBenefitItem[] {
  return planBenefits.map(pb => {
    if (pb.benefit_id === REBOQUE_BENEFIT_ID && !pb.custom_text && kmAssistencia) {
      return { ...pb, custom_text: `${kmAssistencia}km Reboque` };
    }
    return pb;
  });
}
/**
 * Hook para buscar todas as linhas de produtos ativas
 */
export function useProductLines() {
  return useQuery({
    queryKey: ['product_lines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_lines')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as ProductLine[];
    },
  });
}

/**
 * Hook para buscar linhas de produtos com seus planos
 */
export function useProductLinesWithPlans() {
  return useQuery({
    queryKey: ['product_lines', 'with_plans'],
    queryFn: async () => {
      const { data: lines, error: linesError } = await supabase
        .from('product_lines')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (linesError) throw linesError;

      const { data: planos, error: planosError } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .eq('visivel_gestao', true)
        .order('ordem');

      if (planosError) throw planosError;

      // Agrupar planos por product_line_id
      return (lines || []).map(line => ({
        ...line,
        plans: (planos || []).filter(p => p.product_line_id === line.id)
      }));
    },
  });
}

/**
 * Hook para buscar planos com seus benefícios
 * @param productLineSlug - Opcional: filtrar por slug da linha de produto
 */
export function usePlans(productLineSlug?: string) {
  return useQuery({
    queryKey: ['plans', productLineSlug],
    queryFn: async () => {
      let query = supabase
        .from('planos')
        .select(`
          *,
          product_lines (*),
          planos_beneficios (
            *,
            benefits:benefit_id (*)
          )
        `)
        .eq('ativo', true)
        .eq('visivel_gestao', true)
        .order('ordem');
      
      if (productLineSlug) {
        // Primeiro buscar o product_line_id pelo slug
        const { data: line } = await supabase
          .from('product_lines')
          .select('id')
          .eq('slug', productLineSlug)
          .single();
        
        if (line) {
          query = query.eq('product_line_id', line.id);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Buscar km de assistência para enriquecer Reboque
      const planoIds = (data || []).map(p => p.id);
      const kmMap = await fetchAssistenciaKmMap(planoIds);
      
      // Mapear para formato esperado pelos componentes
      return (data || []).map(plano => {
        const baseBenefits = (plano.planos_beneficios || [])
          .map((pb: any) => ({
            id: pb.id,
            plan_id: pb.plano_id,
            benefit_id: pb.benefit_id,
            custom_text: pb.custom_text,
            custom_value: pb.custom_value,
            additional_info: pb.additional_info,
            is_highlighted: pb.is_highlighted || false,
            display_order: pb.display_order || pb.ordem || 0,
            benefits: pb.benefits,
          }))
          .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
        
        return {
          ...plano,
          name: plano.nome,
          slug: plano.slug || plano.codigo?.toLowerCase(),
          is_active: plano.ativo,
          display_order: plano.ordem || plano.ordem_exibicao || 0,
          additional_price: plano.adicional_mensal,
          min_vehicle_year: plano.ano_minimo ? `${plano.ano_minimo}+` : null,
          cota_passeio_percent: plano.cota_participacao,
          cota_passeio_min: plano.cota_minima,
          cota_desagio_percent: plano.cota_desagio,
          cota_desagio_min: plano.cota_minima_desagio,
          plan_benefits: enrichBenefitsWithKm(baseBenefits, kmMap.get(plano.id)),
        };
      }) as PlanWithDetails[];
    },
  });
}

/**
 * Hook para buscar um plano específico por ID
 * @param id - ID do plano
 */
export function usePlanById(id: string | undefined) {
  return useQuery({
    queryKey: ['plans', 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('planos')
        .select(`
          *,
          product_lines (*),
          planos_beneficios (
            *,
            benefits:benefit_id (*)
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Buscar km de assistência
      const kmMap = await fetchAssistenciaKmMap([data.id]);
      
      const baseBenefits = (data.planos_beneficios || [])
        .map((pb: any) => ({
          id: pb.id,
          plan_id: pb.plano_id,
          benefit_id: pb.benefit_id,
          custom_text: pb.custom_text,
          custom_value: pb.custom_value,
          additional_info: pb.additional_info,
          is_highlighted: pb.is_highlighted || false,
          display_order: pb.display_order || pb.ordem || 0,
          benefits: pb.benefits,
        }))
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
      
      // Mapear para formato esperado
      return {
        ...data,
        name: data.nome,
        slug: data.slug || data.codigo?.toLowerCase(),
        is_active: data.ativo,
        display_order: data.ordem || data.ordem_exibicao || 0,
        additional_price: data.adicional_mensal,
        min_vehicle_year: data.ano_minimo ? `${data.ano_minimo}+` : null,
        cota_passeio_percent: data.cota_participacao,
        cota_passeio_min: data.cota_minima,
        cota_desagio_percent: data.cota_desagio,
        cota_desagio_min: data.cota_minima_desagio,
        plan_benefits: enrichBenefitsWithKm(baseBenefits, kmMap.get(data.id)),
      } as PlanWithDetails;
    },
    enabled: !!id,
  });
}

/**
 * Hook para buscar um plano específico por slug
 * @param slug - Slug do plano
 */
export function usePlanBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['plans', 'by_slug', slug],
    queryFn: async () => {
      if (!slug) throw new Error('Slug é obrigatório');
      
      const { data, error } = await supabase
        .from('planos')
        .select(`
          *,
          product_lines (*),
          planos_beneficios (
            *,
            benefits:benefit_id (*)
          )
        `)
        .or(`slug.eq.${slug},codigo.ilike.${slug}`)
        .single();
      
      if (error) throw error;
      
      const kmMap = await fetchAssistenciaKmMap([data.id]);
      
      const baseBenefits = (data.planos_beneficios || [])
        .map((pb: any) => ({
          id: pb.id,
          plan_id: pb.plano_id,
          benefit_id: pb.benefit_id,
          custom_text: pb.custom_text,
          custom_value: pb.custom_value,
          additional_info: pb.additional_info,
          is_highlighted: pb.is_highlighted || false,
          display_order: pb.display_order || pb.ordem || 0,
          benefits: pb.benefits,
        }))
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
      
      return {
        ...data,
        name: data.nome,
        slug: data.slug || data.codigo?.toLowerCase(),
        is_active: data.ativo,
        display_order: data.ordem || data.ordem_exibicao || 0,
        additional_price: data.adicional_mensal,
        min_vehicle_year: data.ano_minimo ? `${data.ano_minimo}+` : null,
        cota_passeio_percent: data.cota_participacao,
        cota_passeio_min: data.cota_minima,
        cota_desagio_percent: data.cota_desagio,
        cota_desagio_min: data.cota_minima_desagio,
        plan_benefits: enrichBenefitsWithKm(baseBenefits, kmMap.get(data.id)),
      } as PlanWithDetails;
    },
    enabled: !!slug,
  });
}

/**
 * Hook para buscar todos os benefícios disponíveis
 */
export function useBenefits() {
  return useQuery({
    queryKey: ['benefits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefits')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as Benefit[];
    },
  });
}

/**
 * Hook para buscar benefícios por categoria
 * @param category - Categoria do benefício
 */
export function useBenefitsByCategory(category: string) {
  return useQuery({
    queryKey: ['benefits', 'category', category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefits')
        .select('*')
        .eq('is_active', true)
        .eq('category', category)
        .order('display_order');
      
      if (error) throw error;
      return data as Benefit[];
    },
    enabled: !!category,
  });
}

/**
 * Hook para buscar as coberturas principais
 */
export function useMainCoverages() {
  return useQuery({
    queryKey: ['main_coverages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('main_coverages')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as MainCoverage[];
    },
  });
}

/**
 * Hook para buscar planos agrupados por linha de produto
 */
export function usePlansGroupedByLine() {
  return useQuery({
    queryKey: ['plans', 'grouped_by_line'],
    queryFn: async () => {
      // Buscar linhas de produto
      const { data: lines, error: linesError } = await supabase
        .from('product_lines')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (linesError) throw linesError;
      
      // Buscar planos com benefícios
      const { data: planos, error: planosError } = await supabase
        .from('planos')
        .select(`
          *,
          product_lines (*),
          planos_beneficios (
            *,
            benefits:benefit_id (*)
          )
        `)
        .eq('ativo', true)
        .eq('visivel_gestao', true)
        .order('ordem');
      
      if (planosError) throw planosError;
      
      // Buscar km de assistência
      const planoIds = (planos || []).map(p => p.id);
      const kmMap = await fetchAssistenciaKmMap(planoIds);
      
      // Mapear e agrupar planos por linha
      const planosFormatados = (planos || []).map(plano => {
        const baseBenefits = (plano.planos_beneficios || [])
          .map((pb: any) => ({
            id: pb.id,
            plan_id: pb.plano_id,
            benefit_id: pb.benefit_id,
            custom_text: pb.custom_text,
            custom_value: pb.custom_value,
            additional_info: pb.additional_info,
            is_highlighted: pb.is_highlighted || false,
            display_order: pb.display_order || pb.ordem || 0,
            benefits: pb.benefits,
          }))
          .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
        
        return {
          ...plano,
          name: plano.nome,
          slug: plano.slug || plano.codigo?.toLowerCase(),
          is_active: plano.ativo,
          display_order: plano.ordem || plano.ordem_exibicao || 0,
          additional_price: plano.adicional_mensal,
          min_vehicle_year: plano.ano_minimo ? `${plano.ano_minimo}+` : null,
          cota_passeio_percent: plano.cota_participacao,
          cota_passeio_min: plano.cota_minima,
          cota_desagio_percent: plano.cota_desagio,
          cota_desagio_min: plano.cota_minima_desagio,
          plan_benefits: enrichBenefitsWithKm(baseBenefits, kmMap.get(plano.id)),
        };
      });

      return (lines as ProductLine[]).map(line => ({
        productLine: line,
        plans: planosFormatados.filter(plan => plan.product_line_id === line.id)
      }));
    },
  });
}
