import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VenderVeiculoParams {
  veiculoId: string;
  dataVenda?: string;
  observacoes?: string;
  liberarRastreador?: boolean;
}

export interface VenderVeiculoResult {
  success: boolean;
  veiculoId: string;
  rastreadorId?: string;
  rastreadorLiberado: boolean;
  desvincularApiSuccess?: boolean;
}

export function useVenderVeiculo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      veiculoId,
      dataVenda,
      observacoes,
      liberarRastreador = true,
    }: VenderVeiculoParams): Promise<VenderVeiculoResult> => {
      console.log('=== VENDA DE VEÍCULO ===');
      console.log('Veículo ID:', veiculoId);
      console.log('Liberar rastreador:', liberarRastreador);

      // 1. Buscar veículo e rastreador vinculado
      const { data: veiculo, error: veiculoError } = await supabase
        .from('veiculos')
        .select(`
          id, placa, marca, modelo, associado_id,
          associados (id, nome, cpf)
        `)
        .eq('id', veiculoId)
        .single();

      if (veiculoError || !veiculo) {
        throw new Error('Veículo não encontrado');
      }

      // 2. Buscar rastreador do veículo
      const { data: rastreador } = await supabase
        .from('rastreadores')
        .select('id, imei, codigo, plataforma, status')
        .eq('veiculo_id', veiculoId)
        .eq('status', 'instalado')
        .maybeSingle();

      let desvincularApiSuccess = true;
      let rastreadorLiberado = false;

      // 3. Se há rastreador e deve liberar, desvincular na plataforma
      if (rastreador && liberarRastreador) {
        console.log('Liberando rastreador:', rastreador.codigo);

        if (rastreador.plataforma === 'rede_veiculos') {
          try {
            // Primeiro inativar o veículo na plataforma
            console.log('Inativando veículo na Rede Veículos antes de desvincular');
            await supabase.functions.invoke('rede-veiculos-inativar-veiculo', {
              body: {
                veiculoId,
                motivo: 'venda',
                observacoes: observacoes || 'Veículo vendido',
                atualizarBancoLocal: false, // Não atualizar aqui, será feito abaixo
              },
            });

            // Depois desvincular completamente
            const { data: desvincularResult, error: desvincularError } = await supabase.functions.invoke(
              'rede-veiculos-desvincular-cliente',
              {
                body: {
                  rastreadorId: rastreador.id,
                  motivo: 'venda_veiculo',
                  atualizarBancoLocal: true,
                },
              }
            );

            if (desvincularError) {
              console.error('Erro ao desvincular na API:', desvincularError);
              desvincularApiSuccess = false;
            } else {
              desvincularApiSuccess = desvincularResult?.apiSuccess ?? false;
              rastreadorLiberado = true;
            }
          } catch (error) {
            console.error('Exceção ao desvincular:', error);
            desvincularApiSuccess = false;
          }
        } else if (rastreador.plataforma === 'softruck') {
          try {
            await supabase.functions.invoke('softruck-api', {
              body: {
                operation: 'desassociar-device-veiculo',
                data: { deviceId: rastreador.id },
              },
            });
            rastreadorLiberado = true;
          } catch {
            desvincularApiSuccess = false;
          }
        } else {
          // Outras plataformas: apenas atualizar banco local
          const { error: updateRastError } = await supabase
            .from('rastreadores')
            .update({
              veiculo_id: null,
              status: 'estoque',
              updated_at: new Date().toISOString(),
            })
            .eq('id', rastreador.id);

          if (!updateRastError) {
            rastreadorLiberado = true;
          }

          // Registrar log
          await supabase.from('rastreadores_logs').insert({
            rastreador_id: rastreador.id,
            plataforma: rastreador.plataforma,
            operacao: 'desinstalacao_venda_veiculo',
            request: { veiculo_id: veiculoId },
            response: { sucesso: true },
            status: 'sucesso',
          });
        }
      }

      // 4. Atualizar veículo como inativo/vendido
      const { error: updateVeiculoError } = await supabase
        .from('veiculos')
        .update({
          ativo: false,
          observacoes: [
            `Veículo vendido em ${dataVenda || new Date().toLocaleDateString('pt-BR')}`,
            observacoes,
          ].filter(Boolean).join('. '),
          updated_at: new Date().toISOString(),
        })
        .eq('id', veiculoId);

      if (updateVeiculoError) {
        throw new Error('Erro ao atualizar veículo');
      }

      // 5. Limpar IDs da plataforma no veículo
      await supabase
        .from('veiculos')
        .update({
          rede_veiculos_cliente_id: null,
          rede_veiculos_veiculo_id: null,
        })
        .eq('id', veiculoId);

      console.log('=== VENDA CONCLUÍDA ===');

      return {
        success: true,
        veiculoId,
        rastreadorId: rastreador?.id,
        rastreadorLiberado,
        desvincularApiSuccess,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });

      if (result.rastreadorLiberado) {
        if (result.desvincularApiSuccess) {
          toast.success('Veículo marcado como vendido e rastreador liberado para estoque!');
        } else {
          toast.warning('Veículo vendido e rastreador liberado localmente (erro na plataforma)');
        }
      } else {
        toast.success('Veículo marcado como vendido!');
      }
    },
    onError: (error) => {
      console.error('Erro ao registrar venda:', error);
      toast.error(`Erro ao registrar venda: ${error.message}`);
    },
  });
}
