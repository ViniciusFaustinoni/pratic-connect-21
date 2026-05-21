import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import type { TipoServico, StatusServico, PeriodoServico } from './useServicos';

export interface TarefaAtribuida {
  id: string;
  tipo: TipoServico;
  status: StatusServico;
  data_agendada: string | null;
  hora_agendada: string | null;
  periodo: PeriodoServico | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  bairro: string | null;
  cidade: string | null;
  logradouro: string | null;
  numero: string | null;
  uf: string | null;
  permite_encaixe: boolean;
  local_vistoria: string | null;
}

const STATUS_FILA = ['agendada', 'em_rota', 'em_andamento'] as const;

function rankStatus(s: string): number {
  if (s === 'em_andamento') return 0;
  if (s === 'em_rota') return 1;
  return 2; // agendada
}

/**
 * Lista TODAS as tarefas atribuídas ao profissional logado para hoje
 * (status agendada / em_rota / em_andamento). Ordena: execução → rota → agendadas por hora.
 *
 * Realtime já é coberto por useServicosRealtime, que invalida queryKey ['servicos'] e ['tarefa-atual'].
 * Aqui assinamos a key extra ['tarefas-atribuidas'].
 */
export function useTarefasAtribuidas() {
  const { profile } = useAuth();
  const profissionalId = profile?.id;
  const queryClient = useQueryClient();

  // Realtime dedicado (espelhando useServicosRealtime) para invalidar esta key.
  useEffect(() => {
    if (!profissionalId) return;
    const channel = supabase
      .channel(`tarefas-atribuidas-${profissionalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'servicos',
          filter: `profissional_id=eq.${profissionalId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tarefas-atribuidas', profissionalId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profissionalId, queryClient]);

  return useQuery({
    queryKey: ['tarefas-atribuidas', profissionalId],
    enabled: !!profissionalId,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 15000,
    queryFn: async (): Promise<TarefaAtribuida[]> => {
      if (!profissionalId) return [];
      const hoje = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id, tipo, status, data_agendada, hora_agendada, periodo,
          logradouro, numero, bairro, cidade, uf, permite_encaixe, local_vistoria,
          associado:associados!servicos_associado_id_fkey(nome, telefone),
          veiculo:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo)
        `)
        .eq('profissional_id', profissionalId)
        .in('status', STATUS_FILA as unknown as string[])
        .gte('data_agendada', hoje)
        .is('decisao_instalador', null)
        .is('imprevisto_registrado_em', null)
        .order('data_agendada', { ascending: true })
        .order('hora_agendada', { ascending: true });

      if (error) {
        console.error('[useTarefasAtribuidas] erro:', error);
        return [];
      }

      const tarefas: TarefaAtribuida[] = (data || []).map((s: any) => ({
        id: s.id,
        tipo: s.tipo,
        status: s.status,
        data_agendada: s.data_agendada,
        hora_agendada: s.hora_agendada,
        periodo: s.periodo,
        cliente_nome: s.associado?.nome || 'Cliente',
        cliente_telefone: s.associado?.telefone || null,
        placa: s.veiculo?.placa || null,
        marca: s.veiculo?.marca || null,
        modelo: s.veiculo?.modelo || null,
        bairro: s.bairro,
        cidade: s.cidade,
        logradouro: s.logradouro,
        numero: s.numero,
        uf: s.uf,
        permite_encaixe: !!s.permite_encaixe,
        local_vistoria: s.local_vistoria,
      }));

      return tarefas.sort((a, b) => {
        const r = rankStatus(a.status) - rankStatus(b.status);
        if (r !== 0) return r;
        const dataCmp = (a.data_agendada || '').localeCompare(b.data_agendada || '');
        if (dataCmp !== 0) return dataCmp;
        return (a.hora_agendada || '').localeCompare(b.hora_agendada || '');
      });
    },
  });
}
