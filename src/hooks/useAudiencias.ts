import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Audiencia {
  id: string;
  processo_id: string;
  tipo: string;
  data_hora: string;
  local?: string;
  link_videoconferencia?: string;
  pauta?: string;
  status: string;
  resultado?: string;
  advogado_presente?: boolean;
  parte_presente?: boolean;
  testemunhas?: string;
  observacoes?: string;
  modalidade?: string;
  forum?: string;
  vara?: string;
  sala?: string;
  endereco_completo?: string;
  advogado_id?: string;
  juiz_orgao?: string;
  testemunhas_lista?: { nome: string; funcao: string; confirmado: boolean }[];
  documentos_necessarios?: { descricao: string; preparado: boolean }[];
  resultado_tipo?: string;
  resultado_valor?: number;
  resultado_condicoes?: string;
  resultado_prazo_pagamento?: string;
  resultado_prazo_recurso?: string;
  resultado_nova_data?: string;
  resultado_motivo_adiamento?: string;
  resultado_resumo?: string;
  prazo_automatico_criado?: boolean;
  registrado_em?: string;
  registrado_por?: string;
  created_at: string;
  updated_at: string;
  processo?: {
    id: string;
    numero: string;
    numero_processo?: string;
    parte_contraria_nome: string;
    tipo: string;
    status?: string;
  };
  advogado?: {
    id: string;
    nome: string;
    oab?: string;
    oab_estado?: string;
  };
}

export interface AudienciasFilters {
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
  status?: string;
  tipo?: string;
  advogado_id?: string;
  processo_id?: string;
}

export function useAudiencias(filters?: AudienciasFilters) {
  const queryClient = useQueryClient();

  const audienciasQuery = useQuery({
    queryKey: ['audiencias', filters],
    queryFn: async () => {
      let query = supabase
        .from('processos_audiencias')
        .select(`
          *,
          processo:processos(id, numero, numero_processo, parte_contraria_nome, tipo, status),
          advogado:advogados(id, nome, oab, oab_estado)
        `)
        .order('data_hora', { ascending: true });

      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }

      if (filters?.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo);
      }

      if (filters?.advogado_id && filters.advogado_id !== 'todos') {
        query = query.eq('advogado_id', filters.advogado_id);
      }

      if (filters?.processo_id) {
        query = query.eq('processo_id', filters.processo_id);
      }

      if (filters?.dataInicio) {
        query = query.gte('data_hora', filters.dataInicio);
      }

      if (filters?.dataFim) {
        query = query.lte('data_hora', `${filters.dataFim}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Audiencia[];
    }
  });

  // KPI query - sem filtros de período
  const kpiQuery = useQuery({
    queryKey: ['audiencias-kpi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos_audiencias')
        .select('id, data_hora, status, resultado_tipo')
        .in('status', ['agendada', 'realizada', 'adiada', 'redesignada', 'nao_compareceu']);
      if (error) throw error;

      const now = new Date();
      const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const semana = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
      const mes = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

      let hojeCt = 0, semanaCt = 0, mesCt = 0, pendentesRegistro = 0;

      for (const a of data || []) {
        const dt = new Date(a.data_hora);
        if (a.status === 'agendada') {
          if (dt >= hoje && dt < new Date(hoje.getTime() + 24 * 60 * 60 * 1000)) hojeCt++;
          if (dt >= hoje && dt < semana) semanaCt++;
          if (dt >= hoje && dt < mes) mesCt++;
          if (dt < now) pendentesRegistro++;
        }
      }

      return { hoje: hojeCt, semana: semanaCt, mes: mesCt, pendentesRegistro };
    }
  });

  const atualizarStatusMutation = useMutation({
    mutationFn: async ({ 
      audienciaId, status, resultado, advogado_presente, parte_presente, observacoes
    }: { 
      audienciaId: string; status: string; resultado?: string;
      advogado_presente?: boolean; parte_presente?: boolean; observacoes?: string;
    }) => {
      const { error } = await supabase
        .from('processos_audiencias')
        .update({ status, resultado, advogado_presente, parte_presente, observacoes, updated_at: new Date().toISOString() })
        .eq('id', audienciaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiencias'] });
      queryClient.invalidateQueries({ queryKey: ['audiencias-kpi'] });
      toast.success('Audiência atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar audiência: ' + error.message);
    }
  });

  const criarAudienciaMutation = useMutation({
    mutationFn: async (data: {
      processo_id: string;
      tipo: string;
      data_hora: string;
      modalidade?: string;
      local?: string;
      link_videoconferencia?: string;
      forum?: string;
      vara?: string;
      sala?: string;
      endereco_completo?: string;
      advogado_id?: string;
      juiz_orgao?: string;
      testemunhas_lista?: { nome: string; funcao: string; confirmado: boolean }[];
      documentos_necessarios?: { descricao: string; preparado: boolean }[];
      pauta?: string;
      prazo_automatico?: boolean;
    }) => {
      const { prazo_automatico, ...insertData } = data;
      const { data: audiencia, error } = await supabase
        .from('processos_audiencias')
        .insert({
          ...insertData,
          status: 'agendada',
          prazo_automatico_criado: prazo_automatico ?? true,
        })
        .select()
        .single();
      if (error) throw error;

      // Criar prazo automático
      if (prazo_automatico !== false) {
        const dataAudiencia = new Date(data.data_hora);
        await supabase.from('processos_prazos').insert({
          processo_id: data.processo_id,
          descricao: `Audiência de ${data.tipo} — preparação`,
          data_inicio: new Date().toISOString().split('T')[0],
          data_fim: dataAudiencia.toISOString().split('T')[0],
          tipo: 'judicial',
          prioridade: 'alta',
          lembrete_ativo: true,
          lembrete_dias: [7, 3, 1],
        });
      }

      return audiencia;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiencias'] });
      queryClient.invalidateQueries({ queryKey: ['audiencias-kpi'] });
      queryClient.invalidateQueries({ queryKey: ['processo-audiencias'] });
      toast.success('Audiência agendada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao agendar audiência: ' + error.message);
    }
  });

  const registrarResultadoMutation = useMutation({
    mutationFn: async (data: {
      audienciaId: string;
      resultado_tipo: string;
      resultado_resumo: string;
      resultado_valor?: number;
      resultado_condicoes?: string;
      resultado_prazo_pagamento?: string;
      resultado_prazo_recurso?: string;
      resultado_nova_data?: string;
      resultado_motivo_adiamento?: string;
      processo_id: string;
      tipo: string;
    }) => {
      const statusMap: Record<string, string> = {
        acordo: 'realizada',
        conciliacao_frustrada: 'realizada',
        instrucao_concluida: 'realizada',
        sentenca: 'realizada',
        nova_audiencia: 'redesignada',
        adiada: 'adiada',
        nao_compareceu: 'nao_compareceu',
      };

      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('processos_audiencias')
        .update({
          status: statusMap[data.resultado_tipo] || 'realizada',
          resultado_tipo: data.resultado_tipo,
          resultado_resumo: data.resultado_resumo,
          resultado_valor: data.resultado_valor,
          resultado_condicoes: data.resultado_condicoes,
          resultado_prazo_pagamento: data.resultado_prazo_pagamento,
          resultado_prazo_recurso: data.resultado_prazo_recurso,
          resultado_nova_data: data.resultado_nova_data,
          resultado_motivo_adiamento: data.resultado_motivo_adiamento,
          registrado_em: new Date().toISOString(),
          registrado_por: user?.user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.audienciaId);
      if (error) throw error;

      // Se nova audiência designada, criar nova
      if (data.resultado_tipo === 'nova_audiencia' && data.resultado_nova_data) {
        await supabase.from('processos_audiencias').insert({
          processo_id: data.processo_id,
          tipo: data.tipo,
          data_hora: data.resultado_nova_data,
          status: 'agendada',
        });
      }

      // Se sentença com prazo recurso, criar prazo
      if (data.resultado_tipo === 'sentenca' && data.resultado_prazo_recurso) {
        await supabase.from('processos_prazos').insert({
          processo_id: data.processo_id,
          descricao: 'Prazo para recurso — sentença proferida em audiência',
          data_inicio: new Date().toISOString().split('T')[0],
          data_fim: data.resultado_prazo_recurso,
          tipo: 'judicial',
          prioridade: 'urgente',
          lembrete_ativo: true,
          lembrete_dias: [7, 3, 1],
        });
      }

      // Registrar andamento no processo
      const RESULTADO_LABELS: Record<string, string> = {
        acordo: 'Acordo alcançado',
        conciliacao_frustrada: 'Conciliação frustrada',
        instrucao_concluida: 'Instrução concluída',
        sentenca: 'Sentença proferida',
        nova_audiencia: 'Nova audiência designada',
        adiada: 'Audiência adiada',
        nao_compareceu: 'Pratic não compareceu',
      };

      await supabase.from('processos_andamentos').insert({
        processo_id: data.processo_id,
        data: new Date().toISOString().split('T')[0],
        descricao: `Audiência de ${data.tipo} realizada. Resultado: ${RESULTADO_LABELS[data.resultado_tipo] || data.resultado_tipo}. ${data.resultado_resumo}`,
        tipo: 'audiencia',
        registrado_por: user?.user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiencias'] });
      queryClient.invalidateQueries({ queryKey: ['audiencias-kpi'] });
      queryClient.invalidateQueries({ queryKey: ['processo-audiencias'] });
      queryClient.invalidateQueries({ queryKey: ['processo-andamentos'] });
      toast.success('Resultado registrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar resultado: ' + error.message);
    }
  });

  return {
    audiencias: audienciasQuery.data || [],
    isLoading: audienciasQuery.isLoading,
    refetch: audienciasQuery.refetch,
    kpi: kpiQuery.data || { hoje: 0, semana: 0, mes: 0, pendentesRegistro: 0 },
    isLoadingKpi: kpiQuery.isLoading,
    atualizarStatus: atualizarStatusMutation.mutate,
    isAtualizando: atualizarStatusMutation.isPending,
    criarAudiencia: criarAudienciaMutation.mutateAsync,
    isCriando: criarAudienciaMutation.isPending,
    registrarResultado: registrarResultadoMutation.mutateAsync,
    isRegistrando: registrarResultadoMutation.isPending,
  };
}
