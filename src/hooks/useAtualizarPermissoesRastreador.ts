import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PermissoesRastreador {
  acessoWeb?: boolean;
  pushNotifications?: boolean;
  alertaVelocidade?: boolean;
  alertaCercaVirtual?: boolean;
  alertaIgnicao?: boolean;
  limiteVelocidade?: number;
}

interface AtualizarPermissoesParams {
  veiculoId: string;
  associadoId: string;
  permissoes: PermissoesRastreador;
}

export function useAtualizarPermissoesRastreador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ veiculoId, associadoId, permissoes }: AtualizarPermissoesParams) => {
      // 1. Verificar se o veículo tem vínculo com Rede Veículos
      const { data: veiculo, error: veiculoError } = await supabase
        .from('veiculos')
        .select('id, rede_veiculos_cliente_id, rede_veiculos_veiculo_id')
        .eq('id', veiculoId)
        .single();

      if (veiculoError) {
        throw new Error(`Erro ao buscar veículo: ${veiculoError.message}`);
      }

      // 2. Atualizar campos locais na tabela veículos
      const updateVeiculo: Record<string, unknown> = {};
      
      if (permissoes.alertaVelocidade !== undefined) {
        updateVeiculo.alerta_velocidade_ativo = permissoes.alertaVelocidade;
      }
      if (permissoes.alertaCercaVirtual !== undefined) {
        updateVeiculo.alerta_cerca_ativo = permissoes.alertaCercaVirtual;
      }
      if (permissoes.alertaIgnicao !== undefined) {
        updateVeiculo.alerta_ignicao_ativo = permissoes.alertaIgnicao;
      }
      if (permissoes.limiteVelocidade !== undefined) {
        updateVeiculo.limite_velocidade = permissoes.limiteVelocidade;
      }

      if (Object.keys(updateVeiculo).length > 0) {
        const { error: updateError } = await supabase
          .from('veiculos')
          .update(updateVeiculo)
          .eq('id', veiculoId);

        if (updateError) {
          throw new Error(`Erro ao atualizar veículo: ${updateError.message}`);
        }
      }

      // 3. Se tem vínculo com Rede Veículos, sincronizar permissões
      if (veiculo.rede_veiculos_cliente_id) {
        try {
          const { data, error } = await supabase.functions.invoke('rede-veiculos-atualizar-cliente', {
            body: {
              associadoId,
              camposAlterados: {
                permissoes: {
                  acessoWeb: permissoes.acessoWeb,
                  pushNotifications: permissoes.pushNotifications,
                  alertaVelocidade: permissoes.alertaVelocidade,
                  alertaCercaVirtual: permissoes.alertaCercaVirtual,
                  alertaIgnicao: permissoes.alertaIgnicao,
                },
              },
            },
          });

          if (error) {
            console.error('[useAtualizarPermissoesRastreador] Erro na sincronização:', error);
            // Não bloqueia o fluxo, apenas loga
          } else {
            console.log('[useAtualizarPermissoesRastreador] Sincronização com Rede Veículos:', data);
          }
        } catch (err) {
          console.error('[useAtualizarPermissoesRastreador] Erro ao sincronizar:', err);
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos-associado'] });
      toast.success('Permissões atualizadas com sucesso!');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar permissões');
    },
  });
}
