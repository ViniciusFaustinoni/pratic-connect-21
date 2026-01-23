import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInMinutes } from 'date-fns';

export interface MetricaProfissional {
  id: string;
  nome: string;
  tempoMedioTransitoMin: number;
  tempoMedioExecucaoMin: number;
  totalTarefas: number;
}

export interface MetricasTempo {
  tempoMedioTransitoMin: number;
  tempoMedioExecucaoMin: number;
  tempoMedioTransitoFormatado: string;
  tempoMedioExecucaoFormatado: string;
  porProfissional: MetricaProfissional[];
  totalTarefasAnalisadas: number;
}

function formatarTempo(minutos: number): string {
  if (minutos < 1) return '0 min';
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);
  return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
}

interface FiltrosMetricasTempo {
  dataInicio?: Date;
  dataFim?: Date;
  profissionalId?: string;
  tipo?: 'instalacao' | 'vistoria' | 'todos';
}

export function useMetricasTempo(filtros?: FiltrosMetricasTempo) {
  return useQuery({
    queryKey: ['metricas-tempo', filtros],
    queryFn: async (): Promise<MetricasTempo> => {
      // Buscar instalações concluídas com timestamps
      const instQuery = supabase
        .from('instalacoes')
        .select(`
          id,
          em_rota_em,
          iniciada_em,
          concluida_em,
          instalador_responsavel_id,
          profiles:instalador_responsavel_id(id, nome)
        `)
        .eq('status', 'concluida')
        .not('iniciada_em', 'is', null);

      // Buscar vistorias aprovadas/reprovadas (status finais)
      const vistQuery = supabase
        .from('vistorias')
        .select(`
          id,
          em_rota_em,
          iniciada_em,
          concluida_em,
          vistoriador_id,
          profiles:vistoriador_id(id, nome)
        `)
        .in('status', ['aprovada', 'reprovada'])
        .not('iniciada_em', 'is', null);

      // Aplicar filtros de data
      if (filtros?.dataInicio) {
        const dataInicioStr = filtros.dataInicio.toISOString();
        instQuery.gte('concluida_em', dataInicioStr);
        vistQuery.gte('concluida_em', dataInicioStr);
      }
      if (filtros?.dataFim) {
        const dataFimStr = filtros.dataFim.toISOString();
        instQuery.lte('concluida_em', dataFimStr);
        vistQuery.lte('concluida_em', dataFimStr);
      }

      // Aplicar filtro por profissional
      if (filtros?.profissionalId) {
        instQuery.eq('instalador_responsavel_id', filtros.profissionalId);
        vistQuery.eq('vistoriador_id', filtros.profissionalId);
      }

      const [{ data: instalacoes }, { data: vistorias }] = await Promise.all([
        filtros?.tipo === 'vistoria' ? { data: [] } : instQuery,
        filtros?.tipo === 'instalacao' ? { data: [] } : vistQuery,
      ]);

      // Mapear todas as tarefas para cálculo
      interface TarefaComTempo {
        profissionalId: string;
        profissionalNome: string;
        tempoTransito: number | null; // em minutos
        tempoExecucao: number | null; // em minutos
      }

      const tarefas: TarefaComTempo[] = [];

      // Processar instalações
      (instalacoes || []).forEach((inst: any) => {
        if (!inst.profiles) return;
        
        let tempoTransito: number | null = null;
        let tempoExecucao: number | null = null;

        // Tempo de trânsito: de em_rota_em até iniciada_em
        if (inst.em_rota_em && inst.iniciada_em) {
          tempoTransito = differenceInMinutes(
            new Date(inst.iniciada_em),
            new Date(inst.em_rota_em)
          );
          // Descartar valores negativos ou muito altos (> 4 horas)
          if (tempoTransito < 0 || tempoTransito > 240) tempoTransito = null;
        }

        // Tempo de execução: de iniciada_em até concluida_em
        if (inst.iniciada_em && inst.concluida_em) {
          tempoExecucao = differenceInMinutes(
            new Date(inst.concluida_em),
            new Date(inst.iniciada_em)
          );
          // Descartar valores negativos ou muito altos (> 8 horas)
          if (tempoExecucao < 0 || tempoExecucao > 480) tempoExecucao = null;
        }

        tarefas.push({
          profissionalId: inst.profiles.id,
          profissionalNome: inst.profiles.nome || 'Sem nome',
          tempoTransito,
          tempoExecucao,
        });
      });

      // Processar vistorias
      (vistorias || []).forEach((vist: any) => {
        if (!vist.profiles) return;
        
        let tempoTransito: number | null = null;
        let tempoExecucao: number | null = null;

        if (vist.em_rota_em && vist.iniciada_em) {
          tempoTransito = differenceInMinutes(
            new Date(vist.iniciada_em),
            new Date(vist.em_rota_em)
          );
          if (tempoTransito < 0 || tempoTransito > 240) tempoTransito = null;
        }

        if (vist.iniciada_em && vist.concluida_em) {
          tempoExecucao = differenceInMinutes(
            new Date(vist.concluida_em),
            new Date(vist.iniciada_em)
          );
          if (tempoExecucao < 0 || tempoExecucao > 480) tempoExecucao = null;
        }

        tarefas.push({
          profissionalId: vist.profiles.id,
          profissionalNome: vist.profiles.nome || 'Sem nome',
          tempoTransito,
          tempoExecucao,
        });
      });

      // Calcular médias gerais
      const transitosValidos = tarefas.filter(t => t.tempoTransito !== null).map(t => t.tempoTransito!);
      const execucoesValidas = tarefas.filter(t => t.tempoExecucao !== null).map(t => t.tempoExecucao!);

      const tempoMedioTransitoMin = transitosValidos.length > 0
        ? transitosValidos.reduce((a, b) => a + b, 0) / transitosValidos.length
        : 0;

      const tempoMedioExecucaoMin = execucoesValidas.length > 0
        ? execucoesValidas.reduce((a, b) => a + b, 0) / execucoesValidas.length
        : 0;

      // Calcular por profissional
      const porProfissionalMap = new Map<string, {
        id: string;
        nome: string;
        transitoTotal: number;
        transitoCount: number;
        execucaoTotal: number;
        execucaoCount: number;
        total: number;
      }>();

      tarefas.forEach(t => {
        const existing = porProfissionalMap.get(t.profissionalId) || {
          id: t.profissionalId,
          nome: t.profissionalNome,
          transitoTotal: 0,
          transitoCount: 0,
          execucaoTotal: 0,
          execucaoCount: 0,
          total: 0,
        };

        if (t.tempoTransito !== null) {
          existing.transitoTotal += t.tempoTransito;
          existing.transitoCount++;
        }
        if (t.tempoExecucao !== null) {
          existing.execucaoTotal += t.tempoExecucao;
          existing.execucaoCount++;
        }
        existing.total++;

        porProfissionalMap.set(t.profissionalId, existing);
      });

      const porProfissional: MetricaProfissional[] = Array.from(porProfissionalMap.values())
        .map(p => ({
          id: p.id,
          nome: p.nome,
          tempoMedioTransitoMin: p.transitoCount > 0 ? p.transitoTotal / p.transitoCount : 0,
          tempoMedioExecucaoMin: p.execucaoCount > 0 ? p.execucaoTotal / p.execucaoCount : 0,
          totalTarefas: p.total,
        }))
        .sort((a, b) => b.totalTarefas - a.totalTarefas);

      return {
        tempoMedioTransitoMin,
        tempoMedioExecucaoMin,
        tempoMedioTransitoFormatado: formatarTempo(tempoMedioTransitoMin),
        tempoMedioExecucaoFormatado: formatarTempo(tempoMedioExecucaoMin),
        porProfissional,
        totalTarefasAnalisadas: tarefas.length,
      };
    },
    refetchInterval: 60000, // Atualizar a cada 1 minuto
  });
}
