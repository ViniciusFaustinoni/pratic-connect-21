import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useDesatribuirServico() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (servicoId: string) => {
      // Get current service data for logging
      const { data: servico } = await supabase
        .from('servicos')
        .select('profissional_id')
        .eq('id', servicoId)
        .single();

      const profissionalAnterior = servico?.profissional_id;

      const { error } = await supabase
        .from('servicos')
        .update({
          profissional_id: null,
          status: 'pendente',
          atribuido_em: null,
        })
        .eq('id', servicoId);

      if (error) throw error;

      // Log cancellation
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('servicos_atribuicoes_log').insert({
        servico_id: servicoId,
        profissional_id: profissionalAnterior || null,
        tipo_atribuicao: 'cancelamento_manual',
        atribuido_por: user?.id || null,
        observacoes: 'Cancelamento manual de atribuição pelo mapa',
      });
    },
    onSuccess: () => {
      toast.success('Atribuição cancelada com sucesso');
      qc.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      qc.invalidateQueries({ queryKey: ['vistoriadores-localizacao-realtime'] });
      qc.invalidateQueries({ queryKey: ['servicos-para-atribuir-manual'] });
      qc.invalidateQueries({ queryKey: ['vistoriadores-ativos-manual'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao cancelar atribuição: ' + (err.message || ''));
    },
  });
}
