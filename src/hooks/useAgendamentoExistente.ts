import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';

interface AgendamentoExistenteResult {
  hasVistoriaAgendada: boolean;
  hasInstalacaoAgendada: boolean;
  hasAgendamentoBase: boolean;
  isLoading: boolean;
}

/**
 * Hook para verificar se já existe vistoria, instalação ou agendamento na base para uma cotação.
 * Consulta diretamente as tabelas operacionais como fonte da verdade,
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
        .in('status', ['agendada', 'pendente', 'aprovada', 'em_analise', 'em_rota', 'em_andamento'])
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[useAgendamentoExistente] Erro ao buscar vistoria:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!cotacaoId,
    staleTime: 30000,
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
    staleTime: 30000,
  });

  // Verificar se existe agendamento na base
  const { data: agendamentoBaseData, isLoading: isLoadingAgendamentoBase } = useQuery({
    queryKey: ['agendamento-base-existente', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return null;
      
      const { data, error } = await publicSupabase
        .from('agendamentos_base')
        .select('id, status')
        .eq('cotacao_id', cotacaoId)
        .in('status', ['agendado', 'confirmado', 'realizado'])
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[useAgendamentoExistente] Erro ao buscar agendamento base:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!cotacaoId,
    staleTime: 30000,
  });

  return {
    hasVistoriaAgendada: !!vistoriaData,
    hasInstalacaoAgendada: !!instalacaoData,
    hasAgendamentoBase: !!agendamentoBaseData,
    isLoading: isLoadingVistoria || isLoadingInstalacao || isLoadingAgendamentoBase,
  };
}
