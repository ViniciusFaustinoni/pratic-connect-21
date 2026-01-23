import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TarefaAtual {
  id: string;
  tipo: 'instalacao' | 'vistoria';
  status: string;
  data_agendada: string;
  hora_agendada: string | null;
  cliente: {
    id: string;
    nome: string;
    telefone: string;
  };
  veiculo: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
  };
  endereco: {
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  distancia_km?: number;
  rota_id?: string;
}

/**
 * Hook para buscar a tarefa atual do vistoriador logado
 */
export function useTarefaAtual() {
  const { profile } = useAuth();
  const vistoriadorId = profile?.id;

  return useQuery({
    queryKey: ['tarefa-atual', vistoriadorId],
    queryFn: async (): Promise<TarefaAtual | null> => {
      if (!vistoriadorId) return null;

      const { data, error } = await supabase.rpc('buscar_tarefa_atual_vistoriador', {
        p_vistoriador_id: vistoriadorId
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
        tipo: tarefa.tipo as 'instalacao' | 'vistoria',
        status: tarefa.status,
        data_agendada: tarefa.data_agendada,
        hora_agendada: tarefa.hora_agendada,
        cliente: {
          id: tarefa.associado_id,
          nome: tarefa.associado_nome || 'Cliente',
          telefone: tarefa.associado_telefone || '',
        },
        veiculo: {
          id: tarefa.veiculo_id,
          placa: tarefa.veiculo_placa || '',
          marca: tarefa.veiculo_marca || '',
          modelo: tarefa.veiculo_modelo || '',
        },
        endereco: {
          logradouro: tarefa.logradouro,
          numero: tarefa.numero,
          bairro: tarefa.bairro,
          cidade: tarefa.cidade,
          uf: tarefa.uf,
          latitude: tarefa.endereco_latitude,
          longitude: tarefa.endereco_longitude,
        },
        rota_id: tarefa.rota_id,
      };
    },
    enabled: !!vistoriadorId,
    refetchInterval: 30000, // Refetch a cada 30 segundos
    staleTime: 10000,
  });
}

/**
 * Hook para iniciar uma tarefa (mudar status para em_andamento)
 */
export function useIniciarTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tarefaId, tipo }: { tarefaId: string; tipo: 'instalacao' | 'vistoria' }) => {
      const tabela = tipo === 'instalacao' ? 'instalacoes' : 'vistorias';
      
      const { error } = await supabase
        .from(tabela)
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
 */
export function useConcluirTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tarefaId, tipo }: { tarefaId: string; tipo: 'instalacao' | 'vistoria' }) => {
      const tabela = tipo === 'instalacao' ? 'instalacoes' : 'vistorias';
      
      const { error } = await supabase
        .from(tabela)
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
      queryClient.invalidateQueries({ queryKey: ['tarefas-historico'] });
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
 */
export function useTarefasHistorico(dias: number = 7) {
  const { profile } = useAuth();
  const vistoriadorId = profile?.id;

  return useQuery({
    queryKey: ['tarefas-historico', vistoriadorId, dias],
    queryFn: async () => {
      if (!vistoriadorId) return [];

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - dias);

      // Buscar instalações concluídas
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select(`
          id,
          status,
          data_agendada,
          concluida_em,
          associado:associados(nome),
          veiculo:veiculos(placa, marca, modelo),
          bairro,
          cidade
        `)
        .eq('instalador_responsavel_id', vistoriadorId)
        .eq('status', 'concluida')
        .gte('concluida_em', dataLimite.toISOString())
        .order('concluida_em', { ascending: false });

      // Buscar vistorias concluídas
      const { data: vistorias } = await supabase
        .from('vistorias')
        .select(`
          id,
          status,
          data_agendada,
          updated_at,
          associado:associados(nome),
          veiculo:veiculos(placa, marca, modelo)
        `)
        .eq('vistoriador_id', vistoriadorId)
        .eq('status', 'aprovada')
        .gte('updated_at', dataLimite.toISOString())
        .order('updated_at', { ascending: false });

      type TarefaHistorico = {
        id: string;
        status: string;
        data_agendada: string;
        concluida_em: string | null;
        associado: { nome: string } | null;
        veiculo: { placa: string; marca: string; modelo: string } | null;
        bairro: string | null;
        cidade: string | null;
        tipo: 'instalacao' | 'vistoria';
      };

      const instalacoesMapped: TarefaHistorico[] = (instalacoes || []).map(i => ({
        id: i.id,
        status: i.status,
        data_agendada: i.data_agendada,
        concluida_em: i.concluida_em,
        associado: i.associado as { nome: string } | null,
        veiculo: i.veiculo as { placa: string; marca: string; modelo: string } | null,
        bairro: i.bairro,
        cidade: i.cidade,
        tipo: 'instalacao' as const
      }));

      const vistoriasMapped: TarefaHistorico[] = (vistorias || []).map(v => ({
        id: v.id,
        status: v.status,
        data_agendada: v.data_agendada,
        concluida_em: v.updated_at,
        associado: v.associado as { nome: string } | null,
        veiculo: v.veiculo as { placa: string; marca: string; modelo: string } | null,
        bairro: null, // Vistorias não têm bairro diretamente
        cidade: null, // Vistorias não têm cidade diretamente
        tipo: 'vistoria' as const
      }));
      
      const tarefas = [...instalacoesMapped, ...vistoriasMapped].sort((a, b) => {
        const dateA = new Date(a.concluida_em || 0);
        const dateB = new Date(b.concluida_em || 0);
        return dateB.getTime() - dateA.getTime();
      });

      return tarefas;
    },
    enabled: !!vistoriadorId,
  });
}
