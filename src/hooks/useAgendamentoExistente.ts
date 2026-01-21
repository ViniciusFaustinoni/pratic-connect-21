import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';

interface AgendamentoExistenteResult {
  hasVistoriaAgendada: boolean;
  hasInstalacaoAgendada: boolean;
  isLoading: boolean;
}

/**
 * Hook para verificar se já existe vistoria ou instalação agendada para uma cotação.
 * Consulta diretamente as tabelas operacionais (vistorias, instalacoes) como fonte da verdade,
 * evitando que o fallback de agendamento seja exibido quando já existe registro.
 */
export function useAgendamentoExistente(cotacaoId: string | undefined): AgendamentoExistenteResult {
  // Verificar se existe vistoria presencial agendada
  const { data: vistoriaData, isLoading: isLoadingVistoria } = useQuery({
    queryKey: ['vistoria-existente', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return null;
      
      const { data, error } = await publicSupabase
        .from('vistorias')
        .select('id, status, modalidade')
        .eq('cotacao_id', cotacaoId)
        .in('status', ['agendada', 'pendente', 'aprovada', 'em_analise'])
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[useAgendamentoExistente] Erro ao buscar vistoria:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!cotacaoId,
    staleTime: 30000, // 30 segundos
  });

  // Verificar se existe instalação agendada
  const { data: instalacaoData, isLoading: isLoadingInstalacao } = useQuery({
    queryKey: ['instalacao-existente', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return null;
      
      const { data, error } = await publicSupabase
        .from('instalacoes')
        .select('id, status')
        .eq('cotacao_id', cotacaoId)
        .in('status', ['agendada', 'concluida', 'em_andamento', 'em_rota'])
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[useAgendamentoExistente] Erro ao buscar instalação:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!cotacaoId,
    staleTime: 30000, // 30 segundos
  });

  return {
    hasVistoriaAgendada: !!vistoriaData,
    hasInstalacaoAgendada: !!instalacaoData,
    isLoading: isLoadingVistoria || isLoadingInstalacao,
  };
}
