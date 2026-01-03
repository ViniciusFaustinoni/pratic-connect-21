import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, subMonths, startOfDay, subDays, startOfYear, format } from 'date-fns';

export type Periodo = 'hoje' | '7dias' | '30dias' | 'ano';

interface VendasMetricas {
  leads: number;
  cotacoes: number;
  contratos: number;
  conversao: number;
  funilData: { etapa: string; quantidade: number; cor: string }[];
  origensData: { nome: string; valor: number; cor: string }[];
  evolucaoData: { mes: string; leads: number; contratos: number }[];
  rankingVendedores: { id: string; nome: string; contratos: number; valor: number }[];
}

export const ETAPA_CORES: Record<string, string> = {
  novo: '#3b82f6',
  contato_inicial: '#8b5cf6',
  contato: '#8b5cf6',
  qualificado: '#06b6d4',
  apresentacao: '#14b8a6',
  cotacao_enviada: '#f59e0b',
  negociacao: '#ec4899',
  vistoria_agendada: '#f97316',
  contrato_enviado: '#a855f7',
  contrato_assinado: '#22c55e',
  instalacao_agendada: '#10b981',
  ganho: '#22c55e',
  perdido: '#ef4444',
};

export const ORIGEM_CORES: Record<string, string> = {
  indicacao: '#3b82f6',
  site: '#22c55e',
  telefone: '#f59e0b',
  instagram: '#ec4899',
  facebook: '#1877f2',
  google: '#ea4335',
  presencial: '#8b5cf6',
  parceiro: '#06b6d4',
  api: '#6366f1',
  outro: '#6b7280',
};

export const ORIGEM_LABELS: Record<string, string> = {
  indicacao: 'Indicação',
  site: 'Site',
  telefone: 'Telefone',
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Google',
  presencial: 'Presencial',
  parceiro: 'Parceiro',
  api: 'API',
  outro: 'Outros',
};

export const ETAPA_LABELS: Record<string, string> = {
  novo: 'Novos',
  contato_inicial: 'Contato Inicial',
  contato: 'Contato',
  qualificado: 'Qualificado',
  apresentacao: 'Apresentação',
  cotacao_enviada: 'Cotação Enviada',
  negociacao: 'Negociação',
  vistoria_agendada: 'Vistoria',
  contrato_enviado: 'Contrato Enviado',
  contrato_assinado: 'Assinado',
  instalacao_agendada: 'Instalação',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

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

export function useVendasMetricas(periodo: Periodo = '30dias') {
  return useQuery({
    queryKey: ['vendas-metricas', periodo],
    queryFn: async (): Promise<VendasMetricas> => {
      const { inicio, fim } = calcularPeriodo(periodo);

      // Buscar dados em paralelo
      const [leadsResult, cotacoesResult, contratosResult, vendedoresResult] = await Promise.all([
        supabase
          .from('leads')
          .select('id, etapa, origem, vendedor_id, created_at')
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
        supabase
          .from('cotacoes')
          .select('id, status, created_at')
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
        supabase
          .from('contratos')
          .select('id, status, valor_mensal, vendedor_id, created_at')
          .eq('status', 'assinado')
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
        supabase
          .from('profiles')
          .select('id, nome')
          .eq('tipo', 'funcionario'),
      ]);

      const leads = leadsResult.data || [];
      const cotacoes = cotacoesResult.data || [];
      const contratos = contratosResult.data || [];
      const vendedores = vendedoresResult.data || [];

      // Calcular métricas básicas
      const totalLeads = leads.length;
      const totalCotacoes = cotacoes.length;
      const totalContratos = contratos.length;
      const conversao = totalLeads > 0 ? (totalContratos / totalLeads) * 100 : 0;

      // Agrupar leads por etapa para o funil
      const etapaCount: Record<string, number> = {};
      leads.forEach(lead => {
        etapaCount[lead.etapa] = (etapaCount[lead.etapa] || 0) + 1;
      });

      // Ordenar funil por fluxo lógico
      const etapasOrdem = ['novo', 'contato_inicial', 'contato', 'qualificado', 'cotacao_enviada', 'negociacao', 'contrato_assinado', 'ganho'];
      const funilData = etapasOrdem
        .filter(etapa => etapaCount[etapa] > 0)
        .map(etapa => ({
          etapa: ETAPA_LABELS[etapa] || etapa,
          quantidade: etapaCount[etapa],
          cor: ETAPA_CORES[etapa] || '#6b7280',
        }));

      // Agrupar leads por origem
      const origemCount: Record<string, number> = {};
      leads.forEach(lead => {
        origemCount[lead.origem] = (origemCount[lead.origem] || 0) + 1;
      });

      const origensData = Object.entries(origemCount)
        .map(([origem, valor]) => ({
          nome: ORIGEM_LABELS[origem] || origem,
          valor,
          cor: ORIGEM_CORES[origem] || '#6b7280',
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);

      // Evolução mensal (últimos 6 meses)
      const evolucaoData: { mes: string; leads: number; contratos: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const mesData = subMonths(new Date(), i);
        const mesInicio = startOfMonth(mesData);
        const mesFim = i === 0 ? new Date() : startOfMonth(subMonths(new Date(), i - 1));

        const leadsDoMes = leads.filter(l => {
          const createdAt = new Date(l.created_at);
          return createdAt >= mesInicio && createdAt < mesFim;
        }).length;

        const contratosDoMes = contratos.filter(c => {
          const createdAt = new Date(c.created_at);
          return createdAt >= mesInicio && createdAt < mesFim;
        }).length;

        evolucaoData.push({
          mes: format(mesData, 'MMM'),
          leads: leadsDoMes,
          contratos: contratosDoMes,
        });
      }

      // Ranking de vendedores
      const vendedorContratos: Record<string, { contratos: number; valor: number }> = {};
      contratos.forEach(contrato => {
        if (contrato.vendedor_id) {
          if (!vendedorContratos[contrato.vendedor_id]) {
            vendedorContratos[contrato.vendedor_id] = { contratos: 0, valor: 0 };
          }
          vendedorContratos[contrato.vendedor_id].contratos++;
          vendedorContratos[contrato.vendedor_id].valor += Number(contrato.valor_mensal) || 0;
        }
      });

      const rankingVendedores = Object.entries(vendedorContratos)
        .map(([id, data]) => {
          const vendedor = vendedores.find(v => v.id === id);
          return {
            id,
            nome: vendedor?.nome || 'Desconhecido',
            contratos: data.contratos,
            valor: data.valor,
          };
        })
        .sort((a, b) => b.contratos - a.contratos)
        .slice(0, 5);

      return {
        leads: totalLeads,
        cotacoes: totalCotacoes,
        contratos: totalContratos,
        conversao,
        funilData,
        origensData,
        evolucaoData,
        rankingVendedores,
      };
    },
  });
}
