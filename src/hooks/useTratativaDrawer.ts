import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { format } from 'date-fns';

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
    onSuccess: () => { toast.success('Contato registrado'); invalidate(); },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });

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
    onSuccess: () => { toast.success('Validação registrada'); invalidate(); },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });

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
          dados: { encerrado_em: new Date().toISOString() } as unknown as Json,
          criado_por: userId,
        });
      if (logErr) throw logErr;
      const { error: updErr } = await supabase
        .from('manutencao_tratativas')
        .update({ status: 'resolvido_sem_visita', etapa_atual: 'concluido', updated_at: new Date().toISOString() })
        .eq('id', tratativaId!);
      if (updErr) throw updErr;
    },
    onSuccess: () => { toast.success('Tratativa encerrada — resolvido sem visita'); invalidate(); },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });

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
          dados: { confirmado_em: new Date().toISOString() } as unknown as Json,
          criado_por: userId,
        });
      if (logErr) throw logErr;
      const { error: updErr } = await supabase
        .from('manutencao_tratativas')
        .update({ status: 'agendado', etapa_atual: 'concluido', updated_at: new Date().toISOString() })
        .eq('id', tratativaId!);
      if (updErr) throw updErr;
    },
    onSuccess: () => { toast.success('Falha confirmada — visita técnica agendada'); invalidate(); },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });

  // New: confirmar agendamento
  const confirmarAgendamento = useMutation({
    mutationFn: async (params: {
      enderecoTipo: string;
      enderecoTexto: string;
      enderecoReferencia: string;
      dataAgendamento: Date;
      periodo: string;
      tecnicoId: string | null;
      tiposOcorrencia: string[];
      observacoesTecnico: string;
      taxaVisitaAplicar: boolean;
      taxaVisitaObservacao: string;
    }) => {
      if (!tratativa) throw new Error('Tratativa não encontrada');
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id || null;

      // Fetch associado for address
      const { data: assoc } = await supabase
        .from('associados')
        .select('logradouro, numero, bairro, cidade, estado, cep, nome, telefone')
        .eq('id', tratativa.associado_id)
        .single();

      const dataStr = format(params.dataAgendamento, 'yyyy-MM-dd');
      const periodoServico = params.periodo === 'integral' ? 'manha' : params.periodo;

      // Build address fields for servicos
      let logradouro = assoc?.logradouro || '';
      let numero = assoc?.numero || '';
      let bairro = assoc?.bairro || '';
      let cidade = assoc?.cidade || '';
      let uf = assoc?.estado || '';
      let cep = assoc?.cep || '';
      if (params.enderecoTipo !== 'cadastro' && params.enderecoTexto) {
        logradouro = params.enderecoTexto;
        numero = '';
        bairro = '';
      }

      // Create servico
      const { data: servico, error: sErr } = await supabase
        .from('servicos')
        .insert({
          tipo: 'vistoria_manutencao' as any,
          status: 'pendente' as any,
          data_agendada: dataStr,
          periodo: periodoServico as any,
          profissional_id: params.tecnicoId,
          associado_id: tratativa.associado_id,
          veiculo_id: tratativa.veiculo_id,
          logradouro,
          numero,
          bairro,
          cidade,
          uf,
          cep,
          complemento: params.enderecoReferencia || null,
          observacoes: params.observacoesTecnico || null,
          motivo_manutencao: params.tiposOcorrencia.join(', '),
          local_tipo_manutencao: params.enderecoTipo,
          rastreador_id: tratativa.rastreador_id,
        } as any)
        .select('id')
        .single();
      if (sErr) throw sErr;

      // Update tratativa
      const { error: tErr } = await supabase
        .from('manutencao_tratativas')
        .update({
          endereco_tipo: params.enderecoTipo,
          endereco_texto: params.enderecoTexto || null,
          endereco_referencia: params.enderecoReferencia || null,
          data_agendamento: new Date(dataStr).toISOString(),
          periodo_agendamento: params.periodo,
          tecnico_id: params.tecnicoId,
          tipos_ocorrencia: params.tiposOcorrencia,
          observacoes_tecnico: params.observacoesTecnico || null,
          taxa_visita_aplicar: params.taxaVisitaAplicar,
          taxa_visita_observacao: params.taxaVisitaObservacao || null,
          servico_id: servico.id,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', tratativaId!);
      if (tErr) throw tErr;

      // Log
      const { error: logErr } = await supabase
        .from('manutencao_tratativa_logs')
        .insert({
          tratativa_id: tratativaId!,
          etapa: 'agendamento',
          acao: 'agendamento_confirmado',
          dados: {
            data: dataStr,
            periodo: params.periodo,
            tecnico_id: params.tecnicoId,
            endereco_tipo: params.enderecoTipo,
            tipos_ocorrencia: params.tiposOcorrencia,
            taxa_visita: params.taxaVisitaAplicar,
          } as unknown as Json,
          criado_por: userId,
        });
      if (logErr) throw logErr;
    },
    onSuccess: () => { toast.success('Visita técnica agendada com sucesso'); invalidate(); },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });

  const etapaAtual = (tratativa as any)?.etapa_atual || 'contato';

  return {
    tratativa,
    logs: logs || [],
    etapaAtual,
    registrarContato,
    registrarValidacao,
    resolverSemVisita,
    confirmarFalha,
    confirmarAgendamento,
  };
}
