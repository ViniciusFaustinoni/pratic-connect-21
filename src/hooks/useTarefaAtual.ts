import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useRef, useEffect } from 'react';
import { 
  TarefaAtual, 
  TipoServico, 
  StatusServico, 
  PeriodoServico,
  TIPO_SERVICO_LABELS 
} from './useServicos';

// Tipo estendido com confirmação WhatsApp
export type TarefaAtualComConfirmacao = TarefaAtual & {
  confirmacao_whatsapp?: 'pendente' | 'enviada' | 'confirmada' | 'reagendado' | 'nao_respondeu' | null;
  confirmado_via_whatsapp_em?: string | null;
};

// Re-exportar os tipos para compatibilidade
export type { TarefaAtual };

/**
 * Hook para buscar a tarefa atual do profissional logado
 * Usa a nova RPC buscar_tarefa_atual_profissional que consulta a tabela servicos
 */
export function useTarefaAtual() {
  const { profile } = useAuth();
  const profissionalId = profile?.id;
  const profileUserId = profile?.user_id;
  const previousTaskIdRef = useRef<string | null>(null);
  const hasShownAutoAssignToast = useRef(false);

  const query = useQuery({
    queryKey: ['tarefa-atual', profissionalId],
    queryFn: async (): Promise<(TarefaAtual & { confirmacao_whatsapp?: string | null; confirmado_via_whatsapp_em?: string | null }) | null> => {
      if (!profissionalId) return null;

      // NÃO chamar supabase.auth.getUser() aqui — antes era feito a cada 5s
      // e gerava pressão imensa no serviço de Auth. O AuthContext já valida o user.

      // Usar a RPC que consulta a tabela servicos
      const { data, error } = await supabase.rpc('buscar_tarefa_atual_profissional', {
        p_profissional_id: profissionalId
      });

      // Defesa em profundidade: se a RPC falhar (ex.: schema drift),
      // NÃO propaga o erro — loga e cai no fallback direto na tabela servicos
      // para que a tela do técnico continue funcionando.
      if (error) {
        console.error('[useTarefaAtual] RPC falhou, usando fallback:', error);
      }

      // FALLBACK: Se RPC falhou OU retornou vazio, buscar diretamente na tabela servicos
      let tarefa: any = null;
      if (error || !data || data.length === 0) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('servicos')
          .select(`
            id, tipo, status, data_agendada, hora_agendada, periodo,
            associado_id, veiculo_id, cotacao_id, contrato_id, rastreador_id,
            local_vistoria, observacoes, rota_id, iniciada_em, em_rota_em,
            instalacao_origem_id, vistoria_origem_id, confirmacao_whatsapp,
            confirmado_via_whatsapp_em, permite_encaixe, contato_realizado_em,
            contato_tipo, etapa_atual, logradouro, numero, bairro, cidade, uf, cep,
            latitude, longitude,
            associado:associados!servicos_associado_id_fkey(nome, telefone, whatsapp),
            veiculo:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo, cor),
            rastreador:rastreadores!servicos_rastreador_id_fkey(imei),
            rastreador_substituto:rastreadores!servicos_rastreador_substituto_id_fkey(imei)
          `)
          .eq('profissional_id', profissionalId)
          .in('status', ['em_andamento', 'em_rota', 'agendada'])
          .not('status', 'in', '("imprevisto_pendente","nao_compareceu","em_analise","concluida","aprovada","aprovada_ressalvas","reprovada","cancelada")')
          .is('decisao_instalador', null)
          .is('imprevisto_registrado_em', null)
          .order('data_agendada', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (fallbackError) {
          console.error('[useTarefaAtual] Fallback também falhou:', fallbackError);
          return null;
        }

        if (!fallbackData) return null;

        // Mapear formato do fallback para o formato esperado
        const assoc = fallbackData.associado as any;
        const veic = fallbackData.veiculo as any;
        const rast = fallbackData.rastreador as any;
        const rastSubstituto = (fallbackData as any).rastreador_substituto as any;
        tarefa = {
          ...fallbackData,
          associado_nome: assoc?.nome || 'Cliente',
          associado_telefone: assoc?.telefone || '',
          associado_whatsapp: assoc?.whatsapp,
          placa: veic?.placa || '',
          marca: veic?.marca || '',
          modelo: veic?.modelo || '',
          cor: veic?.cor,
          imei_rastreador: rast?.imei || rastSubstituto?.imei,
        };
      } else {
        tarefa = data[0];
      }

      return {
        id: tarefa.id,
        tipo: tarefa.tipo as TipoServico,
        status: tarefa.status as StatusServico,
        data_agendada: tarefa.data_agendada,
        hora_agendada: tarefa.hora_agendada,
        periodo: (tarefa.periodo || 'manha') as PeriodoServico,
        cliente: {
          id: tarefa.associado_id || '',
          nome: tarefa.associado_nome || 'Cliente',
          telefone: tarefa.associado_telefone || '',
          whatsapp: tarefa.associado_whatsapp,
        },
        veiculo: {
          id: tarefa.veiculo_id || '',
          placa: (tarefa as any).veiculo_placa || tarefa.placa || '',
          marca: (tarefa as any).veiculo_marca || tarefa.marca || '',
          modelo: (tarefa as any).veiculo_modelo || tarefa.modelo || '',
          cor: (tarefa as any).veiculo_cor || tarefa.cor,
        },
        endereco: {
          logradouro: tarefa.logradouro,
          numero: tarefa.numero,
          bairro: tarefa.bairro,
          cidade: tarefa.cidade,
          uf: tarefa.uf,
          cep: tarefa.cep,
          latitude: tarefa.latitude,
          longitude: tarefa.longitude,
        },
        cotacao_id: tarefa.cotacao_id,
        contrato_id: tarefa.contrato_id,
        rastreador_id: tarefa.rastreador_id,
        imei_rastreador: tarefa.imei_rastreador,
        local_vistoria: tarefa.local_vistoria,
        observacoes: tarefa.observacoes,
        rota_id: tarefa.rota_id,
        iniciada_em: tarefa.iniciada_em,
        em_rota_em: tarefa.em_rota_em,
        instalacao_origem_id: tarefa.instalacao_origem_id,
        vistoria_origem_id: tarefa.vistoria_origem_id,
        confirmacao_whatsapp: tarefa.confirmacao_whatsapp || null,
        confirmado_via_whatsapp_em: tarefa.confirmado_via_whatsapp_em || null,
        permite_encaixe: tarefa.permite_encaixe ?? false,
        contato_realizado_em: tarefa.contato_realizado_em || null,
        contato_tipo: tarefa.contato_tipo || null,
        etapa_atual: tarefa.etapa_atual || 1,
      };
    },
    enabled: !!profissionalId,
    // Antes era 5s (gerava enorme pressão sobre Auth+DB). 30s é suficiente
    // pois useServicosRealtime já invalida instantaneamente em mudanças.
    refetchInterval: 30000,
    // Pausar polling quando aba está oculta (economia massiva de requests)
    refetchIntervalInBackground: false,
    staleTime: 15000,
  });

  // Detectar quando uma nova tarefa é atribuída automaticamente
  useEffect(() => {
    const currentTaskId = query.data?.id || null;
    
    // Se uma tarefa nova apareceu (diferente da anterior) e não foi iniciada pelo usuário
    if (
      currentTaskId && 
      currentTaskId !== previousTaskIdRef.current &&
      previousTaskIdRef.current !== null && // Não notificar no primeiro load
      !hasShownAutoAssignToast.current
    ) {
      // Nova tarefa atribuída automaticamente!
      const tipoLabel = TIPO_SERVICO_LABELS[query.data?.tipo || 'instalacao'];
      toast.success(`Nova tarefa atribuída automaticamente!`, {
        description: `${tipoLabel} para ${query.data?.cliente.nome || 'cliente'} em ${query.data?.endereco.bairro || query.data?.endereco.cidade || 'endereço'}`,
        duration: 8000,
      });
      hasShownAutoAssignToast.current = true;
      
      // Reset flag após 5 segundos para permitir próximas notificações
      setTimeout(() => {
        hasShownAutoAssignToast.current = false;
      }, 5000);
    }
    
    previousTaskIdRef.current = currentTaskId;
  }, [query.data?.id, query.data?.tipo, query.data?.cliente.nome, query.data?.endereco.bairro, query.data?.endereco.cidade]);

  return query;
}

/**
 * Hook para iniciar a rota (mudar status de 'agendada' para 'em_rota')
 * Usado quando o profissional aceita uma tarefa atribuída manualmente
 */
export function useIniciarRota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tarefaId }: { tarefaId: string }) => {
      // RPC transacional: valida atribuição + status + atualiza em uma única ida
      const { data, error } = await supabase.rpc('iniciar_rota_servico', {
        p_servico_id: tarefaId,
      });

      if (error) {
        console.error('[useIniciarRota] RPC error:', error);
        throw new Error(error.message || 'Não foi possível iniciar a rota.');
      }

      const result = (data ?? {}) as { ok?: boolean; codigo?: string; mensagem?: string };
      if (!result.ok) {
        const err: any = new Error(result.mensagem || 'Não foi possível iniciar a rota.');
        err.codigo = result.codigo;
        throw err;
      }

      // Disparar notificações em background (não bloqueia o fluxo)
      supabase.functions.invoke('notificar-inicio-rota', {
        body: { servico_id: tarefaId }
      }).then(r => {
        if (r.error) console.warn('[useIniciarRota] Erro ao disparar notificações:', r.error);
        else console.log('[useIniciarRota] Notificações disparadas:', r.data);
      }).catch(e => console.warn('[useIniciarRota] Exceção ao disparar notificações:', e));

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success(result?.mensagem || 'Rota iniciada! Siga para o local.');
    },
    onError: (error: any) => {
      console.error('Erro ao iniciar rota:', error);
      // Auto-recuperação: invalidar para o card refletir o estado real do servidor
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.error(error?.message || 'Erro ao iniciar rota');
    }
  });
}

/**
 * Hook para iniciar uma tarefa (mudar status para em_andamento)
 * Agora usa a tabela servicos unificada
 */
export function useIniciarTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tarefaId }: { tarefaId: string; tipo?: string }) => {
      const { data, error } = await supabase.rpc('iniciar_tarefa_servico', {
        p_servico_id: tarefaId,
      });

      if (error) {
        console.error('[useIniciarTarefa] RPC error:', error);
        throw new Error(error.message || 'Não foi possível iniciar a tarefa.');
      }

      const result = (data ?? {}) as { ok?: boolean; codigo?: string; mensagem?: string };
      if (!result.ok) {
        const err: any = new Error(result.mensagem || 'Não foi possível iniciar a tarefa.');
        err.codigo = result.codigo;
        throw err;
      }
      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success(result?.mensagem || 'Tarefa iniciada!');
    },
    onError: (error: any) => {
      console.error('Erro ao iniciar tarefa:', error);
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.error(error?.message || 'Erro ao iniciar tarefa');
    }
  });
}

/**
 * Hook para concluir uma tarefa
 * Agora usa a tabela servicos unificada
 */
export function useConcluirTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tarefaId }: { tarefaId: string; tipo?: string }) => {
      const { error } = await supabase
        .from('servicos')
        .update({ 
          status: 'concluida',
          concluida_em: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', tarefaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-historico'] });
      toast.success('Tarefa concluída!');
    },
    onError: (error) => {
      console.error('Erro ao concluir tarefa:', error);
      toast.error('Erro ao concluir tarefa');
    }
  });
}

/**
 * Hook para buscar histórico de tarefas concluídas
 * Agora usa a tabela servicos unificada
 */
export function useTarefasHistorico() {
  const { profile } = useAuth();
  const profissionalId = profile?.id;
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  return useQuery({
    queryKey: ['servicos-historico', profissionalId, anoAtual, mesAtual],
    queryFn: async () => {
      if (!profissionalId) return [];

      const dataLimite = new Date(anoAtual, mesAtual, 1); // primeiro dia do mês

      // Uma única query na tabela servicos
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id,
          tipo,
          status,
          data_agendada,
          concluida_em,
          associado:associados!servicos_associado_id_fkey(nome),
          veiculo:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo),
          bairro,
          cidade
        `)
        .eq('profissional_id', profissionalId)
        .in('status', ['concluida', 'aprovada', 'reprovada'])
        .gte('concluida_em', dataLimite.toISOString())
        .order('concluida_em', { ascending: false });

      if (error) {
        console.error('Erro ao buscar histórico:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!profissionalId,
  });
}
