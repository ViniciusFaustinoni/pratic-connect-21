import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook que consulta `user_module_visibility` para o usuário logado.
 *
 * IMPORTANTE: A tabela `user_module_visibility.user_id` tem FK para `profiles.id`
 * (NÃO auth.users.id). Por isso filtramos por `profile.id`.
 *
 * Semântica ADITIVA: retorna `additionalModules` = módulos extras concedidos
 * a este usuário pelo card "Acesso a Módulos" do Editar Usuário, ALÉM do que
 * o perfil de acesso dele já garante. Consumidores (AppSidebar, useRouteGuard)
 * devem usar a UNIÃO entre o que o perfil libera e esta lista — nunca tratá-la
 * como filtro restritivo.
 *
 * Propagação em tempo real: assina canal Realtime filtrado por `user_id`,
 * invalidando a query sempre que o admin alterar o card "Acesso a Módulos".
 * Sem isso, a sessão do usuário-alvo ficava com snapshot velho por até 5 min.
 */
export function useModuleVisibility() {
  const { profile } = useAuth();
  const profileId = profile?.id;
  const queryClient = useQueryClient();

  const { data: visibilityResult = { additionalModules: [], editableModules: [] }, isLoading } = useQuery({
    queryKey: ['module-visibility', profileId],
    queryFn: async () => {
      if (!profileId) return { additionalModules: [], editableModules: [] };

      const { data, error } = await (supabase as any)
        .from('user_module_visibility')
        .select('module_id, visible, can_edit')
        .eq('user_id', profileId)
        .eq('visible', true);

      if (error) throw error;

      const additionalModules = (data || []).map((r: any) => r.module_id) as string[];
      const editableModules = (data || []).filter((r: any) => r.can_edit === true).map((r: any) => r.module_id) as string[];

      return { additionalModules, editableModules };
    },
    enabled: !!profileId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!profileId) return;
    const channel = supabase
      .channel(`user-module-visibility-${profileId}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'user_module_visibility', filter: `user_id=eq.${profileId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['module-visibility', profileId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, queryClient]);

  return {
    additionalModules: visibilityResult.additionalModules,
    editableModules: visibilityResult.editableModules,
    /** @deprecated alias retrocompatível — use `additionalModules`. */
    visibleModules: visibilityResult.additionalModules,
    isLoading,
  };
}

/**
 * Mapeamento de module_id para prefixos de rotas.
 * Usado pelo useRouteGuard para validar acesso.
 */
export const MODULE_ROUTES: Record<string, string[]> = {
  dashboard: ['/dashboard'],
  vendas: ['/vendas', '/vendas/substituicao'],
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
