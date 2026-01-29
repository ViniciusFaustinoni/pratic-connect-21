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
  softruckDeviceId?: string;
  softruckVehicleId?: string;
  redeVeiculosClienteId?: string;
  redeVeiculosVeiculoId?: string;
}

export function useAtivarRastreador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AtivarRastreadorParams): Promise<AtivarRastreadorResult> => {
      const { imei, veiculoId, associadoId, associadoEmail } = params;

      // 1. Buscar rastreador pelo IMEI - deve existir no estoque
      const { data: rastreadorExistente } = await supabase
        .from('rastreadores')
        .select('id, status, plataforma')
        .eq('imei', imei)
        .maybeSingle();

      if (!rastreadorExistente) {
        throw new Error(`Rastreador com IMEI ${imei} não encontrado no sistema. Cadastre o rastreador no estoque antes de ativá-lo.`);
      }

      if (rastreadorExistente.status !== 'estoque') {
        throw new Error(`Rastreador com IMEI ${imei} não está disponível no estoque (status atual: ${rastreadorExistente.status}).`);
      }

      // 2. Se for Softruck, usar integração via edge function
      if (rastreadorExistente.plataforma === 'softruck') {
        console.log('[useAtivarRastreador] Plataforma Softruck detectada, chamando integração...');
        
        const { data, error } = await supabase.functions.invoke('softruck-ativar-dispositivo', {
          body: { imei, veiculoId, associadoId, associadoEmail },
        });

        if (error) {
          console.error('[useAtivarRastreador] Erro na integração Softruck:', error);
          throw new Error(error.message || 'Erro na integração com Softruck');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Erro ao ativar dispositivo na Softruck');
        }

        return {
          success: true,
          rastreadorId: data.rastreador_id,
          isNew: false,
          softruckDeviceId: data.softruck_device_id,
          softruckVehicleId: data.softruck_vehicle_id,
        };
      }

      // 2.1 Se for Rede Veículos, usar integração via edge function
      if (rastreadorExistente.plataforma === 'rede_veiculos') {
        console.log('[useAtivarRastreador] Plataforma Rede Veículos detectada, chamando integração...');
        
        const { data, error } = await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
          body: { imei, veiculoId, associadoId },
        });

        if (error) {
          console.error('[useAtivarRastreador] Erro na integração Rede Veículos:', error);
          throw new Error(error.message || 'Erro na integração com Rede Veículos');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Erro ao vincular na Rede Veículos');
        }

        return {
          success: true,
          rastreadorId: data.rastreador_id,
          isNew: false,
          redeVeiculosClienteId: data.rede_veiculos_cliente_id,
          redeVeiculosVeiculoId: data.rede_veiculos_veiculo_id,
        };
      }

      // 3. Para outras plataformas: dar baixa no estoque localmente
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      
      if (data.softruckDeviceId) {
        toast.success('Rastreador ativado na Softruck com sucesso!');
      } else {
        toast.success('Rastreador vinculado ao veículo com sucesso!');
      }
    },
    onError: (error) => {
      console.error('Erro ao ativar rastreador:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao ativar rastreador');
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
