import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, startOfDay, subDays, startOfYear } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export type Periodo = 'hoje' | '7dias' | '30dias' | 'ano';

/**
 * Configuração das 9 etapas do funil de cotação
 * Estas são as etapas reais que um cliente passa durante o processo
 */
export const FUNIL_COTACAO_CONFIG = [
  { id: 'novo', label: 'Novo', cor: '#3B82F6', descricao: 'Lead recebido, não contactado' },
  { id: 'contato', label: 'Contato', cor: '#8B5CF6', descricao: 'Primeiro contato realizado' },
  { id: 'cotacao_gerada', label: 'Cotação Gerada', cor: '#F59E0B', descricao: 'Cotação criada' },
  { id: 'escolhendo_plano', label: 'Escolhendo Plano', cor: '#06B6D4', descricao: 'Cliente analisando opções' },
  { id: 'enviando_docs', label: 'Enviando Docs', cor: '#EC4899', descricao: 'Cliente enviando documentação' },
  { id: 'termo_assinado', label: 'Termo Assinado', cor: '#10B981', descricao: 'Contrato assinado digitalmente' },
  { id: 'pagamento_efetuado', label: 'Pagamento Efetuado', cor: '#22C55E', descricao: 'Adesão paga' },
  { id: 'vistoria_agendada', label: 'Vistoria Agendada', cor: '#F97316', descricao: 'Aguardando vistoria' },
  { id: 'proposta_concluida', label: 'Proposta Concluída', cor: '#14B8A6', descricao: 'Associado ativo' },
] as const;

export type EtapaFunilCotacao = typeof FUNIL_COTACAO_CONFIG[number]['id'];

export interface FunilCotacaoItem {
  id: EtapaFunilCotacao;
  label: string;
  cor: string;
  quantidade: number;
  percentual: number;
  descricao: string;
}

export interface FunilCotacaoData {
  etapas: FunilCotacaoItem[];
  totalCotacoes: number;
  cotacoesSemLead: number;
  taxaConversao: number;
  isLoading: boolean;
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

/**
 * Hook para buscar dados do funil de cotação com as 9 etapas corretas.
 *
 * Filtragem automática por vendedor:
 * - Se o usuário logado for vendedor (CLT/Externo) e NÃO for gestor (diretor/gerente/supervisor/admin),
 *   filtra automaticamente por `vendedor_id = profile.id`.
 * - Gestores e diretoria veem visão agregada (total).
 * - Pode ser sobrescrito explicitamente passando `vendedorIdOverride`.
 */
export function useFunilCotacao(periodo: Periodo = '30dias', vendedorIdOverride?: string | null) {
  const { profile } = useAuth();
  const {
    isVendedorClt,
    isVendedorExterno,
    isDiretor,
    isGerente,
    isSupervisor,
    isAdminMaster,
    isDesenvolvedor,
  } = usePermissions();

  const isGestor = isDiretor || isGerente || isSupervisor || isAdminMaster || isDesenvolvedor;
  const isVendedor = isVendedorClt || isVendedorExterno;

  // Decide vendedor a filtrar: override > automático (vendedor logado não-gestor) > nenhum
  const vendedorIdFiltro: string | null =
    vendedorIdOverride !== undefined
      ? vendedorIdOverride
      : isVendedor && !isGestor && profile?.id
        ? profile.id
        : null;

  return useQuery({
    queryKey: ['funil-cotacao', periodo, vendedorIdFiltro],
    queryFn: async (): Promise<FunilCotacaoData> => {
      const { inicio, fim } = calcularPeriodo(periodo);

      // Builders com filtro condicional por vendedor
      const leadsQuery = supabase
        .from('leads')
        .select('id, etapa')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fim.toISOString());
      if (vendedorIdFiltro) leadsQuery.eq('vendedor_id', vendedorIdFiltro);

      const cotacoesQuery = supabase
        .from('cotacoes')
        .select('id, lead_id, status, status_contratacao')
        .neq('status', 'rascunho')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fim.toISOString());
      if (vendedorIdFiltro) cotacoesQuery.eq('vendedor_id', vendedorIdFiltro);

      const contratosQuery = supabase
        .from('contratos')
        .select('id, status, adesao_paga, cotacao_id')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fim.toISOString());
      if (vendedorIdFiltro) contratosQuery.eq('vendedor_id', vendedorIdFiltro);

      // Buscar leads, cotações e contratos primeiro (para subqueries de instalações/associados)
      const [leadsResult, cotacoesResult, contratosResult] = await Promise.all([
        leadsQuery,
        cotacoesQuery,
        contratosQuery,
      ]);

      const leads = leadsResult.data || [];
      const cotacoes = cotacoesResult.data || [];
      const contratos = contratosResult.data || [];

      const cotacaoIds = cotacoes.map(c => c.id);
      const contratoIds = contratos.map(c => c.id);

      // Vistorias/Instalações agendadas do período
      const vistoriasQuery = supabase
        .from('instalacoes')
        .select('id, status, cotacao_id')
        .in('status', ['agendada', 'em_rota', 'em_andamento'])
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fim.toISOString());
      if (vendedorIdFiltro) {
        if (cotacaoIds.length === 0) {
          // Vendedor sem cotações no período → instalações = 0
          vistoriasQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        } else {
          vistoriasQuery.in('cotacao_id', cotacaoIds);
        }
      }

      // Associados ativos do período
      const associadosQuery = supabase
        .from('associados')
        .select('id, status, contrato_id')
        .eq('status', 'ativo')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fim.toISOString());
      if (vendedorIdFiltro) {
        if (contratoIds.length === 0) {
          associadosQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        } else {
          associadosQuery.in('contrato_id', contratoIds);
        }
      }

      const [vistoriasResult, associadosResult] = await Promise.all([
        vistoriasQuery,
        associadosQuery,
      ]);

      const vistorias = vistoriasResult.data || [];
      const associados = associadosResult.data || [];

      // Contar cotações sem lead vinculado
      const cotacoesSemLead = cotacoes.filter(c => !c.lead_id).length;

      // Calcular quantidade por etapa
      const contagens: Record<EtapaFunilCotacao, number> = {
        novo: leads.filter(l => l.etapa === 'novo').length,
        contato: leads.filter(l => ['contato', 'contato_inicial'].includes(l.etapa)).length,
        cotacao_gerada: cotacoes.length, // Todas as cotações (com ou sem lead)
        escolhendo_plano: cotacoes.filter(c =>
          c.status_contratacao === 'plano_escolhido' ||
          c.status_contratacao === 'escolhendo_plano'
        ).length,
        enviando_docs: cotacoes.filter(c =>
          c.status_contratacao === 'dados_preenchidos' ||
          c.status_contratacao === 'enviando_documentos'
        ).length,
        termo_assinado: contratos.filter(c =>
          c.status === 'assinado' || c.status === 'ativo'
        ).length,
        pagamento_efetuado: contratos.filter(c => c.adesao_paga === true).length,
        vistoria_agendada: vistorias.length,
        proposta_concluida: associados.length,
      };

      // Total de cotações (base para taxa de conversão)
      const totalCotacoes = cotacoes.length;

      // Taxa de conversão: Propostas Concluídas / Total de Cotações
      const taxaConversao = totalCotacoes > 0
        ? (contagens.proposta_concluida / totalCotacoes) * 100
        : 0;

      // Montar array de etapas com percentuais
      const etapas: FunilCotacaoItem[] = FUNIL_COTACAO_CONFIG.map(config => ({
        id: config.id,
        label: config.label,
        cor: config.cor,
        descricao: config.descricao,
        quantidade: contagens[config.id],
        percentual: totalCotacoes > 0
          ? (contagens[config.id] / totalCotacoes) * 100
          : 0,
      }));

      return {
        etapas,
        totalCotacoes,
        cotacoesSemLead,
        taxaConversao,
        isLoading: false,
      };
    },
  });
}
