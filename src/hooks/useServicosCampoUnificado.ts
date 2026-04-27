import { useMemo } from 'react';
import { useServicos, type Servico, type StatusServico, type TipoServico } from './useServicos';
import { isToday, parseISO, differenceInHours } from 'date-fns';

export type FaseServico =
  | 'pre_execucao'
  | 'em_campo'
  | 'aguardando_analise'
  | 'concluida'
  | 'nao_compareceu'
  | 'reagendada'
  | 'cancelada';

export type OrigemTecnico = 'todos' | 'interno' | 'prestador';

export type FaseJornada =
  | 'aguardando_documentos'
  | 'documentos_em_analise'
  | 'documentos_aprovados_sem_agendamento'
  | 'agendado_aguardando_data'
  | 'em_rota_execucao'
  | 'concluido_aguardando_analise'
  | 'concluido_aguardando_ativacao'
  | 'reprovado_aguardando_reagendamento'
  | 'nao_compareceu_pendente_contato'
  | 'cancelado_suspenso';

export const FASE_JORNADA_LABELS: Record<FaseJornada, string> = {
  aguardando_documentos: 'Aguardando documentos',
  documentos_em_analise: 'Documentos em análise',
  documentos_aprovados_sem_agendamento: 'Documentos aprovados — sem agendamento',
  agendado_aguardando_data: 'Agendado — aguardando data',
  em_rota_execucao: 'Em rota / em execução',
  concluido_aguardando_analise: 'Concluído — aguardando análise',
  concluido_aguardando_ativacao: 'Concluído — aguardando ativação',
  reprovado_aguardando_reagendamento: 'Reprovado — aguardando reagendamento',
  nao_compareceu_pendente_contato: 'Não compareceu — pendente contato',
  cancelado_suspenso: 'Cancelado / suspenso',
};

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
  faseJornada?: FaseJornada | 'todos';
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
  return !!s.profissional_id && (s as any).origem !== 'prestador_externo';
}

function isPrestador(s: Servico): boolean {
  return (s as any).vistoriador_prestador_id != null
    || (s as any).origem === 'prestador_externo';
}

/**
 * Calcula a fase da jornada do associado a partir do estado real
 * do serviço, documentos e rastreador.
 */
export function calcularFaseJornada(s: Servico): FaseJornada {
  const status = s.status;
  const docsStatus = (s as any).associado?.documentos_status as string | undefined;
  const rastreadorAtivado = (s as any).rastreador?.status_ativacao === 'ativo'
    || (s as any).rastreador_ativado;

  if (status === 'cancelada') return 'cancelado_suspenso';
  if (status === 'nao_compareceu') return 'nao_compareceu_pendente_contato';
  if (status === 'reagendada' || status === 'reprovada') {
    return 'reprovado_aguardando_reagendamento';
  }
  if (status === 'em_rota' || status === 'em_andamento') return 'em_rota_execucao';
  if (status === 'em_analise') return 'concluido_aguardando_analise';

  if (status === 'concluida' || status === 'aprovada' || status === 'aprovada_ressalvas') {
    // Regra 48h: se concluído mas rastreador não ativado, fica nesse estado
    if (!rastreadorAtivado && (s.tipo === 'instalacao' || s.tipo === 'revistoria')) {
      const concluidoEm = s.concluida_em ? parseISO(s.concluida_em) : null;
      if (concluidoEm && differenceInHours(new Date(), concluidoEm) <= 72) {
        return 'concluido_aguardando_ativacao';
      }
    }
    return 'concluido_aguardando_analise';
  }

  // Pendente / agendada — depende de documentos
  if (docsStatus === 'em_analise') return 'documentos_em_analise';
  if (docsStatus === 'pendente' || docsStatus === 'aguardando') {
    return 'aguardando_documentos';
  }

  if (status === 'agendada') return 'agendado_aguardando_data';
  if (status === 'pendente') return 'documentos_aprovados_sem_agendamento';

  return 'agendado_aguardando_data';
}

export function useServicosCampoUnificado(filters: ServicosCampoFilters = {}) {
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

  /**
   * Deduplica serviços por (associado_id + veiculo_id + tipo), mantendo apenas
   * o card "mais relevante" (vivo > terminal recente) e expondo as tentativas
   * anteriores em `tentativas_anteriores` (usado pelo badge "Nx reagendado").
   *
   * Veículos diferentes do mesmo associado continuam gerando cards separados.
   */
  const servicosDeduplicados = useMemo(() => {
    // Prioridade do status (menor = mais "vivo")
    const STATUS_PRIORITY: Record<string, number> = {
      em_andamento: 1,
      em_rota: 2,
      em_analise: 3,
      agendada: 4,
      pendente: 5,
      atribuida: 6,
      no_local: 7,
      aguardando_prestador: 8,
      reagendada: 20,
      nao_compareceu: 21,
      reprovada: 22,
      aprovada_ressalvas: 30,
      aprovada: 31,
      concluida: 32,
      cancelada: 50,
    };
    const priorityOf = (s: Servico) => STATUS_PRIORITY[s.status] ?? 99;

    // Agrupa
    const grupos = new Map<string, Servico[]>();
    for (const s of servicos) {
      // Sem associado_id ou veiculo_id, não há como deduplicar com segurança
      if (!s.associado_id || !s.veiculo_id || !s.tipo) {
        const k = `__loose_${s.id}`;
        grupos.set(k, [s]);
        continue;
      }
      const k = `${s.associado_id}|${s.veiculo_id}|${s.tipo}`;
      const arr = grupos.get(k);
      if (arr) arr.push(s);
      else grupos.set(k, [s]);
    }

    const out: Servico[] = [];
    for (const grupo of grupos.values()) {
      if (grupo.length === 1) {
        out.push(grupo[0]);
        continue;
      }
      // Ordena: 1) prioridade do status, 2) created_at desc
      const sorted = [...grupo].sort((a, b) => {
        const pa = priorityOf(a);
        const pb = priorityOf(b);
        if (pa !== pb) return pa - pb;
        const ca = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
        const cb = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
        return cb - ca;
      });
      const keeper = sorted[0];
      const tentativas = sorted.slice(1).map((s) => ({
        servico_id: s.id,
        data_anterior: s.data_agendada,
        periodo_anterior: s.periodo,
        status_anterior: s.status,
        created_at: (s as any).created_at,
      }));
      out.push({
        ...keeper,
        tentativas_anteriores: tentativas,
      } as Servico & { tentativas_anteriores: typeof tentativas });
    }
    return out;
  }, [servicos]);

  const servicosFiltrados = useMemo(() => {
    let result = servicosDeduplicados;

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

    if (filters.faseJornada && filters.faseJornada !== 'todos') {
      result = result.filter((srv) => calcularFaseJornada(srv) === filters.faseJornada);
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
  }, [servicosDeduplicados, filters]);

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
