import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LogAtivacao {
  id: string;
  created_at: string;
  operacao: string;
  status: string;
  request: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  erro_mensagem: string | null;
}

export function useVeiculoHistoricoAtivacoes(veiculoId: string | undefined) {
  return useQuery({
    queryKey: ['veiculo-historico-ativacoes', veiculoId],
    enabled: !!veiculoId,
    queryFn: async (): Promise<LogAtivacao[]> => {
      if (!veiculoId) return [];

      // Buscar logs de ativação/inativação para este veículo
      const { data: logs, error } = await supabase
        .from('rastreadores_logs')
        .select('id, created_at, operacao, status, request, response, erro_mensagem')
        .eq('plataforma', 'rede_veiculos')
        .in('operacao', ['ativarVeiculo', 'inativarVeiculo'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar histórico de ativações:', error);
        return [];
      }

      // Filtrar apenas os logs relacionados a este veículo
      const logsDoVeiculo = (logs || []).filter((log) => {
        const request = log.request as Record<string, unknown> | null;
        // Verificar se o request contém o veiculoId ou idVeiculo
        return (
          request?.veiculoId === veiculoId ||
          String(request?.idVeiculo) === veiculoId
        );
      });

      return logsDoVeiculo as LogAtivacao[];
    },
  });
}

// Hook alternativo que busca pelo ID do veículo na Rede Veículos
export function useVeiculoHistoricoAtivacoesByRedeVeiculosId(redeVeiculosVeiculoId: string | number | undefined) {
  return useQuery({
    queryKey: ['veiculo-historico-ativacoes-rv', redeVeiculosVeiculoId],
    enabled: !!redeVeiculosVeiculoId,
    queryFn: async (): Promise<LogAtivacao[]> => {
      if (!redeVeiculosVeiculoId) return [];

      const { data: logs, error } = await supabase
        .from('rastreadores_logs')
        .select('id, created_at, operacao, status, request, response, erro_mensagem')
        .eq('plataforma', 'rede_veiculos')
        .in('operacao', ['ativarVeiculo', 'inativarVeiculo'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar histórico de ativações:', error);
        return [];
      }

      // Filtrar pelos logs que contêm o idVeiculo da Rede Veículos
      const idNumerico = typeof redeVeiculosVeiculoId === 'string' 
        ? parseInt(redeVeiculosVeiculoId, 10) 
        : redeVeiculosVeiculoId;

      const logsDoVeiculo = (logs || []).filter((log) => {
        const request = log.request as Record<string, unknown> | null;
        return request?.idVeiculo === idNumerico;
      });

      return logsDoVeiculo as LogAtivacao[];
    },
  });
}
