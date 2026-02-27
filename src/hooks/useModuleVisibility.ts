import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook que consulta a tabela role_module_visibility e calcula a UNIÃO
 * dos módulos visíveis para todos os roles do usuário atual.
 * 
 * Exemplo: usuário com roles [coordenador_monitoramento, analista_eventos]
 *   -> coord_monitoramento vê: [dashboard, monitoramento]
 *   -> analista_eventos vê: [dashboard, eventos, assistencia, oficinas]
 *   -> UNIÃO FINAL: [dashboard, monitoramento, eventos, assistencia, oficinas]
 */
export function useModuleVisibility() {
  const { user, roles } = useAuth();

  const { data: visibleModules = [], isLoading } = useQuery({
    queryKey: ['module-visibility', user?.id, roles],
    queryFn: async () => {
      if (!roles || roles.length === 0) return [];

      const { data, error } = await (supabase as any)
        .from('role_module_visibility')
        .select('module_id')
        .in('role', roles)
        .eq('visible', true);

      if (error) throw error;

      // União de todos os módulos visíveis de todos os roles
      return [...new Set((data || []).map((r: any) => r.module_id))] as string[];
    },
    enabled: !!user?.id && roles.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  return { visibleModules, isLoading };
}

/**
 * Mapeamento de module_id para prefixos de rotas.
 * Usado pelo useRouteGuard para validar acesso.
 */
export const MODULE_ROUTES: Record<string, string[]> = {
  dashboard: ['/dashboard'],
  vendas: ['/vendas'],
  cadastro: ['/cadastro'],
  monitoramento: ['/monitoramento'],
  eventos: ['/eventos'],
  assistencia: ['/assistencia'],
  oficinas: ['/oficinas', '/ordens-servico'],
  financeiro: ['/financeiro'],
  cobranca: ['/cobranca'],
  contabilidade: ['/contabilidade'],
  juridico: ['/juridico'],
  rh: ['/rh'],
  marketing: ['/marketing'],
  ouvidoria: ['/ouvidoria'],
  diretoria: ['/diretoria'],
  relatorios: ['/relatorios'],
  documentos: ['/documentos'],
  configuracoes: ['/configuracoes'],
};
