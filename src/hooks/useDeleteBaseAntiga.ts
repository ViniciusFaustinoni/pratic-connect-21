import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

async function limparSubstituicoes(veiculoIds: string[], associadoId?: string) {
  for (const vid of veiculoIds) {
    await supabase.from('substituicoes_veiculo').delete().eq('veiculo_antigo_id', vid);
    await supabase.from('substituicoes_veiculo').delete().eq('veiculo_novo_id', vid);
  }
  if (associadoId) {
    await supabase.from('substituicoes_veiculo').delete().eq('associado_id', associadoId);
  }
}

export function useDeleteBaseAntiga(tipo: 'associado' | 'veiculo') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (tipo === 'veiculo') {
        await limparSubstituicoes([id]);
        const { error } = await supabase.from('veiculos').delete().eq('id', id);
        if (error) throw error;
      } else {
        const { data: veiculos } = await supabase
          .from('veiculos')
          .select('id')
          .eq('associado_id', id);

        const veiculoIds = (veiculos || []).map(v => v.id);

        if (veiculoIds.length) {
          await limparSubstituicoes(veiculoIds, id);
          const { error: vErr } = await supabase
            .from('veiculos')
            .delete()
            .eq('associado_id', id);
          if (vErr) throw vErr;
        } else {
          await limparSubstituicoes([], id);
        }

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
