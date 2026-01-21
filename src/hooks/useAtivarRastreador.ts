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

      // 1. Verificar se rastreador já existe pelo IMEI
      const { data: rastreadorExistente } = await supabase
        .from('rastreadores')
        .select('id, status')
        .eq('imei', imei)
        .maybeSingle();

      if (rastreadorExistente) {
        // Atualizar rastreador existente
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
      } else {
        // Criar novo rastreador
        const { data: novoRastreador, error } = await supabase
          .from('rastreadores')
          .insert({
            imei,
            codigo: `RAW-${Date.now().toString(36).toUpperCase()}`,
            plataforma: 'manual',
            veiculo_id: veiculoId,
            associado_id: associadoId,
            associado_email: associadoEmail,
            status: 'instalado',
          })
          .select('id')
          .single();

        if (error) throw error;

        return {
          success: true,
          rastreadorId: novoRastreador.id,
          isNew: true,
        };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      
      if (result.isNew) {
        toast.success('Rastreador criado e vinculado ao veículo!');
      } else {
        toast.success('Rastreador do estoque vinculado ao veículo!');
      }
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
