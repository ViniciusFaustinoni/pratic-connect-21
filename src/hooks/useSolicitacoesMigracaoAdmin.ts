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
// Aprovar migração
// ============================================

export function useAprovarMigracao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ solicitacaoId, consultorUserId }: { solicitacaoId: string; consultorUserId: string }) => {
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
        .from('migracao_decisoes_historico')
        .insert({
          solicitacao_id: solicitacaoId,
          decisao: 'aprovada',
          analista_id: profile.id,
          analista_nome: profile.nome,
        });

      if (histError) throw histError;

      // Notificar consultor
      const { error: notifError } = await supabase
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

      if (notifError) console.error('Erro ao notificar:', notifError);
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
        .from('migracao_decisoes_historico')
        .insert({
          solicitacao_id: solicitacaoId,
          decisao: 'reprovada',
          motivo,
          analista_id: profile.id,
          analista_nome: profile.nome,
        });

      if (histError) throw histError;

      // Notificar consultor
      const { error: notifError } = await supabase
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

      if (notifError) console.error('Erro ao notificar:', notifError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-migracao-admin'] });
      queryClient.invalidateQueries({ queryKey: ['solicitacao-migracao'] });
    },
  });
}
