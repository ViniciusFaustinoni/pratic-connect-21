import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, subMonths, startOfDay, subDays, startOfYear, format, differenceInDays, endOfMonth, getDaysInMonth, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type Periodo = 'hoje' | '7dias' | '30dias' | 'ano';

// Etapas oficiais do funil conforme PRD
export const ETAPAS_FUNIL_CONFIG = [
  { id: 'novo', label: 'Novo', cor: '#3B82F6', ordem: 1 },
  { id: 'contato', label: 'Contato', cor: '#EAB308', ordem: 2 },
  { id: 'qualificado', label: 'Qualificado', cor: '#A855F7', ordem: 3 },
  { id: 'cotacao_enviada', label: 'Cotação Enviada', cor: '#F97316', ordem: 4 },
  { id: 'negociacao', label: 'Negociação', cor: '#EC4899', ordem: 5 },
  { id: 'vistoria_agendada', label: 'Vistoria', cor: '#06B6D4', ordem: 6 },
  { id: 'contrato_enviado', label: 'Contrato Enviado', cor: '#6366F1', ordem: 7 },
  { id: 'contrato_assinado', label: 'Assinado', cor: '#14B8A6', ordem: 8 },
  { id: 'instalacao_agendada', label: 'Instalação', cor: '#10B981', ordem: 9 },
  { id: 'ganho', label: 'Ganho', cor: '#22C55E', ordem: 10 },
] as const;

export const ORIGEM_CORES: Record<string, string> = {
  indicacao: '#A855F7',
  site: '#3B82F6',
  telefone: '#F97316',
  whatsapp: '#22C55E',
  instagram: '#E4405F',
  facebook: '#1877F2',
  google: '#EA4335',
  presencial: '#6B7280',
  parceiro: '#06B6D4',
  outro: '#9CA3AF',
};

export const MOTIVOS_PERDA_CONFIG = [
  { id: 'preco', label: 'Preço alto', cor: '#EF4444' },
  { id: 'concorrencia', label: 'Concorrência', cor: '#F97316' },
  { id: 'nao_respondeu', label: 'Sem retorno', cor: '#6B7280' },
  { id: 'desistiu', label: 'Desistiu', cor: '#8B5CF6' },
  { id: 'veiculo_reprovado', label: 'Veículo não aceito', cor: '#EC4899' },
  { id: 'nao_qualificado', label: 'Não qualificado', cor: '#06B6D4' },
  { id: 'outro', label: 'Outros', cor: '#9CA3AF' },
];

export interface LeadRisco {
  id: string;
  nome: string;
  etapa: string;
  diasSemContato: number;
  valorFipe?: number;
  vendedor: string;
  vendedorId: string;
}

export interface VendedorRanking {
  id: string;
  nome: string;
  avatar_url?: string | null;
  leads: number;
  cotacoes: number;
  contratos: number;
  conversao: number;
  ticketMedio: number;
  metaContratos: number;
  metaLeads: number;
  valor: number;
}

export interface ContratoPendente {
  id: string;
  cliente: string;
  valor: number;
  diasPendente: number;
  vendedor: string;
}

export interface VendasMetricasExpanded {
  // KPIs principais
  leads: number;
  cotacoes: number;
  contratos: number;
  conversao: number;
  ticketMedio: number;
  receitaPrevista: number;
  
  // Variação vs período anterior
  leadsVariacao: number;
  cotacoesVariacao: number;
  contratosVariacao: number;
  conversaoVariacao: number;
  ticketVariacao: number;
  
  // Metas
  metas: {
    leadsMetaMes: number;
    cotacoesMetaMes: number;
    contratosMetaMes: number;
    diasRestantes: number;
    diaAtual: number;
    totalDias: number;
  };
  
  // Funil (10 etapas)
  funilData: {
    etapa: string;
    etapaId: string;
    quantidade: number;
    percentual: number;
    cor: string;
  }[];
  
  // Leads em risco
  leadsEmRisco: {
    quentes: LeadRisco[];
    mornos: LeadRisco[];
    frios: LeadRisco[];
  };
  
  // Perdidos
  perdidos: {
    total: number;
    porMotivo: {
      motivo: string;
      quantidade: number;
      percentual: number;
      cor: string;
    }[];
  };
  
  // Contratos pendentes
  contratosPendentes: ContratoPendente[];
  
  // Performance por dia da semana
  performanceSemana: {
    dia: string;
    leads: number;
    contratos: number;
  }[];
  
  // Evolução mensal
  evolucaoData: {
    mes: string;
    leads: number;
    cotacoes: number;
    contratos: number;
    meta: number;
  }[];
  
  // Origens
  origensData: {
    nome: string;
    valor: number;
    cor: string;
    percentual: number;
  }[];
  
  // Ranking vendedores
  rankingVendedores: VendedorRanking[];
  
  // Alertas
  alertas: {
    tipo: 'urgente' | 'atencao' | 'info';
    mensagem: string;
    acao: string;
  }[];
}

function calcularPeriodo(periodo: Periodo): { inicio: Date; fim: Date } {
  const agora = new Date();
  const fim = agora;

  switch (periodo) {
    case 'hoje':
      return { inicio: startOfDay(agora), fim };
    case '7dias':
      return { inicio: startOfDay(subDays(agora, 7)), fim };
    case '30dias':
      return { inicio: startOfMonth(agora), fim };
    case 'ano':
      return { inicio: startOfYear(agora), fim };
    default:
      return { inicio: startOfMonth(agora), fim };
  }
}

function calcularPeriodoAnterior(periodo: Periodo): { inicio: Date; fim: Date } {
  const agora = new Date();

  switch (periodo) {
    case 'hoje':
      const ontem = subDays(agora, 1);
      return { inicio: startOfDay(ontem), fim: ontem };
    case '7dias':
      return { inicio: startOfDay(subDays(agora, 14)), fim: startOfDay(subDays(agora, 7)) };
    case '30dias':
      const mesAnterior = subMonths(agora, 1);
      return { inicio: startOfMonth(mesAnterior), fim: endOfMonth(mesAnterior) };
    case 'ano':
      const anoAnterior = new Date(agora.getFullYear() - 1, 0, 1);
      return { inicio: anoAnterior, fim: new Date(agora.getFullYear() - 1, 11, 31) };
    default:
      const mesAnt = subMonths(agora, 1);
      return { inicio: startOfMonth(mesAnt), fim: endOfMonth(mesAnt) };
  }
}

export function useVendasMetricasExpanded(periodo: Periodo = '30dias') {
  return useQuery({
    queryKey: ['vendas-metricas-expanded', periodo],
    queryFn: async (): Promise<VendasMetricasExpanded> => {
      const { inicio, fim } = calcularPeriodo(periodo);
      const { inicio: inicioAnterior, fim: fimAnterior } = calcularPeriodoAnterior(periodo);
      const agora = new Date();

      // Buscar todos os dados em paralelo
      const [
        leadsResult,
        leadsAnteriorResult,
        cotacoesResult,
        cotacoesAnteriorResult,
        contratosResult,
        contratosAnteriorResult,
        contratosPendentesResult,
        vendedoresResult,
        metasResult,
        leadsRiscoResult,
        leadsPerdidosResult,
      ] = await Promise.all([
        // Leads do período atual
        supabase
          .from('leads')
          .select('id, nome, etapa, origem, vendedor_id, created_at, data_ultimo_contato, motivo_perda, veiculo_fipe')
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
        // Leads do período anterior
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', inicioAnterior.toISOString())
          .lte('created_at', fimAnterior.toISOString()),
        // Cotações do período atual
        supabase
          .from('cotacoes')
          .select('id, status, lead_id, vendedor_id, created_at')
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
        // Cotações do período anterior
        supabase
          .from('cotacoes')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', inicioAnterior.toISOString())
          .lte('created_at', fimAnterior.toISOString()),
        // Contratos assinados do período atual
        supabase
          .from('contratos')
          .select('id, status, valor_mensal, vendedor_id, lead_id, created_at')
          .in('status', ['assinado', 'ativo'])
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
        // Contratos do período anterior
        supabase
          .from('contratos')
          .select('id, valor_mensal')
          .in('status', ['assinado', 'ativo'])
          .gte('created_at', inicioAnterior.toISOString())
          .lte('created_at', fimAnterior.toISOString()),
        // Contratos pendentes (enviados mas não assinados)
        supabase
          .from('contratos')
          .select('id, valor_mensal, vendedor_id, created_at, lead:leads(nome)')
          .eq('status', 'pendente')
          .order('created_at', { ascending: false })
          .limit(10),
        // Vendedores (profiles de funcionários)
        supabase
          .from('profiles')
          .select('id, nome, avatar_url')
          .eq('tipo', 'funcionario'),
        // Metas do mês atual
        supabase
          .from('metas_vendas')
          .select('*')
          .eq('mes', agora.getMonth() + 1)
          .eq('ano', agora.getFullYear()),
        // Leads em risco (sem contato recente, não finalizados)
        supabase
          .from('leads')
          .select('id, nome, etapa, vendedor_id, data_ultimo_contato, veiculo_fipe')
          .not('etapa', 'in', '("ganho","perdido")')
          .not('data_ultimo_contato', 'is', null)
          .lt('data_ultimo_contato', subDays(agora, 1).toISOString())
          .order('data_ultimo_contato', { ascending: true })
          .limit(30),
        // Leads perdidos do período
        supabase
          .from('leads')
          .select('id, motivo_perda')
          .eq('etapa', 'perdido')
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
      ]);

      const leads = leadsResult.data || [];
      const leadsAnterior = leadsAnteriorResult.count || 0;
      const cotacoes = cotacoesResult.data || [];
      const cotacoesAnterior = cotacoesAnteriorResult.count || 0;
      const contratos = contratosResult.data || [];
      const contratosAnterior = contratosAnteriorResult.data || [];
      const contratosPendentesData = contratosPendentesResult.data || [];
      const vendedores = vendedoresResult.data || [];
      const metas = metasResult.data || [];
      const leadsRisco = leadsRiscoResult.data || [];
      const leadsPerdidos = leadsPerdidosResult.data || [];

      // === KPIs PRINCIPAIS ===
      const totalLeads = leads.length;
      const totalCotacoes = cotacoes.length;
      const totalContratos = contratos.length;
      const conversao = totalLeads > 0 ? (totalContratos / totalLeads) * 100 : 0;
      
      const valorTotalContratos = contratos.reduce((sum, c) => sum + (Number(c.valor_mensal) || 0), 0);
      const ticketMedio = totalContratos > 0 ? valorTotalContratos / totalContratos : 0;
      const receitaPrevista = valorTotalContratos;

      // === VARIAÇÕES ===
      const conversaoAnterior = leadsAnterior > 0 ? (contratosAnterior.length / leadsAnterior) * 100 : 0;
      const ticketAnterior = contratosAnterior.length > 0
        ? contratosAnterior.reduce((sum, c) => sum + (Number(c.valor_mensal) || 0), 0) / contratosAnterior.length
        : 0;

      const calcVariacao = (atual: number, anterior: number): number => {
        if (anterior === 0) return atual > 0 ? 100 : 0;
        return ((atual - anterior) / anterior) * 100;
      };

      const leadsVariacao = calcVariacao(totalLeads, leadsAnterior);
      const cotacoesVariacao = calcVariacao(totalCotacoes, cotacoesAnterior);
      const contratosVariacao = calcVariacao(totalContratos, contratosAnterior.length);
      const conversaoVariacao = conversao - conversaoAnterior;
      const ticketVariacao = calcVariacao(ticketMedio, ticketAnterior);

      // === METAS ===
      const diasDoMes = getDaysInMonth(agora);
      const diaAtual = agora.getDate();
      const diasRestantes = diasDoMes - diaAtual;
      
      const metasAgregadas = metas.reduce(
        (acc, m) => ({
          leadsMetaMes: acc.leadsMetaMes + (m.meta_leads || 0),
          cotacoesMetaMes: acc.cotacoesMetaMes + (m.meta_cotacoes || 0),
          contratosMetaMes: acc.contratosMetaMes + (m.meta_contratos || 0),
        }),
        { leadsMetaMes: 0, cotacoesMetaMes: 0, contratosMetaMes: 0 }
      );

      // === FUNIL DE VENDAS (10 etapas) ===
      const etapaCount: Record<string, number> = {};
      leads.filter(l => l.etapa !== 'perdido').forEach(lead => {
        etapaCount[lead.etapa] = (etapaCount[lead.etapa] || 0) + 1;
      });

      const totalFunil = Object.values(etapaCount).reduce((a, b) => a + b, 0);
      const funilData = ETAPAS_FUNIL_CONFIG.map(etapa => ({
        etapa: etapa.label,
        etapaId: etapa.id,
        quantidade: etapaCount[etapa.id] || 0,
        percentual: totalFunil > 0 ? ((etapaCount[etapa.id] || 0) / totalFunil) * 100 : 0,
        cor: etapa.cor,
      })).filter(e => e.quantidade > 0);

      // === LEADS EM RISCO ===
      const vendedorMap = new Map(vendedores.map(v => [v.id, v.nome]));
      
      const classificarRisco = (lead: typeof leadsRisco[0]): LeadRisco | null => {
        if (!lead.data_ultimo_contato) return null;
        const dias = differenceInDays(agora, new Date(lead.data_ultimo_contato));
        if (dias < 1) return null;
        
        return {
          id: lead.id,
          nome: lead.nome || 'Sem nome',
          etapa: ETAPAS_FUNIL_CONFIG.find(e => e.id === lead.etapa)?.label || lead.etapa,
          diasSemContato: dias,
          valorFipe: lead.veiculo_fipe ? Number(lead.veiculo_fipe) : undefined,
          vendedor: vendedorMap.get(lead.vendedor_id || '') || 'Não atribuído',
          vendedorId: lead.vendedor_id || '',
        };
      };

      const leadsClassificados = leadsRisco.map(classificarRisco).filter(Boolean) as LeadRisco[];
      
      const leadsEmRisco = {
        quentes: leadsClassificados.filter(l => l.diasSemContato >= 1 && l.diasSemContato <= 2),
        mornos: leadsClassificados.filter(l => l.diasSemContato >= 3 && l.diasSemContato <= 5),
        frios: leadsClassificados.filter(l => l.diasSemContato >= 6),
      };

      // === LEADS PERDIDOS ===
      const motivoCount: Record<string, number> = {};
      leadsPerdidos.forEach(lead => {
        const motivo = lead.motivo_perda || 'outro';
        motivoCount[motivo] = (motivoCount[motivo] || 0) + 1;
      });

      const totalPerdidos = leadsPerdidos.length;
      const perdidosPorMotivo = Object.entries(motivoCount)
        .map(([motivo, quantidade]) => {
          const config = MOTIVOS_PERDA_CONFIG.find(m => m.id === motivo);
          return {
            motivo: config?.label || motivo,
            quantidade,
            percentual: totalPerdidos > 0 ? (quantidade / totalPerdidos) * 100 : 0,
            cor: config?.cor || '#9CA3AF',
          };
        })
        .sort((a, b) => b.quantidade - a.quantidade);

      // === CONTRATOS PENDENTES ===
      const contratosPendentes: ContratoPendente[] = contratosPendentesData.map(c => ({
        id: c.id,
        cliente: (c.lead as any)?.nome || 'Cliente',
        valor: Number(c.valor_mensal) || 0,
        diasPendente: differenceInDays(agora, new Date(c.created_at)),
        vendedor: vendedorMap.get(c.vendedor_id || '') || 'Não atribuído',
      }));

      // === PERFORMANCE POR DIA DA SEMANA ===
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const performancePorDia: Record<number, { leads: number; contratos: number }> = {};
      
      for (let i = 0; i < 7; i++) {
        performancePorDia[i] = { leads: 0, contratos: 0 };
      }

      leads.forEach(lead => {
        const diaSemana = getDay(new Date(lead.created_at));
        performancePorDia[diaSemana].leads++;
      });

      contratos.forEach(contrato => {
        const diaSemana = getDay(new Date(contrato.created_at));
        performancePorDia[diaSemana].contratos++;
      });

      const performanceSemana = [1, 2, 3, 4, 5, 6, 0].map(i => ({
        dia: diasSemana[i],
        leads: performancePorDia[i].leads,
        contratos: performancePorDia[i].contratos,
      }));

      // === EVOLUÇÃO MENSAL (6 meses) ===
      const evolucaoData: VendasMetricasExpanded['evolucaoData'] = [];
      
      for (let i = 5; i >= 0; i--) {
        const mesData = subMonths(agora, i);
        const mesInicio = startOfMonth(mesData);
        const mesFim = i === 0 ? agora : endOfMonth(mesData);

        const leadsDoMes = leads.filter(l => {
          const d = new Date(l.created_at);
          return d >= mesInicio && d <= mesFim;
        }).length;

        const cotacoesDoMes = cotacoes.filter(c => {
          const d = new Date(c.created_at);
          return d >= mesInicio && d <= mesFim;
        }).length;

        const contratosDoMes = contratos.filter(c => {
          const d = new Date(c.created_at);
          return d >= mesInicio && d <= mesFim;
        }).length;

        const metaDoMes = metas.find(
          m => m.mes === mesData.getMonth() + 1 && m.ano === mesData.getFullYear()
        );

        evolucaoData.push({
          mes: format(mesData, 'MMM', { locale: ptBR }),
          leads: leadsDoMes,
          cotacoes: cotacoesDoMes,
          contratos: contratosDoMes,
          meta: metaDoMes?.meta_contratos || 0,
        });
      }

      // === ORIGENS ===
      const origemCount: Record<string, number> = {};
      leads.forEach(lead => {
        const origem = lead.origem || 'outro';
        origemCount[origem] = (origemCount[origem] || 0) + 1;
      });

      const origensData = Object.entries(origemCount)
        .map(([origem, valor]) => ({
          nome: origem.charAt(0).toUpperCase() + origem.slice(1).replace('_', ' '),
          valor,
          cor: ORIGEM_CORES[origem] || '#6B7280',
          percentual: totalLeads > 0 ? (valor / totalLeads) * 100 : 0,
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 6);

      // === RANKING VENDEDORES ===
      const vendedorStats: Record<string, { 
        leads: number; 
        cotacoes: number; 
        contratos: number; 
        valor: number;
        metaContratos: number;
        metaLeads: number;
      }> = {};

      vendedores.forEach(v => {
        const meta = metas.find(m => m.vendedor_id === v.id);
        vendedorStats[v.id] = { 
          leads: 0, 
          cotacoes: 0, 
          contratos: 0, 
          valor: 0,
          metaContratos: meta?.meta_contratos || 10,
          metaLeads: meta?.meta_leads || 30,
        };
      });

      leads.forEach(lead => {
        if (lead.vendedor_id && vendedorStats[lead.vendedor_id]) {
          vendedorStats[lead.vendedor_id].leads++;
        }
      });

      cotacoes.forEach(cotacao => {
        if (cotacao.vendedor_id && vendedorStats[cotacao.vendedor_id]) {
          vendedorStats[cotacao.vendedor_id].cotacoes++;
        }
      });

      contratos.forEach(contrato => {
        if (contrato.vendedor_id && vendedorStats[contrato.vendedor_id]) {
          vendedorStats[contrato.vendedor_id].contratos++;
          vendedorStats[contrato.vendedor_id].valor += Number(contrato.valor_mensal) || 0;
        }
      });

      const rankingVendedores: VendedorRanking[] = vendedores
        .map(v => {
          const stats = vendedorStats[v.id] || { leads: 0, cotacoes: 0, contratos: 0, valor: 0, metaContratos: 10, metaLeads: 30 };
          return {
            id: v.id,
            nome: v.nome || 'Desconhecido',
            avatar_url: v.avatar_url,
            leads: stats.leads,
            cotacoes: stats.cotacoes,
            contratos: stats.contratos,
            conversao: stats.leads > 0 ? (stats.contratos / stats.leads) * 100 : 0,
            ticketMedio: stats.contratos > 0 ? stats.valor / stats.contratos : 0,
            metaContratos: stats.metaContratos,
            metaLeads: stats.metaLeads,
            valor: stats.valor,
          };
        })
        .filter(v => v.leads > 0 || v.contratos > 0)
        .sort((a, b) => b.contratos - a.contratos)
        .slice(0, 8);

      // === ALERTAS ===
      const alertas: VendasMetricasExpanded['alertas'] = [];

      if (leadsEmRisco.mornos.length + leadsEmRisco.frios.length > 0) {
        alertas.push({
          tipo: 'urgente',
          mensagem: `${leadsEmRisco.mornos.length + leadsEmRisco.frios.length} leads sem contato há mais de 3 dias`,
          acao: '/vendas/leads?risco=true',
        });
      }

      if (contratosPendentes.filter(c => c.diasPendente >= 3).length > 0) {
        alertas.push({
          tipo: 'atencao',
          mensagem: `${contratosPendentes.filter(c => c.diasPendente >= 3).length} contratos aguardando assinatura há mais de 3 dias`,
          acao: '/vendas/contratos?status=pendente',
        });
      }

      const leadsNovos = leads.filter(l => l.etapa === 'novo').length;
      if (leadsNovos > 10) {
        alertas.push({
          tipo: 'info',
          mensagem: `${leadsNovos} leads novos aguardando primeiro contato`,
          acao: '/vendas/leads?etapa=novo',
        });
      }

      return {
        leads: totalLeads,
        cotacoes: totalCotacoes,
        contratos: totalContratos,
        conversao,
        ticketMedio,
        receitaPrevista,
        leadsVariacao,
        cotacoesVariacao,
        contratosVariacao,
        conversaoVariacao,
        ticketVariacao,
        metas: {
          ...metasAgregadas,
          diasRestantes,
          diaAtual,
          totalDias: diasDoMes,
        },
        funilData,
        leadsEmRisco,
        perdidos: {
          total: totalPerdidos,
          porMotivo: perdidosPorMotivo,
        },
        contratosPendentes,
        performanceSemana,
        evolucaoData,
        origensData,
        rankingVendedores,
        alertas,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}
