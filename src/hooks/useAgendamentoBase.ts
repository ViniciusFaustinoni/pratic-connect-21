import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ConfiguracaoBase {
  base_cep: string;
  base_logradouro: string;
  base_numero: string;
  base_bairro: string;
  base_cidade: string;
  base_uf: string;
  base_complemento: string;
  base_horario_inicio: string;
  base_horario_fim: string;
  base_capacidade_horario: number;
}

export interface AgendamentoBase {
  id: string;
  data_agendada: string;
  horario: string;
  cotacao_id: string | null;
  instalacao_id: string | null;
  vistoria_id: string | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_email: string | null;
  veiculo_placa: string | null;
  veiculo_descricao: string | null;
  status: string;
  observacoes: string | null;
  atendido_por: string | null;
  created_at: string;
  updated_at: string;
}

// Buscar configurações da base
export function useConfiguracaoBase() {
  return useQuery({
    queryKey: ['configuracao-base'],
    queryFn: async (): Promise<ConfiguracaoBase | null> => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'base_cep', 'base_logradouro', 'base_numero',
          'base_bairro', 'base_cidade', 'base_uf', 'base_complemento',
          'base_horario_inicio', 'base_horario_fim', 'base_capacidade_horario'
        ]);

      if (error) throw error;

      if (!data || data.length === 0) return null;

      const config: Record<string, string> = {};
      data.forEach(item => {
        config[item.chave] = item.valor || '';
      });

      return {
        base_cep: config.base_cep || '',
        base_logradouro: config.base_logradouro || '',
        base_numero: config.base_numero || '',
        base_bairro: config.base_bairro || '',
        base_cidade: config.base_cidade || '',
        base_uf: config.base_uf || '',
        base_complemento: config.base_complemento || '',
        base_horario_inicio: config.base_horario_inicio || '08:00',
        base_horario_fim: config.base_horario_fim || '17:30',
        base_capacidade_horario: parseInt(config.base_capacidade_horario) || 2,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

// Buscar horários ocupados para uma data
export function useHorariosDisponiveis(data: string) {
  return useQuery({
    queryKey: ['horarios-base', data],
    queryFn: async () => {
      if (!data) return [];

      const { data: agendamentos, error } = await supabase
        .from('agendamentos_base')
        .select('horario')
        .eq('data_agendada', data)
        .in('status', ['agendado', 'confirmado']);

      if (error) throw error;
      return agendamentos || [];
    },
    enabled: !!data,
  });
}

// Buscar agendamentos do dia para coordenador
export function useAgendamentosBaseDia(data?: string) {
  const hoje = data || new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['agendamentos-base-dia', hoje],
    queryFn: async () => {
      const { data: agendamentos, error } = await supabase
        .from('agendamentos_base')
        .select(`
          *,
          atendido_por_profile:profiles!agendamentos_base_atendido_por_fkey(nome)
        `)
        .eq('data_agendada', hoje)
        .order('horario', { ascending: true });

      if (error) throw error;
      return agendamentos || [];
    },
    refetchInterval: 30000, // Atualizar a cada 30s
  });
}

// Criar agendamento na base
export function useCriarAgendamentoBase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dados: {
      cotacaoId: string;
      dataAgendada: string;
      horario: string;
      clienteNome: string;
      clienteTelefone?: string;
      clienteEmail?: string;
      veiculoPlaca?: string;
      veiculoDescricao?: string;
    }) => {
      // Verificar capacidade antes de inserir
      const { data: existentes, error: checkError } = await supabase
        .from('agendamentos_base')
        .select('id')
        .eq('data_agendada', dados.dataAgendada)
        .eq('horario', dados.horario)
        .in('status', ['agendado', 'confirmado']);

      if (checkError) throw checkError;

      // Buscar capacidade configurada
      const { data: configCapacidade } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'base_capacidade_horario')
        .single();

      const capacidade = parseInt(configCapacidade?.valor || '2');

      if (existentes && existentes.length >= capacidade) {
        throw new Error('Este horário já está lotado. Por favor, escolha outro.');
      }

      // Criar agendamento
      const { data: agendamento, error } = await supabase
        .from('agendamentos_base')
        .insert({
          cotacao_id: dados.cotacaoId,
          data_agendada: dados.dataAgendada,
          horario: dados.horario,
          cliente_nome: dados.clienteNome,
          cliente_telefone: dados.clienteTelefone,
          cliente_email: dados.clienteEmail,
          veiculo_placa: dados.veiculoPlaca,
          veiculo_descricao: dados.veiculoDescricao,
          status: 'agendado',
        })
        .select()
        .single();

      if (error) throw error;

      // Atualizar cotação com local_vistoria = 'base'
      await supabase
        .from('cotacoes')
        .update({ 
          status_contratacao: 'vistoria_agendada',
          updated_at: new Date().toISOString()
        })
        .eq('id', dados.cotacaoId);

      return agendamento;
    },
    onSuccess: () => {
      toast.success('Agendamento realizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['horarios-base'] });
      queryClient.invalidateQueries({ queryKey: ['agendamentos-base-dia'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar agendamento');
    },
  });
}

// Atualizar status do agendamento (para coordenador)
export function useAtualizarAgendamentoBase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dados: {
      id: string;
      status: string;
      observacoes?: string;
      atendidoPor?: string;
    }) => {
      const { error } = await supabase
        .from('agendamentos_base')
        .update({
          status: dados.status,
          observacoes: dados.observacoes,
          atendido_por: dados.atendidoPor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dados.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Agendamento atualizado!');
      queryClient.invalidateQueries({ queryKey: ['agendamentos-base-dia'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar agendamento');
    },
  });
}
