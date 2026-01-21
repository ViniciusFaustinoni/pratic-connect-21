import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AtivarRastreadorParams {
  imei: string;
  veiculoId: string;
  associadoId: string;
  associadoEmail?: string;
}

interface AtivarRastreadorResult {
  success: boolean;
  rastreadorId: string;
  isNew: boolean;
}

export function useAtivarRastreador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AtivarRastreadorParams): Promise<AtivarRastreadorResult> => {
      const { imei, veiculoId, associadoId, associadoEmail } = params;

      // 1. Buscar rastreador pelo IMEI - deve existir no estoque
      const { data: rastreadorExistente } = await supabase
        .from('rastreadores')
        .select('id, status')
        .eq('imei', imei)
        .maybeSingle();

      if (!rastreadorExistente) {
        throw new Error(`Rastreador com IMEI ${imei} não encontrado no sistema. Cadastre o rastreador no estoque antes de ativá-lo.`);
      }

      if (rastreadorExistente.status !== 'estoque') {
        throw new Error(`Rastreador com IMEI ${imei} não está disponível no estoque (status atual: ${rastreadorExistente.status}).`);
      }

      // 2. Dar baixa no estoque - vincular ao veículo e mudar status para instalado
      const { error } = await supabase
        .from('rastreadores')
        .update({
          veiculo_id: veiculoId,
          associado_id: associadoId,
          associado_email: associadoEmail,
          status: 'instalado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', rastreadorExistente.id);

      if (error) throw error;

      return {
        success: true,
        rastreadorId: rastreadorExistente.id,
        isNew: false,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      toast.success('Rastreador vinculado ao veículo com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao ativar rastreador:', error);
      toast.error('Erro ao ativar rastreador');
    },
  });
}

// Hook para ativar associado após confirmar rastreador
export function useAtivarAssociado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (associadoId: string) => {
      const { error } = await supabase
        .from('associados')
        .update({
          status: 'ativo',
          data_ativacao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', associadoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['associado'] });
      toast.success('Associado ativado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao ativar associado:', error);
      toast.error('Erro ao ativar associado');
    },
  });
}
