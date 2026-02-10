import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook para registrar que o profissional fez contato com o associado
 * antes de iniciar o percurso (via WhatsApp ou Ligação).
 */
export function useRegistrarContato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tarefaId, tipo }: { tarefaId: string; tipo: 'whatsapp' | 'ligacao' }) => {
      const { error } = await supabase
        .from('servicos')
        .update({
          contato_realizado_em: new Date().toISOString(),
          contato_tipo: tipo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tarefaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      toast.success('Contato registrado!');
    },
    onError: (error) => {
      console.error('Erro ao registrar contato:', error);
      toast.error('Erro ao registrar contato');
    },
  });
}
