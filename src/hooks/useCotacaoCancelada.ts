import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CotacaoCancelada {
  id: string;
  status: string;
  motivo_cancelamento: string | null;
  cancelada_em: string | null;
}

/**
 * Hook para buscar cotação cancelada por falta de pagamento do associado atual
 */
export function useCotacaoCanceladaPorPagamento(associadoId?: string) {
  return useQuery({
    queryKey: ['cotacao-cancelada-pagamento', associadoId],
    queryFn: async (): Promise<CotacaoCancelada | null> => {
      if (!associadoId) return null;

      // Buscar contrato mais recente do associado
      const { data: contrato, error: contratoError } = await supabase
        .from('contratos')
        .select('id, cotacao_id')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contratoError || !contrato?.cotacao_id) return null;

      // Buscar cotação vinculada
      const { data: cotacao, error: cotacaoError } = await supabase
        .from('cotacoes')
        .select('id, status, motivo_cancelamento, cancelada_em')
        .eq('id', contrato.cotacao_id)
        .eq('status', 'expirada')
        .not('motivo_cancelamento', 'is', null)
        .maybeSingle();

      if (cotacaoError) {
        console.error('[useCotacaoCancelada] Erro ao buscar cotação:', cotacaoError);
        return null;
      }

      return cotacao as CotacaoCancelada | null;
    },
    enabled: !!associadoId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

/**
 * Hook para verificar se há cobrança de adesão vencida para o associado
 */
export function useCobrancaAdesaoVencida(associadoId?: string) {
  return useQuery({
    queryKey: ['cobranca-adesao-vencida', associadoId],
    queryFn: async () => {
      if (!associadoId) return null;

      const { data, error } = await supabase
        .from('asaas_cobrancas')
        .select('id, valor, data_vencimento, status, contrato_id')
        .eq('associado_id', associadoId)
        .eq('tipo', 'adesao')
        .eq('status', 'OVERDUE')
        .order('data_vencimento', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[useCobrancaAdesaoVencida] Erro:', error);
        return null;
      }

      return data;
    },
    enabled: !!associadoId,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}
