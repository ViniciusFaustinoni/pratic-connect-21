import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SubstituirEquipamentoParams {
  rastreadorAntigoId: string;
  rastreadorNovoId: string;
  motivoSubstituicao: string;
}

export interface SubstituirEquipamentoResult {
  success: boolean;
  rastreadorAntigoId: string;
  rastreadorNovoId: string;
  veiculoId: string;
  desvincularApiSuccess?: boolean;
  vincularApiSuccess?: boolean;
}

export function useSubstituirEquipamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rastreadorAntigoId,
      rastreadorNovoId,
      motivoSubstituicao,
    }: SubstituirEquipamentoParams): Promise<SubstituirEquipamentoResult> => {
      console.log('=== SUBSTITUIÇÃO DE EQUIPAMENTO ===');
      console.log('Rastreador antigo:', rastreadorAntigoId);
      console.log('Rastreador novo:', rastreadorNovoId);
      console.log('Motivo:', motivoSubstituicao);

      // 1. Buscar rastreador antigo com veículo/associado
      const { data: antigoData, error: antigoError } = await supabase
        .from('rastreadores')
        .select(`
          id, imei, codigo, plataforma, veiculo_id, status, id_plataforma,
          veiculos (
            id, placa, associado_id,
            associados (id, nome)
          )
        `)
        .eq('id', rastreadorAntigoId)
        .single();

      if (antigoError || !antigoData) {
        throw new Error('Rastreador antigo não encontrado');
      }

      if (antigoData.status !== 'instalado' || !antigoData.veiculo_id) {
        throw new Error('Rastreador antigo não está instalado em um veículo');
      }

      const veiculo = antigoData.veiculos;
      if (!veiculo) {
        throw new Error('Veículo do rastreador antigo não encontrado');
      }

      // 2. Buscar rastreador novo
      const { data: novoData, error: novoError } = await supabase
        .from('rastreadores')
        .select('id, imei, codigo, plataforma, status')
        .eq('id', rastreadorNovoId)
        .single();

      if (novoError || !novoData) {
        throw new Error('Rastreador novo não encontrado');
      }

      if (novoData.status !== 'estoque') {
        throw new Error('Rastreador novo não está em estoque');
      }

      let desvincularApiSuccess = true;
      let vincularApiSuccess = true;

      // 3. Desvincular rastreador antigo na plataforma
      if (antigoData.plataforma === 'rede_veiculos') {
        try {
          console.log('Desvinculando rastreador antigo na Rede Veículos...');
          const { data: desvincularResult, error: desvincularError } = await supabase.functions.invoke(
            'rede-veiculos-desvincular-cliente',
            {
              body: {
                rastreadorId: rastreadorAntigoId,
                motivo: `substituicao_equipamento: ${motivoSubstituicao}`,
                atualizarBancoLocal: false, // Vamos atualizar manualmente
              },
            }
          );

          if (desvincularError) {
            console.error('Erro ao desvincular na API:', desvincularError);
            desvincularApiSuccess = false;
          } else {
            desvincularApiSuccess = desvincularResult?.apiSuccess ?? false;
          }
        } catch (error) {
          console.error('Exceção ao desvincular:', error);
          desvincularApiSuccess = false;
        }
      } else if (antigoData.plataforma === 'softruck') {
        // Para Softruck, chamar API de desassociação
        try {
          const { error: softError } = await supabase.functions.invoke('softruck-api', {
            body: {
              operation: 'desassociar-device-veiculo',
              data: { 
                deviceId: antigoData.id_plataforma,
                veiculoId: veiculo.id,
              },
            },
          });
          if (softError) {
            console.error('Erro ao desvincular Softruck:', softError);
            desvincularApiSuccess = false;
          }
        } catch {
          desvincularApiSuccess = false;
        }
      }

      // 4. Atualizar rastreador antigo no banco local
      const { error: updateAntigoError } = await supabase
        .from('rastreadores')
        .update({
          veiculo_id: null,
          status: 'manutencao',
          id_plataforma: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rastreadorAntigoId);

      if (updateAntigoError) {
        throw new Error('Erro ao atualizar rastreador antigo');
      }

      // 5. Registrar log do antigo
      await supabase.from('rastreadores_logs').insert({
        rastreador_id: rastreadorAntigoId,
        plataforma: antigoData.plataforma,
        operacao: 'desinstalacao_substituicao',
        request: { motivo: motivoSubstituicao, veiculo_id: veiculo.id },
        response: { sucesso: true },
        status: 'sucesso',
      });

      // 6. Vincular rastreador novo na plataforma
      if (novoData.plataforma === 'rede_veiculos') {
        try {
          console.log('Vinculando rastreador novo na Rede Veículos...');
          const { data: vincularResult, error: vincularError } = await supabase.functions.invoke(
            'rede-veiculos-vincular-cliente',
            {
              body: {
                imei: novoData.imei,
                veiculoId: veiculo.id,
                associadoId: veiculo.associado_id,
                localInstalacao: 'painel',
                possuiBloqueio: false,
              },
            }
          );

          if (vincularError) {
            console.error('Erro ao vincular na API:', vincularError);
            vincularApiSuccess = false;
          } else {
            vincularApiSuccess = vincularResult?.success ?? false;
          }
        } catch (error) {
          console.error('Exceção ao vincular:', error);
          vincularApiSuccess = false;
        }
      } else if (novoData.plataforma === 'softruck') {
        try {
          const { error: softError } = await supabase.functions.invoke('softruck-ativar-dispositivo', {
            body: {
              imei: novoData.imei,
              veiculoId: veiculo.id,
              associadoId: veiculo.associado_id,
            },
          });
          if (softError) {
            console.error('Erro ao ativar Softruck:', softError);
            vincularApiSuccess = false;
          }
        } catch {
          vincularApiSuccess = false;
        }
      }

      // 7. Atualizar rastreador novo no banco local
      const { error: updateNovoError } = await supabase
        .from('rastreadores')
        .update({
          veiculo_id: veiculo.id,
          status: 'instalado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', rastreadorNovoId);

      if (updateNovoError) {
        throw new Error('Erro ao atualizar rastreador novo');
      }

      // 8. Registrar log do novo
      await supabase.from('rastreadores_logs').insert({
        rastreador_id: rastreadorNovoId,
        plataforma: novoData.plataforma,
        operacao: 'instalacao_substituicao',
        request: { veiculo_id: veiculo.id, rastreador_substituido: antigoData.codigo },
        response: { sucesso: true },
        status: 'sucesso',
      });

      console.log('=== SUBSTITUIÇÃO CONCLUÍDA ===');

      return {
        success: true,
        rastreadorAntigoId,
        rastreadorNovoId,
        veiculoId: veiculo.id,
        desvincularApiSuccess,
        vincularApiSuccess,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreador', result.rastreadorAntigoId] });
      queryClient.invalidateQueries({ queryKey: ['rastreador', result.rastreadorNovoId] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });

      if (result.desvincularApiSuccess && result.vincularApiSuccess) {
        toast.success('Equipamento substituído com sucesso!');
      } else {
        toast.warning('Equipamento substituído localmente, mas houve erros na integração com a plataforma');
      }
    },
    onError: (error) => {
      console.error('Erro ao substituir equipamento:', error);
      toast.error(`Erro ao substituir equipamento: ${error.message}`);
    },
  });
}
