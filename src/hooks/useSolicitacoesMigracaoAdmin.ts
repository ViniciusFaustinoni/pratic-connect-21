import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// Listar solicitações de migração (admin)
// ============================================

export function useSolicitacoesMigracaoList(filtroStatus: string) {
  return useQuery({
    queryKey: ['solicitacoes-migracao-admin', filtroStatus],
    queryFn: async () => {
      let query = supabase
        .from('solicitacoes_migracao')
        .select(`
          *,
          documentos:solicitacoes_migracao_documentos(*),
          consultor:profiles!solicitacoes_migracao_consultor_id_fkey(id, nome, user_id)
        `)
        .order('created_at', { ascending: true });

      if (filtroStatus && filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });
}

// ============================================
// Buscar configuração de isenção de carência
// ============================================

async function fetchMigracaoIsentarCarencia(): Promise<boolean> {
  const { data } = await supabase
    .from('comissoes_parametros')
    .select('valor')
    .eq('chave', 'migracao_isentar_carencia')
    .maybeSingle();
  return data?.valor === 'true';
}

// ============================================
// Aprovar migração
// ============================================

export function useAprovarMigracao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ solicitacaoId, consultorUserId, cotacaoId, consultorProfileId }: { solicitacaoId: string; consultorUserId: string; cotacaoId?: string; consultorProfileId?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('user_id', userData.user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      // Update solicitação
      const { error: updateError } = await supabase
        .from('solicitacoes_migracao')
        .update({
          status: 'aprovada',
          aprovado_por: profile.id,
          aprovado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitacaoId);

      if (updateError) throw updateError;

      // Insert histórico
      const { error: histError } = await supabase
        .from('migracao_decisoes_historico' as any)
        .insert({
          solicitacao_id: solicitacaoId,
          decisao: 'aprovada',
          analista_id: profile.id,
          analista_nome: profile.nome,
        } as any);

      if (histError) throw histError;

      // Registrar isenção de carência no contrato vinculado (se config permitir)
      if (cotacaoId) {
        const isentarCarencia = await fetchMigracaoIsentarCarencia();
        if (isentarCarencia) {
          await supabase
            .from('contratos')
            .update({
              carencia_isenta: true,
              carencia_motivo_isencao: 'Migração aprovada',
              data_carencia_inicio: null,
              data_carencia_fim: null,
            })
            .eq('cotacao_id', cotacaoId);
        }
      }

      // Pontuação do consultor (se houver)
      if (consultorProfileId) {
        // Buscar parâmetro de pontuação
        const { data: paramPontos } = await supabase
          .from('comissoes_parametros')
          .select('valor')
          .eq('chave', 'pontos_migracao_aprovada')
          .eq('ativo', true)
          .maybeSingle();

        const pontos = paramPontos ? parseFloat(paramPontos.valor) : 1.0;

        // Verificar duplicata
        const { data: existente } = await supabase
          .from('pontuacao_eventos')
          .select('id')
          .eq('referencia_tipo', 'solicitacao_migracao')
          .eq('referencia_id', solicitacaoId)
          .maybeSingle();

        if (!existente) {
          await supabase.from('pontuacao_eventos').insert({
            vendedor_id: consultorProfileId,
            tipo_operacao: 'migracao_aprovada',
            pontos,
            referencia_tipo: 'solicitacao_migracao',
            referencia_id: solicitacaoId,
            conta_ranking: true,
          });
        }
      }

      // Auto-resolver alertas de prazo vencido
      await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('referencia_tipo', 'migracao_prazo_vencido')
        .eq('referencia_id', solicitacaoId);

      // Notificar consultor
      if (consultorUserId) {
        await supabase
          .from('notificacoes')
          .insert({
            user_id: consultorUserId,
            titulo: 'Migração Aprovada',
            mensagem: `Sua solicitação de migração foi aprovada por ${profile.nome}.`,
            tipo: 'migracao',
            modulo: 'cadastro',
            referencia_tipo: 'solicitacao_migracao',
            referencia_id: solicitacaoId,
            link: '/vendas/cotacoes',
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-migracao-admin'] });
      queryClient.invalidateQueries({ queryKey: ['solicitacao-migracao'] });
    },
  });
}

// ============================================
// Reprovar migração
// ============================================

export function useReprovarMigracao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ solicitacaoId, motivo, consultorUserId }: { solicitacaoId: string; motivo: string; consultorUserId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('user_id', userData.user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      // Update solicitação
      const { error: updateError } = await supabase
        .from('solicitacoes_migracao')
        .update({
          status: 'reprovada',
          motivo_reprovacao: motivo,
          aprovado_por: profile.id,
          aprovado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitacaoId);

      if (updateError) throw updateError;

      // Insert histórico
      const { error: histError } = await supabase
        .from('migracao_decisoes_historico' as any)
        .insert({
          solicitacao_id: solicitacaoId,
          decisao: 'reprovada',
          motivo,
          analista_id: profile.id,
          analista_nome: profile.nome,
        } as any);

      if (histError) throw histError;

      // Auto-resolver alertas de prazo vencido
      await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('referencia_tipo', 'migracao_prazo_vencido')
        .eq('referencia_id', solicitacaoId);

      // Notificar consultor
      if (consultorUserId) {
        await supabase
          .from('notificacoes')
          .insert({
            user_id: consultorUserId,
            titulo: 'Migração Reprovada',
            mensagem: `Sua solicitação de migração foi reprovada. Motivo: ${motivo}`,
            tipo: 'migracao',
            modulo: 'cadastro',
            referencia_tipo: 'solicitacao_migracao',
            referencia_id: solicitacaoId,
            link: '/vendas/cotacoes',
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-migracao-admin'] });
      queryClient.invalidateQueries({ queryKey: ['solicitacao-migracao'] });
    },
  });
}
