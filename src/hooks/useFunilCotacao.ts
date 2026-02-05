import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, startOfDay, subDays, startOfYear } from 'date-fns';

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
 * Hook para buscar dados do funil de cotação com as 9 etapas corretas
 */
export function useFunilCotacao(periodo: Periodo = '30dias') {
  return useQuery({
    queryKey: ['funil-cotacao', periodo],
    queryFn: async (): Promise<FunilCotacaoData> => {
      const { inicio, fim } = calcularPeriodo(periodo);

      // Buscar dados em paralelo
      const [
        leadsResult,
        cotacoesResult,
        contratosResult,
        vistoriasResult,
        associadosResult,
      ] = await Promise.all([
        // Leads do período
        supabase
          .from('leads')
          .select('id, etapa')
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
        // Cotações do período (inclui com e sem lead)
        supabase
          .from('cotacoes')
          .select('id, lead_id, status, status_contratacao')
          .neq('status', 'rascunho')
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
        // Contratos assinados/ativos do período
        supabase
          .from('contratos')
          .select('id, status, adesao_paga')
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
        // Vistorias/Instalações agendadas do período
        supabase
          .from('instalacoes')
          .select('id, status')
          .in('status', ['agendada', 'em_rota', 'em_andamento'])
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
        // Associados ativos do período
        supabase
          .from('associados')
          .select('id, status')
          .eq('status', 'ativo')
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fim.toISOString()),
      ]);

      const leads = leadsResult.data || [];
      const cotacoes = cotacoesResult.data || [];
      const contratos = contratosResult.data || [];
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
