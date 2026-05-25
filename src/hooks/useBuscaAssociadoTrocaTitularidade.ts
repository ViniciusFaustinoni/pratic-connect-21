import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AssociadoSearchResult } from './useAssociadoSearch';
import type { PlacaSearchResult } from './useBuscaPlaca';

interface BuscaTrocaResponse {
  associados: AssociadoSearchResult[];
  placas: PlacaSearchResult[];
  erroTransitorio?: boolean;
  motivoTransitorio?: string | null;
}

/**
 * Busca server-side (bypass RLS) usada SÓ no modal de Troca de Titularidade.
 *
 * Por que existir: nos demais fluxos, vendedores CLT/externos só enxergam
 * associados/veículos vinculados a eles mesmos (RLS via `get_vendedor_associado_ids`).
 * Na Troca de Titularidade, eles precisam achar o antigo dono — que tipicamente
 * NÃO é cliente deles. O edge `buscar-associado-troca-titularidade` resolve o caso
 * com service_role + auditoria, sem afrouxar policies globais.
 */
export function useBuscaAssociadoTrocaTitularidade(termo: string, enabled: boolean) {
  return useQuery({
    queryKey: ['busca-troca-titularidade', termo, enabled],
    enabled: !!enabled && !!termo && termo.trim().length >= 2,
    queryFn: async (): Promise<BuscaTrocaResponse> => {
      const { data, error } = await supabase.functions.invoke(
        'buscar-associado-troca-titularidade',
        { body: { termo } },
      );
      if (error) throw error;
      return {
        associados: data?.associados ?? [],
        placas: data?.placas ?? [],
        erroTransitorio: !!data?.erroTransitorio,
        motivoTransitorio: data?.motivoTransitorio ?? null,
      };
    },
    staleTime: 10_000,
  });
}
