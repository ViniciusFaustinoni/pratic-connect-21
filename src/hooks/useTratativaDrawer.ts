import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface TratativaLog {
  id: string;
  etapa: string;
  acao: string;
  dados: Record<string, unknown>;
  criado_por: string | null;
  created_at: string;
  operador_nome?: string;
}

export function useTratativaDrawer(tratativaId: string | null) {
  const queryClient = useQueryClient();

  // Query tratativa details
  const { data: tratativa } = useQuery({
    queryKey: ['tratativa-detalhe', tratativaId],
    queryFn: async () => {
      if (!tratativaId) return null;
      const { data, error } = await supabase
        .from('manutencao_tratativas')
        .select('*')
        .eq('id', tratativaId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tratativaId,
  });

  // Query logs
  const { data: logs } = useQuery({
    queryKey: ['tratativa-logs', tratativaId],
    queryFn: async () => {
      if (!tratativaId) return [];
      const { data, error } = await supabase
        .from('manutencao_tratativa_logs')
        .select('*')
        .eq('tratativa_id', tratativaId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Fetch operator names
      const userIds = [...new Set((data || []).map(l => l.criado_por).filter(Boolean))] as string[];
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', userIds);
        profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, p.nome || 'Operador']));
      }

      return (data || []).map(l => ({
        ...l,
        dados: (l.dados as Record<string, unknown>) || {},
        operador_nome: l.criado_por ? profilesMap[l.criado_por] || 'Operador' : 'Sistema',
      })) as TratativaLog[];
    },
    enabled: !!tratativaId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tratativa-detalhe', tratativaId] });
    queryClient.invalidateQueries({ queryKey: ['tratativa-logs', tratativaId] });
    queryClient.invalidateQueries({ queryKey: ['manutencao-tratativas'] });
  };

  // Mutation: registrar contato (etapa 1 → 2)
  const registrarContato = useMutation({
    mutationFn: async (params: { canal: string; dataHora: string; resposta: string }) => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id || null;

      const { error: logErr } = await supabase
        .from('manutencao_tratativa_logs')
        .insert({
          tratativa_id: tratativaId!,
          etapa: 'contato',
          acao: 'contato_registrado',
          dados: { canal: params.canal, data_hora: params.dataHora, resposta: params.resposta } as unknown as Json,
          criado_por: userId,
        });
      if (logErr) throw logErr;

      const { error: updErr } = await supabase
        .from('manutencao_tratativas')
        .update({ etapa_atual: 'validacao', status: 'em_tratativa', updated_at: new Date().toISOString() })
        .eq('id', tratativaId!);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success('Contato registrado');
      invalidate();
    },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });

  // Mutation: registrar validação (etapa 2 → 3)
  const registrarValidacao = useMutation({
    mutationFn: async (params: { situacao: string; dados: Record<string, unknown> }) => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id || null;

      const { error: logErr } = await supabase
        .from('manutencao_tratativa_logs')
        .insert({
          tratativa_id: tratativaId!,
          etapa: 'validacao',
          acao: `situacao_${params.situacao}`,
          dados: params.dados as unknown as Json,
          criado_por: userId,
        });
      if (logErr) throw logErr;

      const { error: updErr } = await supabase
        .from('manutencao_tratativas')
        .update({ etapa_atual: 'decisao', updated_at: new Date().toISOString() })
        .eq('id', tratativaId!);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success('Validação registrada');
      invalidate();
    },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });

  // Mutation: resolver sem visita
  const resolverSemVisita = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id || null;

      const { error: logErr } = await supabase
        .from('manutencao_tratativa_logs')
        .insert({
          tratativa_id: tratativaId!,
          etapa: 'decisao',
          acao: 'resolvido_sem_visita',
          dados: { encerrado_em: new Date().toISOString() },
          criado_por: userId,
        });
      if (logErr) throw logErr;

      const { error: updErr } = await supabase
        .from('manutencao_tratativas')
        .update({ status: 'resolvido_sem_visita', etapa_atual: 'concluido', updated_at: new Date().toISOString() })
        .eq('id', tratativaId!);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success('Tratativa encerrada — resolvido sem visita');
      invalidate();
    },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });

  // Mutation: confirmar falha → agendar
  const confirmarFalha = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id || null;

      const { error: logErr } = await supabase
        .from('manutencao_tratativa_logs')
        .insert({
          tratativa_id: tratativaId!,
          etapa: 'decisao',
          acao: 'falha_confirmada_agendar',
          dados: { confirmado_em: new Date().toISOString() },
          criado_por: userId,
        });
      if (logErr) throw logErr;

      const { error: updErr } = await supabase
        .from('manutencao_tratativas')
        .update({ status: 'agendado', etapa_atual: 'concluido', updated_at: new Date().toISOString() })
        .eq('id', tratativaId!);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success('Falha confirmada — visita técnica agendada');
      invalidate();
    },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });

  const etapaAtual = tratativa?.etapa_atual || 'contato';

  return {
    tratativa,
    logs: logs || [],
    etapaAtual,
    registrarContato,
    registrarValidacao,
    resolverSemVisita,
    confirmarFalha,
  };
}
