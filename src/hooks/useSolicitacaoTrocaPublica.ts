// Hook público (anon) para a tela de "Em Análise" do novo titular acompanhar
// o status da troca em tempo real, baseado no token da COTAÇÃO.
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';

export function useSolicitacaoTrocaPublicaPorCotacao(
  cotacaoId: string | null | undefined,
  solicitacaoId?: string | null | undefined,
) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['solicitacao-troca-publica', cotacaoId, solicitacaoId],
    queryFn: async () => {
      if (!cotacaoId && !solicitacaoId) return null;

      const baseQuery = () => (publicSupabase as any)
        .from('solicitacoes_troca_titularidade')
        .select('id, cotacao_id, status, motivo_reprovacao, termo_cancelamento_assinado_em, aprovado_cadastro_em, aprovado_monitoramento_em, servico_vistoria_id, tipo_vistoria_troca, expirada_em, servico_manutencao_id');

      if (cotacaoId) {
        const { data, error } = await baseQuery()
          .eq('cotacao_id', cotacaoId)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }

      if (!solicitacaoId) return null;

      const { data, error } = await baseQuery()
        .eq('id', solicitacaoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cotacaoId || !!solicitacaoId,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!cotacaoId && !solicitacaoId) return;
    const channel = publicSupabase
      .channel(`troca-publica-${cotacaoId || solicitacaoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitacoes_troca_titularidade',
          filter: cotacaoId ? `cotacao_id=eq.${cotacaoId}` : `id=eq.${solicitacaoId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['solicitacao-troca-publica', cotacaoId, solicitacaoId] });
        }
      )
      .subscribe();
    return () => { publicSupabase.removeChannel(channel); };
  }, [cotacaoId, solicitacaoId, qc]);

  return query;
}
