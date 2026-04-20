import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CancelarParams {
  ids: string[];
  associadoId?: string;
  contratoId?: string;
}

/**
 * Marca como "cancelado" solicitações de documentos que ainda não foram enviadas pelo cliente.
 * Usado para desbloquear propostas que ficaram travadas com pedidos antigos.
 */
export function useCancelarDocumentosSolicitados() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids }: CancelarParams) => {
      if (!ids || ids.length === 0) return { count: 0 };

      const { error, count } = await supabase
        .from('documentos_solicitados')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('status', 'pendente')
        .select('id', { count: 'exact' });

      if (error) throw error;
      return { count: count ?? ids.length };
    },
    onSuccess: (result, variables) => {
      const qtd = result.count;
      toast.success(
        qtd > 1
          ? `${qtd} solicitações canceladas. Proposta liberada para aprovação.`
          : 'Solicitação cancelada. Proposta liberada para aprovação.'
      );
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      if (variables.contratoId) {
        queryClient.invalidateQueries({ queryKey: ['proposta', variables.contratoId] });
      }
    },
    onError: (error: any) => {
      console.error('Erro ao cancelar solicitações:', error);
      toast.error(error?.message || 'Não foi possível cancelar as solicitações.');
    },
  });
}
