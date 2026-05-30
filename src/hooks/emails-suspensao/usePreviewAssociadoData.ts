import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook dedicado para popular o preview do EnviarTesteDialog com dados reais
 * de um associado selecionado. Extraído do componente para remover acoplamento
 * direto ao Supabase na camada de UI (ERRO 17).
 *
 * Retorna o e-mail do associado e a placa do veículo ativo principal
 * (status ativo / instalacao_pendente / em_analise, mais recente).
 */
export interface PreviewAssociadoData {
  email: string | null;
  placa: string | null;
}

export function usePreviewAssociadoData(associadoId: string | null) {
  return useQuery<PreviewAssociadoData>({
    queryKey: ['preview-associado-data', associadoId],
    enabled: !!associadoId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!associadoId) return { email: null, placa: null };

      const [assocRes, veicRes] = await Promise.all([
        supabase
          .from('associados')
          .select('email')
          .eq('id', associadoId)
          .maybeSingle(),
        supabase
          .from('veiculos')
          .select('placa, status')
          .eq('associado_id', associadoId)
          .in('status', ['ativo', 'instalacao_pendente', 'em_analise'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (assocRes.error) {
        console.warn('[usePreviewAssociadoData] erro associados:', assocRes.error);
      }
      if (veicRes.error) {
        console.warn('[usePreviewAssociadoData] erro veiculos:', veicRes.error);
      }

      return {
        email: assocRes.data?.email ?? null,
        placa: veicRes.data?.placa ?? null,
      };
    },
  });
}
