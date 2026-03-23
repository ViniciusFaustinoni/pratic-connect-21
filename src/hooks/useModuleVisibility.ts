import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook que consulta a tabela user_module_visibility para o usuário atual.
 * Retorna os módulos visíveis e editáveis configurados diretamente para o usuário.
 */
export function useModuleVisibility() {
  const { user } = useAuth();

  const { data: visibilityResult = { visibleModules: [], editableModules: [] }, isLoading } = useQuery({
    queryKey: ['module-visibility', user?.id],
    queryFn: async () => {
      if (!user?.id) return { visibleModules: [], editableModules: [] };

      const { data, error } = await (supabase as any)
        .from('user_module_visibility')
        .select('module_id, visible, can_edit')
        .eq('user_id', user.id)
        .eq('visible', true);

      if (error) throw error;

      const visibleModules = (data || []).map((r: any) => r.module_id) as string[];
      const editableModules = (data || []).filter((r: any) => r.can_edit === true).map((r: any) => r.module_id) as string[];

      return { visibleModules, editableModules };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { 
    visibleModules: visibilityResult.visibleModules, 
    editableModules: visibilityResult.editableModules, 
    isLoading 
  };
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
  agencia: ['/agencia'],
};
