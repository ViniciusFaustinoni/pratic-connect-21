import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncResult {
  success: boolean;
  atualizado: boolean;
  mensagem: string;
  status?: string;
  signedFileUrl?: string;
  error?: string;
}

/**
 * Hook para sincronizar manualmente o status de assinatura de um contrato
 * Usa a edge function autentique-sync-contrato para consultar o Autentique
 * e atualizar o banco de dados
 */
export function useAutentiqueSyncContrato() {
  const queryClient = useQueryClient();

  return useMutation<SyncResult, Error, { contratoId?: string; contratoToken?: string }>({
    mutationFn: async ({ contratoId, contratoToken }) => {
      console.log('[useAutentiqueSyncContrato] Sincronizando...', { contratoId, contratoToken });
      
      const { data, error } = await supabase.functions.invoke<SyncResult>('autentique-sync-contrato', {
        body: { contratoId, contratoToken }
      });

      if (error) {
        console.error('[useAutentiqueSyncContrato] Erro:', error);
        throw new Error(error.message || 'Erro ao sincronizar assinatura');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro desconhecido');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      console.log('[useAutentiqueSyncContrato] Sucesso:', data);
      
      if (data.atualizado) {
        if (data.status === 'assinado') {
          toast.success('Assinatura confirmada! ✓');
        } else if (data.status === 'rejeitado') {
          toast.warning('Documento foi rejeitado');
        } else {
          toast.info(data.mensagem);
        }
        
        // Invalidar queries relacionadas
        queryClient.invalidateQueries({ queryKey: ['contratos'] });
        queryClient.invalidateQueries({ queryKey: ['contrato'] });
        
        if (variables.contratoToken) {
          queryClient.invalidateQueries({ queryKey: ['contrato-publico', variables.contratoToken] });
        }
      } else {
        toast.info(data.mensagem || 'Documento ainda não foi assinado');
      }
    },
    onError: (error) => {
      console.error('[useAutentiqueSyncContrato] Erro:', error);
      toast.error(error.message || 'Erro ao verificar assinatura');
    }
  });
}
