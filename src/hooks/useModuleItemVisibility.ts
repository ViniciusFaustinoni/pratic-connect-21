import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook que consulta a tabela role_module_item_visibility e calcula a UNIÃO
 * dos sub-itens visíveis para todos os roles do usuário atual.
 */
export function useModuleItemVisibility() {
  const { user, roles } = useAuth();

  const { data: visibleItems = [], isLoading } = useQuery({
    queryKey: ['module-item-visibility', user?.id, roles],
    queryFn: async () => {
      if (!roles || roles.length === 0) return [];

      const { data, error } = await (supabase as any)
        .from('role_module_item_visibility')
        .select('module_id, item_id, visible')
        .in('role', roles)
        .eq('visible', true);

      if (error) throw error;

      // Retorna pares module_id:item_id visíveis (união de todos os roles)
      return [...new Set(
        (data || []).map((r: any) => `${r.module_id}:${r.item_id}`)
      )] as string[];
    },
    enabled: !!user?.id && roles.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Verifica se um sub-item específico está visível.
   * Se não há dados de item visibility no banco, retorna true (permissivo por padrão).
   */
  const isItemVisible = (moduleId: string, itemId: string): boolean => {
    // Se não há dados de visibilidade de itens, tudo é visível
    if (visibleItems.length === 0) return true;
    return visibleItems.includes(`${moduleId}:${itemId}`);
  };

  return { visibleItems, isItemVisible, isLoading };
}

/**
 * Mapeamento de URLs de menu para item_ids dentro de cada módulo.
 * Usado pelo AppSidebar para filtrar itens de menu.
 */
export const MENU_ITEM_IDS: Record<string, string> = {
  // Vendas
  '/vendas/leads': 'leads',
  '/vendas/cotacoes': 'cotacoes',
  '/vendas/contratos': 'propostas',
  '/vendas/ativacoes': 'ativacoes',
  '/vendas/propostas': 'consultores',
  '/vendas/planos-beneficios': 'planos',
  // Cadastro
  '/cadastro/propostas': 'propostas_pendentes',
  '/cadastro/associados': 'associados',
  '/cadastro/veiculos': 'veiculos',
  '/cadastro/substituicoes': 'substituicoes',
  // Monitoramento
  '/monitoramento/equipe': 'equipe',
  '/monitoramento/instalacoes': 'instalacoes',
  '/monitoramento/vistorias': 'vistorias',
  '/monitoramento/retiradas': 'retiradas',
  '/monitoramento/calendario': 'calendario',
  '/monitoramento/estoque': 'estoque',
  '/monitoramento/rastreadores': 'rastreadores',
  '/monitoramento/mapa': 'mapa',
  '/monitoramento/alertas': 'alertas',
  // Eventos
  '/eventos/dashboard': 'dashboard',
  '/eventos/sinistros': 'sinistros',
  '/eventos/pre-analise': 'pre_analise',
  '/eventos/sla': 'sla',
  '/eventos/sindicancias': 'sindicancias',
  '/eventos/sindicantes': 'sindicantes',
  '/eventos/solicitacoes-ia': 'solicitacoes_ia',
  // Assistência
  '/assistencia': 'dashboard',
  '/assistencia/chamados': 'chamados',
  '/assistencia/prestadores': 'prestadores',
  // Oficinas
  '/oficinas': 'oficinas',
  '/oficinas/auto-centers': 'auto_centers',
  '/ordens-servico': 'ordens_servico',
  '/oficinas/relatorios': 'relatorios',
  // Financeiro
  '/financeiro': 'dashboard',
  '/financeiro/cobrancas': 'cobrancas',
  '/financeiro/contas-pagar': 'contas_pagar',
  '/financeiro/faturamento': 'faturamento',
  '/financeiro/extrato': 'extrato',
  '/financeiro/extratos-bancarios': 'extratos_bancarios',
  '/financeiro/contas-bancarias': 'contas_bancarias',
  // Cobrança
  '/cobranca': 'dashboard',
  '/cobranca/inadimplentes': 'inadimplentes',
  '/cobranca/fila': 'fila',
  '/cobranca/acordos': 'acordos',
  '/cobranca/negativacao': 'negativacao',
  '/cobranca/regua': 'regua',
  // Contabilidade
  '/contabilidade': 'dashboard',
  '/contabilidade/plano-contas': 'plano_contas',
  '/contabilidade/lancamentos': 'lancamentos',
  '/contabilidade/balancete': 'balancete',
  '/contabilidade/balanco-patrimonial': 'balanco_patrimonial',
  '/contabilidade/dre': 'dre',
  '/contabilidade/fechamento': 'fechamento',
  // Jurídico
  '/juridico': 'dashboard',
  '/juridico/casos': 'casos',
  '/juridico/processos': 'processos',
  '/juridico/advogados': 'advogados',
  '/juridico/prazos': 'prazos',
  '/juridico/audiencias': 'audiencias',
  '/juridico/consultas': 'consultas',
  '/juridico/pareceres': 'pareceres',
  // RH
  '/rh': 'dashboard',
  '/rh/funcionarios': 'funcionarios',
  '/rh/jornadas': 'jornadas',
  '/rh/folha-pagamento': 'folha_pagamento',
  '/rh/ponto': 'ponto',
  '/rh/ferias': 'ferias',
  '/rh/organograma': 'organograma',
  '/rh/departamentos': 'departamentos',
  '/rh/beneficios': 'beneficios',
  // Marketing
  '/marketing': 'dashboard',
  '/marketing/campanhas': 'campanhas',
  '/marketing/canais': 'canais',
  '/marketing/indicacoes': 'indicacoes',
  '/marketing/utms': 'utms',
  '/marketing/distribuicao': 'distribuicao',
  '/marketing/relatorios': 'relatorios',
  // Ouvidoria
  '/ouvidoria': 'dashboard',
  '/ouvidoria/fila': 'fila',
  // Diretoria
  '/diretoria': 'dashboard',
  '/diretoria/produtos': 'produtos',
  '/diretoria/planos-beneficios': 'planos_beneficios',
  '/diretoria/precos': 'precos',
  '/diretoria/rateios': 'rateio',
  '/diretoria/indicadores': 'atuarial',
  '/diretoria/blacklist': 'blacklist',
  '/diretoria/configuracoes': 'configuracoes',
  '/diretoria/perfis': 'perfis',
  '/diretoria/logs': 'logs',
  '/diretoria/relatorios': 'relatorios',
  // Documentos
  '/documentos/gerar': 'gerar',
  '/documentos/historico': 'historico',
  '/documentos/templates': 'templates',
  '/documentos/aditivos': 'aditivos',
  // Relatórios
  '/relatorios': 'central',
};
