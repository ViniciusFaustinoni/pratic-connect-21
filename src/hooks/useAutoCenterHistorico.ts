import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CotacaoPeca {
  id: string;
  status: string | null;
  valor_total: number | null;
  created_at: string | null;
  sinistro: { protocolo: string } | null;
}

export interface OrdemServico {
  id: string;
  numero: string;
  status: string | null;
  valor_orcamento: number | null;
  created_at: string | null;
  sinistro: { protocolo: string } | null;
}

export function useAutoCenterHistorico(autoCenterId: string | undefined) {
  const cotacoesQuery = useQuery({
    queryKey: ['auto-center-cotacoes', autoCenterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evento_cotacoes_pecas')
        .select('id, status, valor_total, created_at, sinistro:sinistros!evento_cotacoes_pecas_sinistro_id_fkey(protocolo)')
        .eq('auto_center_id', autoCenterId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CotacaoPeca[];
    },
    enabled: !!autoCenterId,
  });

  const ordensQuery = useQuery({
    queryKey: ['auto-center-ordens', autoCenterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('id, numero, status, valor_orcamento, created_at, sinistro:sinistros!ordens_servico_sinistro_id_fkey(protocolo)')
        .eq('auto_center_id', autoCenterId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as OrdemServico[];
    },
    enabled: !!autoCenterId,
  });

  return {
    cotacoes: cotacoesQuery.data || [],
    ordens: ordensQuery.data || [],
    isLoading: cotacoesQuery.isLoading || ordensQuery.isLoading,
  };
}
