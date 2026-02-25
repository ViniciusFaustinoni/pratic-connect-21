import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAtualizarStatusTerceiro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ terceiroId, sinistroId, status }: { terceiroId: string; sinistroId: string; status: string }) => {
      const { error } = await supabase
        .from('sinistro_terceiros')
        .update({ status } as any)
        .eq('id', terceiroId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success('Status atualizado');
      queryClient.invalidateQueries({ queryKey: ['sinistro-terceiros', vars.sinistroId] });
    },
    onError: (err: any) => {
      toast.error('Erro: ' + err.message);
    },
  });
}
