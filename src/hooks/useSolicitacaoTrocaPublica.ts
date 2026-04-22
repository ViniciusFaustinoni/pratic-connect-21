// Hook público (anon) para a tela de "Em Análise" do novo titular acompanhar
// o status da troca em tempo real, baseado no token da COTAÇÃO.
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';

export function useSolicitacaoTrocaPublicaPorCotacao(cotacaoId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['solicitacao-troca-publica', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return null;
      const { data, error } = await (publicSupabase as any)
        .from('solicitacoes_troca_titularidade')
        .select('id, status, motivo_reprovacao, termo_cancelamento_assinado_em, aprovado_cadastro_em, aprovado_monitoramento_em, servico_vistoria_id')
        .eq('cotacao_id', cotacaoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cotacaoId,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!cotacaoId) return;
    const channel = publicSupabase
      .channel(`troca-publica-${cotacaoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitacoes_troca_titularidade',
          filter: `cotacao_id=eq.${cotacaoId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['solicitacao-troca-publica', cotacaoId] });
        }
      )
      .subscribe();
    return () => { publicSupabase.removeChannel(channel); };
  }, [cotacaoId, qc]);

  return query;
}
