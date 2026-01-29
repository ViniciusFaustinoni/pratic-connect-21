import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TransferirVeiculoParams {
  veiculoId: string;
  novoAssociadoId: string;
  motivoTransferencia: string;
}

interface Veiculo {
  id: string;
  placa: string;
  associado_id: string;
  rede_veiculos_cliente_id: string | null;
  rede_veiculos_veiculo_id: string | null;
}

interface Associado {
  id: string;
  nome: string;
  cpf: string | null;
}

/**
 * Hook para transferir veículo entre associados
 * 
 * Fluxo:
 * 1. Buscar dados do veículo e associado antigo
 * 2. Buscar dados do novo associado
 * 3. Atualizar associado_id do veículo localmente
 * 4. Se tem Rede Veículos:
 *    a) Desvincular do cliente antigo
 *    b) Vincular ao cliente novo
 * 5. Registrar histórico de transferência
 */
export function useTransferirVeiculo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ veiculoId, novoAssociadoId, motivoTransferencia }: TransferirVeiculoParams) => {
      // 1. Buscar veículo atual
      const { data: veiculo, error: veiculoError } = await supabase
        .from('veiculos')
        .select('id, placa, associado_id, rede_veiculos_cliente_id, rede_veiculos_veiculo_id')
        .eq('id', veiculoId)
        .single();

      if (veiculoError || !veiculo) {
        throw new Error('Veículo não encontrado');
      }

      // Verificar se está transferindo para o mesmo associado
      if (veiculo.associado_id === novoAssociadoId) {
        throw new Error('Veículo já pertence a este associado');
      }

      // 2. Buscar dados do associado antigo
      const { data: associadoAntigo } = await supabase
        .from('associados')
        .select('id, nome, cpf')
        .eq('id', veiculo.associado_id)
        .single();

      // 3. Buscar dados do novo associado
      const { data: novoAssociado, error: novoAssociadoError } = await supabase
        .from('associados')
        .select('id, nome, cpf')
        .eq('id', novoAssociadoId)
        .single();

      if (novoAssociadoError || !novoAssociado) {
        throw new Error('Novo associado não encontrado');
      }

      const temRedeVeiculos = !!(veiculo.rede_veiculos_cliente_id && veiculo.rede_veiculos_veiculo_id);

      // 4. Se tem vínculo com Rede Veículos, precisa desvincular e revincular
      if (temRedeVeiculos) {
        // 4a. Desvincular do cliente antigo
        const { error: desvincularError } = await supabase.functions.invoke('rede-veiculos-desvincular-cliente', {
          body: { veiculoId },
        });

        if (desvincularError) {
          console.error('Erro ao desvincular da Rede Veículos:', desvincularError);
          // Continua mesmo com erro - a transferência local é prioritária
        }
      }

      // 5. Atualizar associado_id do veículo localmente
      const { error: updateError } = await supabase
        .from('veiculos')
        .update({
          associado_id: novoAssociadoId,
          // Limpar IDs da Rede Veículos - será revinculado depois
          rede_veiculos_cliente_id: null,
          rede_veiculos_veiculo_id: null,
        })
        .eq('id', veiculoId);

      if (updateError) {
        throw new Error('Erro ao transferir veículo: ' + updateError.message);
      }

      // 6. Registrar histórico
      await supabase.from('associados_historico').insert({
        associado_id: veiculo.associado_id,
        tipo: 'veiculo_transferido',
        descricao: `Veículo ${veiculo.placa} transferido para ${novoAssociado.nome}`,
        veiculo_id: veiculoId,
        dados_anteriores: { associado_id: veiculo.associado_id, nome: associadoAntigo?.nome },
        dados_novos: { associado_id: novoAssociadoId, nome: novoAssociado.nome },
        metadata: { motivo: motivoTransferencia },
      });

      // Registrar no histórico do novo associado também
      await supabase.from('associados_historico').insert({
        associado_id: novoAssociadoId,
        tipo: 'veiculo_recebido',
        descricao: `Veículo ${veiculo.placa} recebido de ${associadoAntigo?.nome || 'associado anterior'}`,
        veiculo_id: veiculoId,
        dados_anteriores: { associado_id: veiculo.associado_id, nome: associadoAntigo?.nome },
        dados_novos: { associado_id: novoAssociadoId, nome: novoAssociado.nome },
        metadata: { motivo: motivoTransferencia },
      });

      return {
        veiculoId,
        placa: veiculo.placa,
        associadoAntigoId: veiculo.associado_id,
        associadoAntigoNome: associadoAntigo?.nome,
        novoAssociadoId,
        novoAssociadoNome: novoAssociado.nome,
        precisaRevincularRedeVeiculos: temRedeVeiculos,
      };
    },
    onSuccess: (data) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados', data.associadoAntigoId] });
      queryClient.invalidateQueries({ queryKey: ['associados', data.novoAssociadoId] });

      toast.success(`Veículo ${data.placa} transferido para ${data.novoAssociadoNome}`);

      if (data.precisaRevincularRedeVeiculos) {
        toast.info(
          'O veículo foi desvinculado da Rede Veículos. Para continuar com rastreamento, realize nova instalação.',
          { duration: 8000 }
        );
      }
    },
    onError: (error) => {
      console.error('Erro ao transferir veículo:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao transferir veículo');
    },
  });
}
