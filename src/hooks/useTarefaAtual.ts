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
  const previousTaskIdRef = useRef<string | null>(null);
  const hasShownAutoAssignToast = useRef(false);

  const query = useQuery({
    queryKey: ['tarefa-atual', profissionalId],
    queryFn: async (): Promise<(TarefaAtual & { confirmacao_whatsapp?: string | null; confirmado_via_whatsapp_em?: string | null }) | null> => {
      if (!profissionalId) return null;

      // Usar a nova RPC que consulta a tabela servicos
      const { data, error } = await supabase.rpc('buscar_tarefa_atual_profissional', {
        p_profissional_id: profissionalId
      });

      if (error) {
        console.error('Erro ao buscar tarefa atual:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const tarefa = data[0];
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
          placa: tarefa.veiculo_placa || '',
          marca: tarefa.veiculo_marca || '',
          modelo: tarefa.veiculo_modelo || '',
          cor: tarefa.veiculo_cor,
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
      };
    },
    enabled: !!profissionalId,
    refetchInterval: 30000, // Refetch a cada 30 segundos
    staleTime: 10000,
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
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tarefaId }: { tarefaId: string }) => {
      // Primeiro verificar se o serviço está atribuído a este profissional
      // e buscar dados para validação de horário
      const { data: servico, error: fetchError } = await supabase
        .from('servicos')
        .select('profissional_id, data_agendada, hora_agendada, permite_encaixe')
        .eq('id', tarefaId)
        .single();
      
      if (fetchError) throw fetchError;
      
      if (!servico?.profissional_id) {
        throw new Error('Serviço não atribuído a nenhum profissional');
      }
      
      if (servico.profissional_id !== profile?.id) {
        throw new Error('Este serviço não está atribuído a você');
      }

      // NOVA VALIDAÇÃO: Verificar se o horário agendado já chegou (exceto encaixes)
      const hojeStr = new Date().toISOString().split('T')[0];
      const horaAtual = new Date().toTimeString().slice(0, 5); // "HH:MM"
      
      if (
        servico &&
        !servico.permite_encaixe &&
        servico.data_agendada === hojeStr &&
        servico.hora_agendada &&
        horaAtual < servico.hora_agendada
      ) {
        throw new Error(`Serviço agendado para ${servico.hora_agendada}. Aguarde o horário.`);
      }

      // Só então atualizar status
      const { error } = await supabase
        .from('servicos')
        .update({ 
          status: 'em_rota',
          em_rota_em: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', tarefaId)
        .eq('profissional_id', profile.id); // Garantia adicional

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Rota iniciada! Siga para o local.');
    },
    onError: (error) => {
      console.error('Erro ao iniciar rota:', error);
      toast.error('Erro ao iniciar rota');
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
      // Agora só precisa atualizar uma tabela: servicos
      const { error } = await supabase
        .from('servicos')
        .update({ 
          status: 'em_andamento',
          iniciada_em: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', tarefaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Tarefa iniciada!');
    },
    onError: (error) => {
      console.error('Erro ao iniciar tarefa:', error);
      toast.error('Erro ao iniciar tarefa');
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
export function useTarefasHistorico(dias: number = 7) {
  const { profile } = useAuth();
  const profissionalId = profile?.id;

  return useQuery({
    queryKey: ['servicos-historico', profissionalId, dias],
    queryFn: async () => {
      if (!profissionalId) return [];

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - dias);

      // Uma única query na tabela servicos
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id,
          tipo,
          status,
          data_agendada,
          concluida_em,
          associado:associados(nome),
          veiculo:veiculos(placa, marca, modelo),
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
