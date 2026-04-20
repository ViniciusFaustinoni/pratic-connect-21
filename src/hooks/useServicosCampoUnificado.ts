import { useMemo } from 'react';
import { useServicos, type Servico, type StatusServico, type TipoServico } from './useServicos';
import { startOfDay, endOfDay, isToday, parseISO } from 'date-fns';

export type FaseServico =
  | 'pre_execucao'
  | 'em_campo'
  | 'aguardando_analise'
  | 'concluida'
  | 'nao_compareceu'
  | 'reagendada'
  | 'cancelada';

export type OrigemTecnico = 'todos' | 'interno' | 'prestador';

export interface ServicosCampoFilters {
  search?: string;
  tipos?: TipoServico[];
  statuses?: StatusServico[];
  origemTecnico?: OrigemTecnico;
  cidade?: string;
  uf?: string;
  dataInicio?: string;
  dataFim?: string;
  fase?: FaseServico | 'todos';
}

export const FASE_TO_STATUS: Record<FaseServico, StatusServico[]> = {
  pre_execucao: ['pendente', 'agendada'],
  em_campo: ['em_rota', 'em_andamento'],
  aguardando_analise: ['em_analise'],
  concluida: ['concluida', 'aprovada', 'aprovada_ressalvas'],
  nao_compareceu: ['nao_compareceu'],
  reagendada: ['reagendada'],
  cancelada: ['cancelada', 'reprovada'],
};

export const FASE_LABELS: Record<FaseServico, string> = {
  pre_execucao: 'Pré-Execução',
  em_campo: 'Em Campo',
  aguardando_analise: 'Aguardando Análise',
  concluida: 'Concluídas',
  nao_compareceu: 'Não Compareceu',
  reagendada: 'Reagendadas',
  cancelada: 'Canceladas',
};

function isInterno(s: Servico): boolean {
  // Heurística: tem profissional_id (técnico interno) e não tem origem 'prestador'
  return !!s.profissional_id && (s as any).origem !== 'prestador_externo';
}

function isPrestador(s: Servico): boolean {
  return (s as any).vistoriador_prestador_id != null
    || (s as any).origem === 'prestador_externo';
}

export function useServicosCampoUnificado(filters: ServicosCampoFilters = {}) {
  // Busca todos os tipos de campo (sem vistoria_entrada que é base)
  const tiposBase: TipoServico[] = filters.tipos && filters.tipos.length > 0
    ? filters.tipos
    : [
        'instalacao',
        'revistoria',
        'vistoria_entrada',
        'vistoria_saida',
        'vistoria_sinistro',
        'vistoria_periodica',
        'vistoria_manutencao',
        'vistoria_retirada',
      ];

  const query = useServicos({
    tipo: tiposBase,
    data_inicio: filters.dataInicio,
    data_fim: filters.dataFim,
  });

  const servicos = query.data || [];

  const servicosFiltrados = useMemo(() => {
    let result = servicos;

    if (filters.search?.trim()) {
      const s = filters.search.toLowerCase().trim();
      result = result.filter((srv) =>
        srv.associado?.nome?.toLowerCase().includes(s) ||
        srv.veiculo?.placa?.toLowerCase().includes(s) ||
        srv.protocolo?.toLowerCase().includes(s) ||
        (srv as any).rastreador?.codigo?.toLowerCase().includes(s) ||
        srv.imei_rastreador?.toLowerCase().includes(s)
      );
    }

    if (filters.fase && filters.fase !== 'todos') {
      const allowed = new Set(FASE_TO_STATUS[filters.fase]);
      result = result.filter((srv) => allowed.has(srv.status));
    }

    if (filters.statuses && filters.statuses.length > 0) {
      const allowed = new Set(filters.statuses);
      result = result.filter((srv) => allowed.has(srv.status));
    }

    if (filters.origemTecnico === 'interno') {
      result = result.filter(isInterno);
    } else if (filters.origemTecnico === 'prestador') {
      result = result.filter(isPrestador);
    }

    if (filters.cidade?.trim()) {
      const c = filters.cidade.toLowerCase().trim();
      result = result.filter((srv) => srv.cidade?.toLowerCase().includes(c));
    }

    if (filters.uf?.trim()) {
      const uf = filters.uf.toUpperCase().trim();
      result = result.filter((srv) => srv.uf?.toUpperCase() === uf);
    }

    return result;
  }, [servicos, filters]);

  const metricas = useMemo(() => {
    const todayCount = (s: Servico) =>
      s.concluida_em ? isToday(parseISO(s.concluida_em)) : false;

    return {
      preExecucao: servicos.filter((s) => FASE_TO_STATUS.pre_execucao.includes(s.status)).length,
      emCampo: servicos.filter((s) => FASE_TO_STATUS.em_campo.includes(s.status)).length,
      aguardandoAnalise: servicos.filter((s) => FASE_TO_STATUS.aguardando_analise.includes(s.status)).length,
      concluidasHoje: servicos.filter((s) => FASE_TO_STATUS.concluida.includes(s.status) && todayCount(s)).length,
      naoCompareceu: servicos.filter((s) => s.status === 'nao_compareceu').length,
      reagendadas: servicos.filter((s) => s.status === 'reagendada').length,
      multas: servicos.filter((s) => (s as any).multa_aplicada).length,
      totalDia: servicos.filter((s) => {
        if (!s.data_agendada) return false;
        try {
          return isToday(parseISO(s.data_agendada));
        } catch {
          return false;
        }
      }).length,
      total: servicos.length,
    };
  }, [servicos]);

  return {
    servicos: servicosFiltrados,
    todos: servicos,
    metricas,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
