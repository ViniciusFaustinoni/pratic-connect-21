import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, subMonths, startOfWeek, startOfYear, subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissions } from '@/hooks/usePermissions';
import type { Database } from '@/integrations/supabase/types';

type StatusSinistro = Database['public']['Enums']['status_sinistro'];
type TipoSinistro = Database['public']['Enums']['tipo_sinistro'];

export type PeriodoFiltro = 'hoje' | 'semana' | 'mes' | 'trimestre' | 'ano' | 'personalizado';
export type StatusFiltro = 'todos' | 'abertos' | 'finalizados';
export type TipoFiltro = 'todos' | 'colisao' | 'roubo' | 'furto' | 'incendio' | 'fenomeno_natural' | 'vidros';

export interface FiltrosGlobais {
  periodo: PeriodoFiltro;
  tipo: TipoFiltro;
  statusFiltro: StatusFiltro;
  dataInicio?: Date;
  dataFim?: Date;
}

const STATUS_FINALIZADOS = ['encerrado', 'cancelado', 'pago', 'negado'];
const STATUS_ABERTOS_EXCLUIR = ['encerrado', 'cancelado', 'pago', 'negado'];

function getDataRange(filtros: FiltrosGlobais): { from: string | null; to: string | null } {
  const agora = new Date();
  if (filtros.periodo === 'personalizado' && filtros.dataInicio) {
    return {
      from: filtros.dataInicio.toISOString(),
      to: filtros.dataFim?.toISOString() || agora.toISOString(),
    };
  }
  const map: Record<string, Date> = {
    hoje: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()),
    semana: startOfWeek(agora, { weekStartsOn: 1 }),
    mes: startOfMonth(agora),
    trimestre: subMonths(agora, 3),
    ano: startOfYear(agora),
  };
  return { from: map[filtros.periodo]?.toISOString() || null, to: null };
}

function applyBaseFilters(query: any, filtros: FiltrosGlobais) {
  const { from, to } = getDataRange(filtros);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  if (filtros.tipo !== 'todos') query = query.eq('tipo', filtros.tipo);
  if (filtros.statusFiltro === 'abertos') query = query.not('status', 'in', `(${STATUS_FINALIZADOS.join(',')})`);
  if (filtros.statusFiltro === 'finalizados') query = query.in('status', STATUS_FINALIZADOS);
  return query;
}

// =========== KPI Queries ===========

export function useKPIAbertos(filtros: FiltrosGlobais) {
  return useQuery({
    queryKey: ['eventos-kpi-abertos', filtros],
    queryFn: async () => {
      let q = supabase.from('sinistros').select('id', { count: 'exact', head: true })
        .not('status', 'in', `(${STATUS_ABERTOS_EXCLUIR.join(',')})`);
      if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);
      const { count } = await q;
      return count || 0;
    },
    refetchInterval: 120000,
  });
}

export function useKPINovosEsteMes(filtros: FiltrosGlobais) {
  return useQuery({
    queryKey: ['eventos-kpi-novos-mes', filtros],
    queryFn: async () => {
      const agora = new Date();
      const inicioMes = startOfMonth(agora);
      const inicioMesAnterior = startOfMonth(subMonths(agora, 1));

      let qAtual = supabase.from('sinistros').select('id', { count: 'exact', head: true })
        .gte('created_at', inicioMes.toISOString());
      let qAnterior = supabase.from('sinistros').select('id', { count: 'exact', head: true })
        .gte('created_at', inicioMesAnterior.toISOString())
        .lt('created_at', inicioMes.toISOString());

      if (filtros.tipo !== 'todos') {
        qAtual = qAtual.eq('tipo', filtros.tipo);
        qAnterior = qAnterior.eq('tipo', filtros.tipo);
      }

      const [atual, anterior] = await Promise.all([qAtual, qAnterior]);
      const countAtual = atual.count || 0;
      const countAnterior = anterior.count || 0;
      const variacao = countAnterior > 0 ? ((countAtual - countAnterior) / countAnterior) * 100 : 0;

      return { count: countAtual, variacao: Math.round(variacao) };
    },
    refetchInterval: 120000,
  });
}

export function useKPIAguardandoAcao(filtros: FiltrosGlobais) {
  const statusAguardando: StatusSinistro[] = [
    'documentacao_pendente', 'aguardando_analise', 'aguardando_vistoria',
    'pronto_para_oficina', 'aguardando_cota', 'aguardando_termo', 'aguardando_parecer'
  ];
  return useQuery({
    queryKey: ['eventos-kpi-aguardando', filtros],
    queryFn: async () => {
      let q = supabase.from('sinistros').select('id', { count: 'exact', head: true })
        .in('status', statusAguardando);
      if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);
      const { count } = await q;
      return count || 0;
    },
    refetchInterval: 120000,
  });
}

export function useKPIEmOficina(filtros: FiltrosGlobais) {
  return useQuery({
    queryKey: ['eventos-kpi-oficina', filtros],
    queryFn: async () => {
      let q = supabase.from('sinistros').select('id', { count: 'exact', head: true })
        .in('status', ['em_regulacao', 'em_reparo', 'aguardando_peca' as any]);
      if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);
      const { count } = await q;
      return count || 0;
    },
    refetchInterval: 120000,
  });
}

export function useKPIEmRecuperacao(filtros: FiltrosGlobais) {
  return useQuery({
    queryKey: ['eventos-kpi-recuperacao', filtros],
    queryFn: async () => {
      let q = supabase.from('sinistros').select('id', { count: 'exact', head: true })
        .eq('status', 'em_recuperacao');
      if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);
      const { count } = await q;
      return count || 0;
    },
    refetchInterval: 120000,
  });
}

export function useKPIIndenizacoesPendentes(filtros: FiltrosGlobais) {
  return useQuery({
    queryKey: ['eventos-kpi-indenizacoes', filtros],
    queryFn: async () => {
      // aguardando_pagamento doesn't exist in enum, use 'pago' flow items or indenizado
      let q = supabase.from('sinistros').select('id, valor_fipe')
        .in('status', ['indenizado'] as any[]);
      if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);
      // Also get items awaiting payment (aprovado with indenization pending)
      let q2 = supabase.from('sinistros').select('id, valor_fipe')
        .eq('status', 'aprovado')
        .not('valor_indenizacao', 'is', null);
      if (filtros.tipo !== 'todos') q2 = q2.eq('tipo', filtros.tipo);

      const [r1, r2] = await Promise.all([q, q2]);
      const items = [...(r1.data || []), ...(r2.data || [])];
      const total = items.length;
      const valorTotal = items.reduce((acc, s) => acc + (s.valor_fipe || 0), 0);
      return { count: total, valorTotal };
    },
    refetchInterval: 120000,
  });
}

// =========== Funil ===========

export interface FunilFase {
  nome: string;
  count: number;
  statuses: string[];
}

export function useFunilOperacional(filtros: FiltrosGlobais) {
  return useQuery({
    queryKey: ['eventos-funil', filtros],
    queryFn: async () => {
      let q = supabase.from('sinistros').select('status');
      if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);
      // Don't filter by period for funnel (shows current state)
      const { data } = await q;

      const statusCount: Record<string, number> = {};
      (data || []).forEach(s => {
        statusCount[s.status] = (statusCount[s.status] || 0) + 1;
      });

      const sum = (...keys: string[]) => keys.reduce((t, k) => t + (statusCount[k] || 0), 0);

      const fases: FunilFase[] = [
        { nome: 'Comunicado', count: sum('comunicado'), statuses: ['comunicado'] },
        { nome: 'Documentação', count: sum('documentacao_pendente'), statuses: ['documentacao_pendente'] },
        { nome: 'Vistoria', count: sum('aguardando_vistoria', 'em_vistoria'), statuses: ['aguardando_vistoria', 'em_vistoria'] },
        { nome: 'Análise', count: sum('em_analise', 'aguardando_parecer', 'aguardando_analise', 'analise_interna'), statuses: ['em_analise', 'aguardando_parecer', 'aguardando_analise', 'analise_interna'] },
        { nome: 'Pagamento/Cota', count: sum('aprovado', 'aguardando_cota', 'aguardando_termo'), statuses: ['aprovado', 'aguardando_cota', 'aguardando_termo'] },
        { nome: 'Atribuição', count: sum('pronto_para_oficina'), statuses: ['pronto_para_oficina'] },
        { nome: 'Em Oficina', count: sum('em_regulacao', 'em_reparo', 'aguardando_peca'), statuses: ['em_regulacao', 'em_reparo', 'aguardando_peca'] },
        { nome: 'Recuperação', count: sum('em_recuperacao'), statuses: ['em_recuperacao'] },
        { nome: 'Finalizado', count: sum('encerrado', 'pago', 'indenizado'), statuses: ['encerrado', 'pago', 'indenizado'] },
      ];

      return fases;
    },
    refetchInterval: 120000,
  });
}

// =========== Gráficos ===========

export function useEventosPorTipo(filtros: FiltrosGlobais) {
  return useQuery({
    queryKey: ['eventos-por-tipo', filtros],
    queryFn: async () => {
      let q = supabase.from('sinistros').select('tipo');
      q = applyBaseFilters(q, filtros);
      const { data } = await q;

      const contagem: Record<string, number> = {};
      (data || []).forEach(s => {
        contagem[s.tipo] = (contagem[s.tipo] || 0) + 1;
      });

      return contagem;
    },
    refetchInterval: 120000,
  });
}

export function useEventosPorMes(filtros: FiltrosGlobais) {
  return useQuery({
    queryKey: ['eventos-por-mes', filtros],
    queryFn: async () => {
      const desde = subMonths(new Date(), 6);
      let q = supabase.from('sinistros').select('tipo, created_at')
        .gte('created_at', desde.toISOString());
      if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);

      const { data } = await q;

      const meses: Record<string, Record<string, number>> = {};
      for (let i = 5; i >= 0; i--) {
        const mes = format(subMonths(new Date(), i), 'MMM/yy', { locale: ptBR });
        meses[mes] = {};
      }

      (data || []).forEach(s => {
        const mes = format(new Date(s.created_at), 'MMM/yy', { locale: ptBR });
        if (meses[mes]) {
          meses[mes][s.tipo] = (meses[mes][s.tipo] || 0) + 1;
        }
      });

      return Object.entries(meses).map(([mes, tipos]) => ({
        mes,
        colisao: tipos['colisao'] || 0,
        roubo: tipos['roubo'] || 0,
        furto: tipos['furto'] || 0,
        incendio: tipos['incendio'] || 0,
        fenomeno_natural: tipos['fenomeno_natural'] || 0,
        vidros: tipos['vidros'] || 0,
      }));
    },
    refetchInterval: 120000,
  });
}

// =========== Análise ===========

export function useTaxaAprovacao(filtros: FiltrosGlobais) {
  return useQuery({
    queryKey: ['eventos-taxa-aprovacao', filtros],
    queryFn: async () => {
      const inicioMes = startOfMonth(new Date());
      let q = supabase.from('sinistros').select('status, data_parecer')
        .not('data_parecer', 'is', null)
        .gte('data_parecer', inicioMes.toISOString());
      if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);

      const { data } = await q;
      const items = data || [];
      const aprovados = items.filter(s => ['aprovado', 'pago', 'em_regulacao', 'em_reparo', 'encerrado', 'indenizado', 'pronto_para_oficina', 'aguardando_cota', 'aguardando_termo'].includes(s.status)).length;
      const reprovados = items.filter(s => ['negado', 'reprovado'].includes(s.status)).length;
      const sindicancia = items.filter(s => s.status === 'em_sindicancia').length;
      const total = aprovados + reprovados + sindicancia;
      const taxa = total > 0 ? (aprovados / total) * 100 : 0;

      return { taxa: Math.round(taxa), aprovados, reprovados, sindicancia };
    },
    refetchInterval: 120000,
  });
}

export function useTempoMedioPorFase(filtros: FiltrosGlobais) {
  return useQuery({
    queryKey: ['eventos-tempo-fase', filtros],
    queryFn: async () => {
      // Simplified: use created_at, data_parecer, updated_at
      let q = supabase.from('sinistros').select('created_at, data_parecer, updated_at, status')
        .not('status', 'in', `(comunicado,cancelado)`);
      if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);
      const { data } = await q;

      // Calculate average time from created_at to data_parecer (analysis time)
      const comParecer = (data || []).filter(s => s.data_parecer);
      const avgAnalise = comParecer.length > 0
        ? comParecer.reduce((acc, s) => {
            const dias = Math.max(0, (new Date(s.data_parecer!).getTime() - new Date(s.created_at).getTime()) / 86400000);
            return acc + dias;
          }, 0) / comParecer.length
        : 0;

      // For other phases, estimate from overall
      const finalizados = (data || []).filter(s => ['encerrado', 'pago', 'indenizado'].includes(s.status));
      const avgTotal = finalizados.length > 0
        ? finalizados.reduce((acc, s) => {
            const dias = Math.max(0, (new Date(s.updated_at).getTime() - new Date(s.created_at).getTime()) / 86400000);
            return acc + dias;
          }, 0) / finalizados.length
        : 0;

      return [
        { fase: 'Comunicação → Docs', dias: Math.round(avgAnalise * 0.15), meta: 3 },
        { fase: 'Docs → Vistoria', dias: Math.round(avgAnalise * 0.2), meta: 5 },
        { fase: 'Vistoria → Análise', dias: Math.round(avgAnalise * 0.15), meta: 5 },
        { fase: 'Análise → Aprovação', dias: Math.round(avgAnalise), meta: 7 },
        { fase: 'Aprovação → Oficina', dias: Math.round((avgTotal - avgAnalise) * 0.2), meta: 5 },
        { fase: 'Oficina → Conclusão', dias: Math.round((avgTotal - avgAnalise) * 0.6), meta: 30 },
      ];
    },
    refetchInterval: 120000,
  });
}

export function useCustosAcumulados(filtros: FiltrosGlobais) {
  return useQuery({
    queryKey: ['eventos-custos', filtros],
    queryFn: async () => {
      const desde = subMonths(new Date(), 6);
      let q = supabase.from('sinistros').select('created_at, valor_orcamento, valor_pago, valor_cota_participacao')
        .gte('created_at', desde.toISOString());
      if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);

      const { data } = await q;

      const meses: Record<string, { orcamento: number; pago: number; cotas: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const mes = format(subMonths(new Date(), i), 'MMM/yy', { locale: ptBR });
        meses[mes] = { orcamento: 0, pago: 0, cotas: 0 };
      }

      (data || []).forEach(s => {
        const mes = format(new Date(s.created_at), 'MMM/yy', { locale: ptBR });
        if (meses[mes]) {
          meses[mes].orcamento += s.valor_orcamento || 0;
          meses[mes].pago += s.valor_pago || 0;
          meses[mes].cotas += s.valor_cota_participacao || 0;
        }
      });

      return Object.entries(meses).map(([mes, vals]) => ({
        mes,
        ...vals,
      }));
    },
    refetchInterval: 120000,
  });
}

// =========== Alertas ===========

export function useAlertasUrgentes() {
  return useQuery({
    queryKey: ['eventos-alertas'],
    queryFn: async () => {
      const agora = new Date();
      const h48 = subDays(agora, 2).toISOString();
      const d15 = subDays(agora, 15).toISOString();
      const d60 = subDays(agora, 60).toISOString();
      const d50 = subDays(agora, 50).toISOString();
      const d7 = subDays(agora, 7).toISOString();
      const d20 = subDays(agora, 20).toISOString();
      const inicioMes = startOfMonth(agora).toISOString();
      const d7Futuro = new Date(agora.getTime() + 7 * 86400000).toISOString();
      const agoraISO = agora.toISOString();

      const [
        semAtualizacao, docPendente, oficina60, indenizPrazo,
        analise7, recuperacao20, garantias,
        finalizadosMes, cotasPendentes,
        sindicanciaVencendo, sindicanciaVencida
      ] = await Promise.all([
        // Vermelhos
        supabase.from('sinistros').select('id', { count: 'exact', head: true })
          .lt('updated_at', h48).not('status', 'in', '(encerrado,cancelado,pago,negado)'),
        supabase.from('sinistros').select('id', { count: 'exact', head: true })
          .eq('status', 'documentacao_pendente').lt('updated_at', d15),
        supabase.from('sinistros').select('id', { count: 'exact', head: true })
          .in('status', ['em_reparo', 'em_regulacao']).lt('updated_at', d60),
        supabase.from('sinistros').select('id', { count: 'exact', head: true })
          .eq('status', 'aprovado').lt('created_at', d50).not('valor_indenizacao', 'is', null),
        // Amarelos
        supabase.from('sinistros').select('id', { count: 'exact', head: true })
          .in('status', ['em_analise', 'aguardando_parecer', 'aguardando_analise']).lt('updated_at', d7),
        supabase.from('sinistros').select('id', { count: 'exact', head: true })
          .eq('status', 'em_recuperacao').lt('updated_at', d20),
        supabase.from('sinistros').select('id', { count: 'exact', head: true })
          .not('data_garantia_fim', 'is', null).gte('data_garantia_fim', agoraISO).lte('data_garantia_fim', d7Futuro),
        // Azuis
        supabase.from('sinistros').select('id', { count: 'exact', head: true })
          .in('status', ['encerrado', 'pago', 'indenizado'] as any[]).gte('updated_at', inicioMes),
        supabase.from('sinistros').select('id', { count: 'exact', head: true })
          .eq('cota_paga', false).not('status', 'in', '(cancelado,negado)'),
        // Sindicância
        supabase.from('sinistros').select('id', { count: 'exact', head: true })
          .eq('status', 'em_sindicancia').gte('sindicancia_prazo_fim', agoraISO).lte('sindicancia_prazo_fim', d7Futuro),
        supabase.from('sinistros').select('id', { count: 'exact', head: true })
          .eq('status', 'em_sindicancia').lt('sindicancia_prazo_fim', agoraISO),
      ]);

      return {
        vermelhos: [
          { key: 'sem_atualizacao', count: semAtualizacao.count || 0, msg: 'eventos sem atualização há mais de 48h', acao: '/eventos/sinistros' },
          { key: 'doc_pendente', count: docPendente.count || 0, msg: 'eventos com documentação pendente há mais de 15 dias', acao: '/eventos/sinistros' },
          { key: 'oficina_60', count: oficina60.count || 0, msg: 'veículos em oficina há mais de 60 dias', acao: '/eventos/sinistros' },
          { key: 'indeniz_prazo', count: indenizPrazo.count || 0, msg: 'indenizações com prazo vencendo', acao: '/eventos/sinistros' },
          { key: 'sindicancia_vencida', count: sindicanciaVencida.count || 0, msg: 'sindicâncias com prazo vencido', acao: '/eventos/sinistros' },
        ].filter(a => a.count > 0),
        amarelos: [
          { key: 'analise_7', count: analise7.count || 0, msg: 'eventos aguardando análise há mais de 7 dias', acao: '/eventos/sinistros' },
          { key: 'recuperacao_20', count: recuperacao20.count || 0, msg: 'veículos em recuperação há mais de 20 dias', acao: '/eventos/sinistros' },
          { key: 'garantias', count: garantias.count || 0, msg: 'garantias vencendo nos próximos 7 dias', acao: '/eventos/sinistros' },
          { key: 'sindicancia_vencendo', count: sindicanciaVencendo.count || 0, msg: 'sindicâncias com prazo vencendo nos próximos 7 dias', acao: '/eventos/sinistros' },
        ].filter(a => a.count > 0),
        azuis: [
          { key: 'finalizados_mes', count: finalizadosMes.count || 0, msg: 'eventos finalizados este mês' },
          { key: 'cotas_pendentes', count: cotasPendentes.count || 0, msg: 'associados com cota pendente', acao: '/eventos/sinistros' },
        ],
      };
    },
    refetchInterval: 120000,
  });
}

// =========== Tabela Recentes ===========

export function useEventosRecentes(filtros: FiltrosGlobais, faseFilter?: string[]) {
  return useQuery({
    queryKey: ['eventos-recentes', filtros, faseFilter],
    queryFn: async () => {
      let q = supabase.from('sinistros').select(`
        id, protocolo, tipo, status, created_at, updated_at, valor_fipe,
        associado:associados!sinistros_associado_id_fkey(nome),
        veiculo:veiculos!sinistros_veiculo_id_fkey(placa, marca, modelo)
      `)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (faseFilter && faseFilter.length > 0) {
        q = q.in('status', faseFilter as any);
      }
      if (filtros.tipo !== 'todos') q = q.eq('tipo', filtros.tipo);
      if (filtros.statusFiltro === 'abertos') q = q.not('status', 'in', `(${STATUS_FINALIZADOS.join(',')})`);
      if (filtros.statusFiltro === 'finalizados') q = q.in('status', STATUS_FINALIZADOS as any);

      const { data } = await q;
      return data || [];
    },
    refetchInterval: 120000,
  });
}
