import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AprovacaoDiretoria {
  id: string;
  cotacao_id: string;
  diretor_id: string;
  status: string;
  respondido_em: string | null;
}

/**
 * Verifica se a cotação precisa de aprovação da diretoria e seu status atual
 */
export function useAprovacaoFipeDiretoriaPorCotacao(cotacaoId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['aprovacao-fipe-diretoria', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return null;

      // Buscar fipe_diretoria_aprovado da cotação
      const { data: cotacao } = await (supabase as any)
        .from('cotacoes')
        .select('fipe_diretoria_aprovado')
        .eq('id', cotacaoId)
        .maybeSingle();

      if (!cotacao) return null;

      // null = sem necessidade de aprovação, true = aprovado, false = pendente
      return {
        necessitaAprovacao: cotacao.fipe_diretoria_aprovado === false,
        aprovado: cotacao.fipe_diretoria_aprovado === true,
        semNecessidade: cotacao.fipe_diretoria_aprovado === null,
      };
    },
    enabled: !!cotacaoId && enabled,
    refetchInterval: 15000, // Polling a cada 15s
  });
}

/**
 * Busca configuração de dupla aprovação
 */
export function useConfigDuplaAprovacao() {
  return useQuery({
    queryKey: ['config-dupla-aprovacao-fipe'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['dupla_aprovacao_fipe_diretoria_ativa', 'dupla_aprovacao_fipe_minimo_votos']);

      const map = Object.fromEntries((data || []).map((r) => [r.chave, r.valor]));
      return {
        ativa: map['dupla_aprovacao_fipe_diretoria_ativa'] === 'true',
        minimoVotos: parseInt(map['dupla_aprovacao_fipe_minimo_votos'] || '2') || 2,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
