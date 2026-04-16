import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getHojeBrasilia } from '@/lib/date-utils';

export interface VistoriaBaseFila {
  id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  veiculo_placa: string | null;
  veiculo_descricao: string | null;
  data_agendada: string;
  horario: string;
  status: string;
  observacoes: string | null;
  atendido_por: string | null;
  oficina_id: string | null;
}

/**
 * Lista as vistorias agendadas para HOJE na base.
 * Inclui:
 * - Disponíveis (sem técnico) — qualquer técnico em modo base pode pegar.
 * - Atribuídas ao próprio profissional (continuação).
 *
 * Não inclui vistorias atribuídas a OUTRO profissional, nem canceladas/concluídas.
 */
export function useFilaBaseHoje(enabled: boolean = true) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['fila-base-hoje', profile?.id],
    enabled: enabled && !!profile?.id,
    refetchInterval: 30000,
    staleTime: 15000,
    queryFn: async (): Promise<{
      disponiveis: VistoriaBaseFila[];
      minhas: VistoriaBaseFila[];
    }> => {
      if (!profile?.id) return { disponiveis: [], minhas: [] };

      const hoje = format(getHojeBrasilia(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('agendamentos_base')
        .select(
          'id, cliente_nome, cliente_telefone, veiculo_placa, veiculo_descricao, data_agendada, horario, status, observacoes, atendido_por, oficina_id'
        )
        .eq('data_agendada', hoje)
        .not('status', 'in', '("cancelado","concluido","realizado")')
        .order('horario', { ascending: true });

      if (error) {
        console.error('[useFilaBaseHoje] erro:', error);
        throw error;
      }

      const todos = (data || []) as VistoriaBaseFila[];
      const disponiveis = todos.filter((a) => !a.atendido_por);
      const minhas = todos.filter((a) => a.atendido_por === profile.id);

      return { disponiveis, minhas };
    },
  });
}

/**
 * Atomicamente atribui uma vistoria de base ao profissional.
 * Usa lock otimista (`is('atendido_por', null)`) para evitar duplo-pega.
 */
export function usePegarVistoriaBase() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (agendamentoId: string) => {
      if (!profile?.id) throw new Error('Sem perfil ativo');

      // Lock otimista: só atualiza se ainda estiver disponível
      const { data, error } = await supabase
        .from('agendamentos_base')
        .update({
          atendido_por: profile.id,
          status: 'confirmado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', agendamentoId)
        .is('atendido_por', null)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('Esta vistoria já foi pega por outro técnico.');
      }

      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fila-base-hoje'] });
      qc.invalidateQueries({ queryKey: ['tarefa-atual'] });
      qc.invalidateQueries({ queryKey: ['servicos'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao pegar vistoria');
    },
  });
}
