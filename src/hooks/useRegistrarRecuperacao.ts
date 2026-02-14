import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RegistrarRecuperacaoParams {
  acionamentoId: string;
  sinistroId: string;
  veiculoId: string;
  localRecuperacao: string;
  dataRecuperacao: string;
  condicaoVeiculo: 'integro' | 'avariado' | 'destruido';
  observacoes?: string;
  reativarVeiculo?: boolean;
  posicaoRecuperacao?: {
    latitude: number;
    longitude: number;
  };
}

export function useRegistrarRecuperacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      acionamentoId,
      sinistroId,
      veiculoId,
      localRecuperacao,
      dataRecuperacao,
      condicaoVeiculo,
      observacoes,
      reativarVeiculo = false,
      posicaoRecuperacao,
    }: RegistrarRecuperacaoParams) => {
      console.log('[RegistrarRecuperacao] Iniciando:', { acionamentoId, sinistroId, veiculoId });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('user_id', user.id)
        .single();

      // 1. Buscar acionamento para pegar rastreador_id
      const { data: acionamento, error: acionamentoError } = await supabase
        .from('acionamentos_roubo_furto')
        .select('id, rastreador_id, veiculo_id, status')
        .eq('id', acionamentoId)
        .single();

      if (acionamentoError || !acionamento) {
        throw new Error('Acionamento não encontrado');
      }

      if (acionamento.status === 'encerrado') {
        throw new Error('Este acionamento já foi encerrado');
      }

      // 2. Encerrar acionamento com motivo "veículo recuperado"
      const observacaoEncerramento = `Veículo recuperado em ${dataRecuperacao} - ${localRecuperacao}. Condição: ${condicaoVeiculo}. ${observacoes || ''}`;
      
      const { error: updateAcionamentoError } = await supabase
        .from('acionamentos_roubo_furto')
        .update({
          status: 'encerrado',
          encerrado_em: new Date().toISOString(),
          encerrado_por: profile?.id,
          motivo_encerramento: 'veiculo_recuperado',
          observacoes: observacaoEncerramento,
          // Gravar posição de recuperação se disponível
          ...(posicaoRecuperacao && {
            ultima_posicao_lat: posicaoRecuperacao.latitude,
            ultima_posicao_lng: posicaoRecuperacao.longitude,
            ultima_posicao_data: new Date().toISOString(),
          }),
        })
        .eq('id', acionamentoId);

      if (updateAcionamentoError) {
        throw new Error('Erro ao encerrar acionamento: ' + updateAcionamentoError.message);
      }

      console.log('[RegistrarRecuperacao] Acionamento encerrado');

      // 3. Voltar rastreador para modo normal
      if (acionamento.rastreador_id) {
        await supabase
          .from('rastreadores')
          .update({
            modo_rastreamento: 'normal',
            modo_ativado_em: null,
            modo_ativado_por: null,
            acionamento_ativo_id: null,
          })
          .eq('id', acionamento.rastreador_id);

        console.log('[RegistrarRecuperacao] Rastreador voltou para modo normal');
      }

      // 4. Atualizar STATUS DO SINISTRO baseado na condição do veículo
      let novoStatusSinistro: string;
      let observacaoSinistro: string;

      if (condicaoVeiculo === 'integro') {
        novoStatusSinistro = 'encerrado';
        observacaoSinistro = `Veículo recuperado íntegro em ${localRecuperacao}. Pratic desonerada. Veículo devolvido ao associado.`;
      } else if (condicaoVeiculo === 'avariado') {
        novoStatusSinistro = 'em_regulacao';
        observacaoSinistro = `Veículo recuperado com avarias em ${localRecuperacao}. Seguirá para regulação e fluxo de oficina.`;
      } else {
        // destruido - >= 75% FIPE
        novoStatusSinistro = 'aguardando_pagamento';
        observacaoSinistro = `Veículo recuperado destruído (≥75% FIPE) em ${localRecuperacao}. Encaminhado para indenização integral.`;
      }

      const { error: updateSinistroError } = await supabase
        .from('sinistros')
        .update({
          status: novoStatusSinistro as any,
          ...(condicaoVeiculo === 'destruido' && { tipo_dano: 'perda_total' }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistroId);

      if (updateSinistroError) {
        console.error('[RegistrarRecuperacao] Erro ao atualizar sinistro:', updateSinistroError);
      }

      // 5. Registrar no histórico do sinistro
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_anterior: 'em_recuperacao',
        status_novo: novoStatusSinistro,
        usuario_id: user.id,
        observacao: observacaoSinistro,
      });

      // 5b. Registrar detalhes da recuperação no histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_novo: novoStatusSinistro,
        usuario_id: user.id,
        observacao: `Veículo recuperado em ${localRecuperacao} (${dataRecuperacao}). Condição: ${
          condicaoVeiculo === 'integro' ? 'Íntegro' : 
          condicaoVeiculo === 'avariado' ? 'Com avarias' : 'Destruído'
        }. ${observacoes || ''}`,
      });

      // 5. Se veículo está íntegro/avariado E deve reativar na plataforma
      if (reativarVeiculo && condicaoVeiculo !== 'destruido') {
        try {
          console.log('[RegistrarRecuperacao] Reativando veículo na plataforma...');
          
          const { data: reativarResult, error: reativarError } = await supabase.functions.invoke(
            'rede-veiculos-ativar-veiculo',
            {
              body: {
                veiculoId,
                motivo: 'recuperado',
                observacoes: `Veículo recuperado em ${localRecuperacao}. ${observacoes || ''}`,
              },
            }
          );

          if (reativarError) {
            console.error('[RegistrarRecuperacao] Erro ao reativar na plataforma:', reativarError);
          } else {
            console.log('[RegistrarRecuperacao] Veículo reativado:', reativarResult);
          }
        } catch (err) {
          console.error('[RegistrarRecuperacao] Exceção ao reativar:', err);
          // Não bloqueia o fluxo
        }
      }

      // 6. Atualizar status do veículo localmente se íntegro/avariado
      if (condicaoVeiculo !== 'destruido' && reativarVeiculo) {
        await supabase
          .from('veiculos')
          .update({
            ativo: true,
            status: 'ativo',
            observacoes: `Recuperado em ${localRecuperacao} (${dataRecuperacao})`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', veiculoId);
      }

      // 7. Registrar no histórico do associado
      const { data: veiculo } = await supabase
        .from('veiculos')
        .select('placa, associado_id')
        .eq('id', veiculoId)
        .single();

      if (veiculo?.associado_id) {
        await supabase.from('associados_historico').insert({
          associado_id: veiculo.associado_id,
          tipo: 'veiculo_recuperado',
          descricao: `Veículo ${veiculo.placa} recuperado em ${localRecuperacao}. Condição: ${condicaoVeiculo}`,
          veiculo_id: veiculoId,
          dados_novos: {
            local: localRecuperacao,
            data: dataRecuperacao,
            condicao: condicaoVeiculo,
            sinistroId,
            acionamentoId,
          },
        });
      }

      return {
        success: true,
        acionamentoId,
        sinistroId,
        veiculoId,
        reativado: reativarVeiculo && condicaoVeiculo !== 'destruido',
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['acionamentos'] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['sinistro', result.sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', result.sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });

      toast.success(
        result.reativado 
          ? 'Veículo recuperado e reativado com sucesso!' 
          : 'Recuperação registrada com sucesso!'
      );
    },
    onError: (error) => {
      console.error('[RegistrarRecuperacao] Erro:', error);
      toast.error(`Erro ao registrar recuperação: ${error.message}`);
    },
  });
}
