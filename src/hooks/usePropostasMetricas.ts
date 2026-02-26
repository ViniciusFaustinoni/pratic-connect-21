import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format } from 'date-fns';

export type PeriodoFiltro = 'semana' | 'mes';

export interface ConsultorMetricas {
  id: string;
  nome: string;
  avatar_url?: string | null;
  // Leads por etapa
  leadsAtivos: number;
  emCotacao: number;
  emNegociacao: number;
  contratoEnviado: number;
  // Propostas fechadas
  propostasFechadas: number;
  propostasFechadasAnterior: number;
  // Valores
  valorFechado: number;
  valorFechadoAnterior: number;
  // Taxas
  taxaConversao: number;
  // Tempo médio de fechamento em dias
  tempoMedioFechamento: number;
  // Ranking
  ranking: number;
  // Total de cotações reais criadas
  cotacoesRealizadas: number;
}

export interface PropostasMetricasGlobais {
  totalPropostas: number;
  emCotacao: number;
  aguardandoAssinatura: number;
  assinadas: number;
  valorTotalMensal: number;
  // Variações
  variacaoPropostas: number;
  variacaoAssinadas: number;
  variacaoValor: number;
}

export function usePropostasMetricas(periodo: PeriodoFiltro = 'mes') {
  return useQuery({
    queryKey: ['propostas-metricas', periodo],
    queryFn: async () => {
      const now = new Date();
      
      // Definir período atual e anterior
      let periodoInicio: Date;
      let periodoFim: Date;
      let periodoAnteriorInicio: Date;
      let periodoAnteriorFim: Date;
      
      if (periodo === 'semana') {
        periodoInicio = startOfWeek(now, { weekStartsOn: 1 });
        periodoFim = endOfWeek(now, { weekStartsOn: 1 });
        periodoAnteriorInicio = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        periodoAnteriorFim = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      } else {
        periodoInicio = startOfMonth(now);
        periodoFim = endOfMonth(now);
        periodoAnteriorInicio = startOfMonth(subMonths(now, 1));
        periodoAnteriorFim = endOfMonth(subMonths(now, 1));
      }
      
      const periodoInicioStr = format(periodoInicio, 'yyyy-MM-dd');
      const periodoFimStr = format(periodoFim, 'yyyy-MM-dd');
      const periodoAnteriorInicioStr = format(periodoAnteriorInicio, 'yyyy-MM-dd');
      const periodoAnteriorFimStr = format(periodoAnteriorFim, 'yyyy-MM-dd');

      // Buscar vendedores
      const { data: vendedoresRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['vendedor_clt', 'vendedor_externo', 'supervisor_vendas', 'gerente_comercial']);
      
      if (!vendedoresRoles || vendedoresRoles.length === 0) {
        return { consultores: [], globais: getEmptyGlobais() };
      }

      const vendedorIds = [...new Set(vendedoresRoles.map(r => r.user_id))];

      // Buscar profiles dos vendedores (vendedorIds são auth.users.id de user_roles)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, nome, avatar_url')
        .in('user_id', vendedorIds)
        .eq('ativo', true);

      // Criar mapa de profiles.id -> user_id para compatibilidade
      const profileIdToUserId = new Map<string, string>();
      const userIdToProfileId = new Map<string, string>();
      profiles?.forEach(p => {
        if (p.user_id) {
          profileIdToUserId.set(p.id, p.user_id);
          userIdToProfileId.set(p.user_id, p.id);
        }
      });

      // Buscar profiles IDs para filtrar contratos (contratos.vendedor_id armazena profiles.id)
      const profileIds = profiles?.map(p => p.id) || [];

      // Buscar leads de cada vendedor (leads.vendedor_id = auth.users.id)
      const { data: leads } = await supabase
        .from('leads')
        .select('id, vendedor_id, etapa, created_at')
        .in('vendedor_id', vendedorIds);

      // Buscar cotações reais da tabela cotacoes (vendedor_id = auth.users.id via profiles.user_id)
      const { data: cotacoes } = await supabase
        .from('cotacoes')
        .select('id, vendedor_id, status, valor_total_mensal, created_at')
        .in('vendedor_id', vendedorIds);

      // Buscar contratos período atual - usar data_assinatura para contratos assinados
      const { data: contratosAtuais } = await supabase
        .from('contratos')
        .select('id, vendedor_id, status, valor_mensal, created_at, data_assinatura')
        .in('vendedor_id', profileIds)
        .in('status', ['assinado', 'ativo', 'enviado', 'rascunho'])
        .or(`created_at.gte.${periodoInicioStr},data_assinatura.gte.${periodoInicioStr}`)
        .or(`created_at.lte.${periodoFimStr}T23:59:59,data_assinatura.lte.${periodoFimStr}T23:59:59`);

      // Buscar contratos ASSINADOS no período atual (por data_assinatura)
      const { data: contratosAssinadosAtuais } = await supabase
        .from('contratos')
        .select('id, vendedor_id, status, valor_mensal, created_at, data_assinatura')
        .in('vendedor_id', profileIds)
        .in('status', ['assinado', 'ativo'])
        .gte('data_assinatura', periodoInicioStr)
        .lte('data_assinatura', `${periodoFimStr}T23:59:59`);

      // Buscar contratos período anterior (por data_assinatura)
      const { data: contratosAnteriores } = await supabase
        .from('contratos')
        .select('id, vendedor_id, status, valor_mensal, data_assinatura')
        .in('vendedor_id', profileIds)
        .in('status', ['assinado', 'ativo'])
        .gte('data_assinatura', periodoAnteriorInicioStr)
        .lte('data_assinatura', `${periodoAnteriorFimStr}T23:59:59`);

      // Buscar todos os contratos para métricas globais
      const { data: todosContratos } = await supabase
        .from('contratos')
        .select('id, vendedor_id, status, valor_mensal, created_at')
        .in('vendedor_id', profileIds);

      // Processar métricas por consultor
      const consultoresMap = new Map<string, ConsultorMetricas>();

      profiles?.forEach(profile => {
        // Para leads: usar user_id diretamente
        const vendedorLeads = leads?.filter(l => l.vendedor_id === profile.user_id) || [];
        // Para cotações: vendedor_id = auth.users.id (via profiles.user_id FK)
        const vendedorCotacoes = cotacoes?.filter(c => c.vendedor_id === profile.user_id) || [];
        // Para contratos: usar profiles.id (já que contratos.vendedor_id = profiles.id)
        const vendedorContratosAtuais = contratosAtuais?.filter(c => c.vendedor_id === profile.id) || [];
        const vendedorContratosAnteriores = contratosAnteriores?.filter(c => c.vendedor_id === profile.id) || [];
        
        // Usar contratosAssinadosAtuais para métricas de fechamento (por data_assinatura)
        const vendedorAssinadosAtuais = contratosAssinadosAtuais?.filter(c => c.vendedor_id === profile.id) || [];
        
        const propostasFechadas = vendedorAssinadosAtuais.length;
        
        const propostasFechadasAnterior = vendedorContratosAnteriores.length;
        
        const valorFechado = vendedorAssinadosAtuais
          .reduce((acc, c) => acc + (c.valor_mensal || 0), 0);
          
        const valorFechadoAnterior = vendedorContratosAnteriores
          .reduce((acc, c) => acc + (c.valor_mensal || 0), 0);

        const leadsAtivos = vendedorLeads.filter(l => 
          !['ganho', 'perdido'].includes(l.etapa)
        ).length;

        // emCotacao de leads
        const emCotacaoLeads = vendedorLeads.filter(l => 
          l.etapa === 'cotacao_enviada'
        ).length;

        // emCotacao de cotações reais (rascunho ou enviada)
        const emCotacaoCotacoes = vendedorCotacoes.filter(c => 
          ['rascunho', 'enviada'].includes(c.status)
        ).length;

        // Usar o maior valor entre leads e cotações reais
        const emCotacao = Math.max(emCotacaoLeads, emCotacaoCotacoes);

        const emNegociacao = vendedorLeads.filter(l => 
          l.etapa === 'negociacao'
        ).length;

        const contratoEnviado = vendedorLeads.filter(l => 
          l.etapa === 'contrato_enviado'
        ).length;

        const leadsGanhos = vendedorLeads.filter(l => l.etapa === 'ganho').length;
        const totalLeads = vendedorLeads.length;
        const taxaConversao = totalLeads > 0 ? (leadsGanhos / totalLeads) * 100 : 0;

        // Total de cotações realizadas pelo vendedor
        const cotacoesRealizadas = vendedorCotacoes.length;

        // Usar user_id como chave do consultor (para consistência com auth.uid())
        consultoresMap.set(profile.user_id!, {
          id: profile.user_id!,
          nome: profile.nome || 'Sem nome',
          avatar_url: profile.avatar_url,
          leadsAtivos,
          emCotacao,
          emNegociacao,
          contratoEnviado,
          propostasFechadas,
          propostasFechadasAnterior,
          valorFechado,
          valorFechadoAnterior,
          taxaConversao,
          tempoMedioFechamento: 0, // TODO: calcular
          ranking: 0,
          cotacoesRealizadas,
        });
      });

      // Lista de consultores prioritários (aparecem primeiro, nesta ordem)
      const consultoresPrioritarios = [
        'KALAYANE SHASNAM MURADO',
        'JEICIELI DOS SANTOS LIMA',
        'MARIA JULIA FLORENCIO GOMES',
        'CASAL BRASIL',
        'ISABELLA SILVA MORSCHBACHER',
        'PATRICK MACEDO RODRIGUES DUARTE',
        'LEONARDO LOPES',
        'ANTONIO FRANCISCO SANTOS DE FREITAS',
        'THAINÁ DE OLIVEIRA LOUZADA',
        'TAIANY GONÇALVES DE LIMA',
        'JAQUELINE ZANONI DA CUNHA',
        'RENATA PELAIS DOS SANTOS',
      ];

      // Ordenar: prioritários primeiro (na ordem da lista), depois os demais por propostas fechadas
      const consultores = Array.from(consultoresMap.values())
        .sort((a, b) => {
          const nomeA = a.nome.toUpperCase();
          const nomeB = b.nome.toUpperCase();
          
          const indexA = consultoresPrioritarios.findIndex(
            nome => nomeA.includes(nome) || nome.includes(nomeA)
          );
          const indexB = consultoresPrioritarios.findIndex(
            nome => nomeB.includes(nome) || nome.includes(nomeB)
          );
          
          // Ambos são prioritários: ordenar pela posição na lista
          if (indexA >= 0 && indexB >= 0) return indexA - indexB;
          // Só A é prioritário: A vem primeiro
          if (indexA >= 0) return -1;
          // Só B é prioritário: B vem primeiro
          if (indexB >= 0) return 1;
          // Nenhum é prioritário: ordenar por propostas fechadas
          return b.propostasFechadas - a.propostasFechadas;
        })
        .map((c, idx) => ({ ...c, ranking: idx + 1 }));

      const globalEmCotacaoLeads = leads?.filter(l => l.etapa === 'cotacao_enviada').length || 0;
      const globalEmCotacaoCotacoes = cotacoes?.filter(c => ['rascunho', 'enviada'].includes(c.status)).length || 0;

      // Calcular métricas globais
      const globais: PropostasMetricasGlobais = {
        totalPropostas: todosContratos?.length || 0,
        emCotacao: Math.max(globalEmCotacaoLeads, globalEmCotacaoCotacoes),
        aguardandoAssinatura: todosContratos?.filter(c => c.status === 'enviado').length || 0,
        assinadas: contratosAssinadosAtuais?.length || 0,
        valorTotalMensal: todosContratos
          ?.filter(c => c.status === 'ativo')
          .reduce((acc, c) => acc + (c.valor_mensal || 0), 0) || 0,
        variacaoPropostas: calcularVariacao(
          contratosAssinadosAtuais?.length || 0,
          contratosAnteriores?.length || 0
        ),
        variacaoAssinadas: calcularVariacao(
          contratosAssinadosAtuais?.length || 0,
          contratosAnteriores?.length || 0
        ),
        variacaoValor: calcularVariacao(
          contratosAssinadosAtuais?.reduce((acc, c) => acc + (c.valor_mensal || 0), 0) || 0,
          contratosAnteriores?.reduce((acc, c) => acc + (c.valor_mensal || 0), 0) || 0
        ),
      };

      return { consultores, globais };
    },
    staleTime: 1000 * 30, // 30 segundos - mais rápido para ver assinaturas
  });
}

function calcularVariacao(atual: number, anterior: number): number {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / anterior) * 100;
}

function getEmptyGlobais(): PropostasMetricasGlobais {
  return {
    totalPropostas: 0,
    emCotacao: 0,
    aguardandoAssinatura: 0,
    assinadas: 0,
    valorTotalMensal: 0,
    variacaoPropostas: 0,
    variacaoAssinadas: 0,
    variacaoValor: 0,
  };
}

// Hook para buscar detalhes de propostas de um consultor específico
export function useConsultorPropostas(consultorId: string | null, periodo: PeriodoFiltro = 'mes') {
  return useQuery({
    queryKey: ['consultor-propostas', consultorId, periodo],
    queryFn: async () => {
      if (!consultorId) return null;

      const now = new Date();
      const periodoInicio = periodo === 'semana' 
        ? startOfWeek(now, { weekStartsOn: 1 })
        : startOfMonth(now);
      const periodoInicioStr = format(periodoInicio, 'yyyy-MM-dd');

      // Leads do consultor
      const { data: leads } = await supabase
        .from('leads')
        .select(`
          id, nome, email, telefone, etapa, created_at,
          veiculo_marca, veiculo_modelo, veiculo_ano,
          cotacoes(id, status, valor_mensal, created_at)
        `)
        .eq('vendedor_id', consultorId)
        .order('created_at', { ascending: false });

      // Contratos do consultor
      const { data: contratos } = await supabase
        .from('contratos')
        .select(`
          id, numero, status, valor_mensal, valor_adesao, created_at,
          leads(id, nome, telefone, veiculo_marca, veiculo_modelo),
          planos(nome)
        `)
        .eq('vendedor_id', consultorId)
        .order('created_at', { ascending: false });

      // Separar por status
      const emCotacao = leads?.filter(l => l.etapa === 'cotacao_enviada') || [];
      const emNegociacao = leads?.filter(l => 
        ['negociacao', 'contrato_enviado', 'contrato_assinado'].includes(l.etapa)
      ) || [];
      const propostasEnviadas = contratos?.filter(c => c.status === 'enviado') || [];
      const propostasFechadas = contratos?.filter(c => 
        c.status === 'assinado' || c.status === 'ativo'
      ) || [];

      // Métricas do período
      const fechadasNoPeriodo = propostasFechadas.filter(c => 
        new Date(c.created_at) >= periodoInicio
      );

      return {
        leads,
        contratos,
        emCotacao,
        emNegociacao,
        propostasEnviadas,
        propostasFechadas,
        fechadasNoPeriodo,
        totalValorPeriodo: fechadasNoPeriodo.reduce((acc, c) => acc + (c.valor_mensal || 0), 0),
      };
    },
    enabled: !!consultorId,
  });
}
