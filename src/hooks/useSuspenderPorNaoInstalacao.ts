import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useSuspenderPorNaoInstalacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contrato_id, motivo }: { contrato_id: string; motivo?: string }) => {
      const { data, error } = await supabase.functions.invoke('suspender-cobertura-instalacao-manual', {
        body: { contrato_id, motivo: motivo || undefined },
      });
      if (error) throw new Error(error.message || 'Erro ao suspender cobertura');
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Cobertura suspensa (${data?.prazo_horas}h, UF ${data?.uf ?? 'N/D'}). Associado notificado por WhatsApp.`);
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associado'] });
      queryClient.invalidateQueries({ queryKey: ['suspensao-instalacao-veiculo'] });
      queryClient.invalidateQueries({ queryKey: ['contrato-situacao'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao suspender cobertura');
    },
  });
}
