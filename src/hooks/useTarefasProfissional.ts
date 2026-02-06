import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format } from 'date-fns';

export interface TarefaProfissional {
  id: string;
  tipo: 'vistoria' | 'instalacao' | 'manutencao';
  status: string;
  data_agendada: string;
  iniciada_em: string | null;
  concluida_em: string | null;
  tempo_execucao_min: number | null;
  associado_nome: string;
  veiculo_placa: string;
  bairro: string | null;
}

export interface EstatisticasProfissional {
  totalTarefas: number;
  tempoMedioMin: number;
  ultimaTarefa: string | null;
}

export function useTarefasProfissional(profissionalId: string | null, diasFiltro: number = 30) {
  return useQuery({
    queryKey: ['tarefas-profissional', profissionalId, diasFiltro],
    enabled: !!profissionalId,
    queryFn: async (): Promise<{ tarefas: TarefaProfissional[]; estatisticas: EstatisticasProfissional }> => {
      if (!profissionalId) {
        return { tarefas: [], estatisticas: { totalTarefas: 0, tempoMedioMin: 0, ultimaTarefa: null } };
      }

      const dataInicio = diasFiltro > 0 
        ? format(subDays(new Date(), diasFiltro), 'yyyy-MM-dd')
        : null;

      // Buscar serviços do profissional
      let query = supabase
        .from('servicos')
        .select(`
          id,
          tipo,
          status,
          data_agendada,
          iniciada_em,
          concluida_em,
          bairro,
          instalacoes (
            associados:associado_id (nome),
            veiculos:veiculo_id (placa)
          )
        `)
        .or(`instalador_responsavel_id.eq.${profissionalId},vistoriador_id.eq.${profissionalId}`)
        .in('status', ['concluida', 'aprovada', 'reprovada'])
        .order('concluida_em', { ascending: false, nullsFirst: false });

      if (dataInicio) {
        query = query.gte('data_agendada', dataInicio);
      }

      const { data: servicos, error } = await query;

      if (error) {
        console.error('Erro ao buscar tarefas:', error);
        throw error;
      }

      // Mapear e calcular tempo de execução
      const tarefas: TarefaProfissional[] = (servicos || []).map((s: any) => {
        let tempoExecucaoMin: number | null = null;
        if (s.iniciada_em && s.concluida_em) {
          const inicio = new Date(s.iniciada_em).getTime();
          const fim = new Date(s.concluida_em).getTime();
          tempoExecucaoMin = Math.round((fim - inicio) / (1000 * 60));
        }

        return {
          id: s.id,
          tipo: s.tipo || 'instalacao',
          status: s.status,
          data_agendada: s.data_agendada,
          iniciada_em: s.iniciada_em,
          concluida_em: s.concluida_em,
          tempo_execucao_min: tempoExecucaoMin,
          associado_nome: s.instalacoes?.associados?.nome || 'N/A',
          veiculo_placa: s.instalacoes?.veiculos?.placa || 'N/A',
          bairro: s.bairro,
        };
      });

      // Calcular estatísticas
      const tarefasComTempo = tarefas.filter(t => t.tempo_execucao_min !== null);
      const totalTarefas = tarefas.length;
      const tempoMedioMin = tarefasComTempo.length > 0
        ? Math.round(tarefasComTempo.reduce((sum, t) => sum + (t.tempo_execucao_min || 0), 0) / tarefasComTempo.length)
        : 0;
      const ultimaTarefa = tarefas.length > 0 ? tarefas[0].concluida_em : null;

      return {
        tarefas,
        estatisticas: {
          totalTarefas,
          tempoMedioMin,
          ultimaTarefa,
        },
      };
    },
  });
}
