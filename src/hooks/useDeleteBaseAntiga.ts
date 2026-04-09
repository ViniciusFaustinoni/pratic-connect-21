import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useDeleteBaseAntiga(tipo: 'associado' | 'veiculo') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (tipo === 'veiculo') {
        const { error } = await supabase.from('veiculos').delete().eq('id', id);
        if (error) throw error;
      } else {
        // Delete vehicles first (substituicoes are cleaned by CASCADE)
        const { error: vErr } = await supabase
          .from('veiculos')
          .delete()
          .eq('associado_id', id);
        if (vErr) throw vErr;

        const { error } = await supabase.from('associados').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(tipo === 'associado' ? 'Associado excluído com sucesso' : 'Veículo excluído com sucesso');
      queryClient.invalidateQueries({ queryKey: ['base-antiga-associados'] });
      queryClient.invalidateQueries({ queryKey: ['base-antiga-veiculos'] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao excluir: ${err.message}`);
    },
  });
}
