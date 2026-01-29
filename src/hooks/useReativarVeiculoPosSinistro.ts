import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReativarVeiculoParams {
  veiculoId: string;
  sinistroId?: string;
  motivo?: string;
}

export function useReativarVeiculoPosSinistro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ veiculoId, sinistroId, motivo }: ReativarVeiculoParams) => {
      console.log('[ReativarVeiculo] Iniciando reativação:', { veiculoId, sinistroId });

      // 1. Verificar se o sinistro não foi perda total
      if (sinistroId) {
        const { data: sinistro, error: sinistroError } = await supabase
          .from('sinistros')
          .select('tipo_dano, protocolo, status')
          .eq('id', sinistroId)
          .single();

        if (sinistroError) {
          throw new Error('Erro ao buscar sinistro: ' + sinistroError.message);
        }

        if (sinistro?.tipo_dano === 'perda_total') {
          throw new Error('Não é possível reativar veículo de sinistro com perda total');
        }

        if (sinistro?.status !== 'encerrado' && sinistro?.status !== 'indenizado') {
          throw new Error('O sinistro ainda não foi encerrado');
        }
      }

      // 2. Buscar veículo e rastreador
      const { data: veiculo, error: veiculoError } = await supabase
        .from('veiculos')
        .select(`
          id, 
          placa, 
          associado_id,
          rede_veiculos_veiculo_id
        `)
        .eq('id', veiculoId)
        .single();

      if (veiculoError || !veiculo) {
        throw new Error('Veículo não encontrado');
      }

      // 3. Verificar se tem rastreador Rede Veículos
      const { data: rastreador } = await supabase
        .from('rastreadores')
        .select('id, plataforma')
        .eq('veiculo_id', veiculoId)
        .eq('status', 'instalado')
        .maybeSingle();

      let apiSuccess = true;

      // 4. Se tem vínculo com Rede Veículos, ativar na plataforma
      if (veiculo.rede_veiculos_veiculo_id || rastreador?.plataforma === 'rede_veiculos') {
        try {
          const { data: result, error } = await supabase.functions.invoke('rede-veiculos-ativar-veiculo', {
            body: {
              veiculoId,
              motivo: motivo || 'Reativação após resolução de sinistro',
            },
          });

          if (error) {
            console.error('[ReativarVeiculo] Erro na API:', error);
            apiSuccess = false;
          } else {
            apiSuccess = result?.success ?? false;
          }
        } catch (error) {
          console.error('[ReativarVeiculo] Exceção:', error);
          apiSuccess = false;
        }
      }

      // 5. Atualizar veículo localmente
      const { error: updateError } = await supabase
        .from('veiculos')
        .update({
          ativo: true,
          observacoes: motivo || 'Reativado após resolução de sinistro',
          updated_at: new Date().toISOString(),
        })
        .eq('id', veiculoId);

      if (updateError) {
        throw new Error('Erro ao atualizar veículo: ' + updateError.message);
      }

      // 6. Registrar histórico
      if (veiculo.associado_id) {
        await supabase.from('associados_historico').insert({
          associado_id: veiculo.associado_id,
          tipo: 'veiculo_reativado',
          descricao: `Veículo ${veiculo.placa} reativado. ${motivo || 'Resolução de sinistro'}`,
          veiculo_id: veiculoId,
          dados_novos: { ativo: true, sinistroId },
        });
      }

      return {
        success: true,
        veiculoId,
        apiSuccess,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });

      if (result.apiSuccess) {
        toast.success('Veículo reativado com sucesso!');
      } else {
        toast.warning('Veículo reativado localmente (erro na plataforma)');
      }
    },
    onError: (error) => {
      console.error('[ReativarVeiculo] Erro:', error);
      toast.error(`Erro ao reativar veículo: ${error.message}`);
    },
  });
}
