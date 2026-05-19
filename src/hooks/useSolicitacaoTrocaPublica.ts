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
        .select('id, cotacao_id, status, motivo_reprovacao, termo_cancelamento_assinado_em, aprovado_cadastro_em, aprovado_monitoramento_em, servico_vistoria_id, tipo_vistoria_troca, expirada_em, servico_manutencao_id, created_at');

      // 1) PRIORIDADE: lookup determinístico por solicitacaoId
      //    (vem de cotacoes.dados_extras.solicitacao_troca_id — é a referência canônica).
      if (solicitacaoId) {
        const { data, error } = await baseQuery()
          .eq('id', solicitacaoId)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }

      // 2) FALLBACK: busca por cotacao_id, filtrando estados terminais com valores
      //    REAIS do enum status_troca_titularidade (não existe 'reprovada' simples).
      if (cotacaoId) {
        const { data, error } = await baseQuery()
          .eq('cotacao_id', cotacaoId)
          .not('status', 'in', '(cancelada,expirada,reprovada_cadastro,reprovada_monitoramento)')
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        if (data && data.length > 0) return data[0];
      }

      return null;
    },
    enabled: !!cotacaoId || !!solicitacaoId,
    // Polling agressivo enquanto o termo de cancelamento ainda não foi assinado
    // (5s). Após a assinatura, cai para 15s — o realtime cobre o resto.
    refetchInterval: (q) => {
      const data = q.state.data as { termo_cancelamento_assinado_em?: string | null } | null | undefined;
      return data?.termo_cancelamento_assinado_em ? 15000 : 5000;
    },
    refetchOnWindowFocus: true,
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
