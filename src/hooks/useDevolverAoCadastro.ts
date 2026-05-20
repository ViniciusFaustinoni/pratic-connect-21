import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DevolverAoCadastroInput {
  contrato_id: string;
  motivo?: string;
}

export function useDevolverAoCadastro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contrato_id, motivo }: DevolverAoCadastroInput) => {
      const { data, error } = await supabase.functions.invoke('devolver-ao-cadastro', {
        body: { contrato_id, motivo },
      });
      if (error) {
        const msg = (data as any)?.error || error.message || 'Falha ao devolver ao Cadastro';
        throw new Error(msg);
      }
      return data as { ok: true; contrato_id: string; novo_status_contratacao: string; noop?: boolean };
    },
    onSuccess: (data) => {
      toast.success(
        data?.noop
          ? 'Este caso já estava na fila do Cadastro.'
          : 'Caso devolvido ao Cadastro. O analista vai aprovar Roubo & Furto.'
      );
      qc.invalidateQueries({ queryKey: ['aprovacao-associados'] });
      qc.invalidateQueries({ queryKey: ['servico-detalhe-aprovacao'] });
      qc.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      qc.invalidateQueries({ queryKey: ['cotacoes'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Não foi possível devolver ao Cadastro');
    },
  });
}
