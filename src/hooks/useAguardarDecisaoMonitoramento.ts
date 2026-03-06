import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type StatusDecisao = 'aguardando' | 'aprovado' | 'declinado';

export function useAguardarDecisaoMonitoramento(servicoId: string | null, ativo: boolean = false) {
  return useQuery({
    queryKey: ['aguardar-decisao-monitoramento', servicoId],
    queryFn: async (): Promise<StatusDecisao> => {
      if (!servicoId) return 'aguardando';

      const { data, error } = await supabase
        .from('servicos')
        .select('decisao_instalador')
        .eq('id', servicoId)
        .single();

      if (error) throw error;

      const decisao = data?.decisao_instalador;

      if (decisao === 'aprovado_ressalva') return 'aprovado';
      if (decisao === 'declinado_monitoramento') return 'declinado';
      return 'aguardando';
    },
    enabled: ativo && !!servicoId,
    refetchInterval: ativo ? 10000 : false,
    refetchIntervalInBackground: true,
  });
}
