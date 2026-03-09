import { useCallback, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook de permissões específico para o módulo de Documentos.
 * Agora derivado do banco via capability permissions (hasPerm).
 */
export function useDocumentoPermissoes() {
  const { roles } = useAuth();
  const { hasPerm } = usePermissions();

  const permissoes = useMemo(() => ({
    podeGerar: hasPerm('canManageLeads') || hasPerm('canManageCadastro') || hasPerm('canCreateTemplate'),
    podeVerHistorico: hasPerm('canManageLeads') || hasPerm('canManageCadastro') || hasPerm('canViewReports'),
    podeCriarTemplate: hasPerm('canCreateTemplate'),
    podeEditarTemplate: hasPerm('canEditTemplate'),
    podeExcluirTemplate: hasPerm('canDeleteTemplate'),
    podeEnviarAssinatura: hasPerm('canManageLeads') || hasPerm('canManageCadastro') || hasPerm('canCreateTemplate'),
    podeVerTodosDocumentos: hasPerm('canViewReports') || hasPerm('canManageCadastro'),
  }), [hasPerm]);

  /**
   * Verificar se pode editar um template específico baseado nos perfis permitidos
   */
  const podeEditarTemplateEspecifico = useCallback((perfisPermitidos?: string[] | null): boolean => {
    if (permissoes.podeEditarTemplate) return true;
    if (!perfisPermitidos || perfisPermitidos.length === 0) return permissoes.podeEditarTemplate;
    const rolesArray = roles || [];
    return rolesArray.some(role => perfisPermitidos.includes(role));
  }, [roles, permissoes.podeEditarTemplate]);

  return {
    ...permissoes,
    podeEditarTemplateEspecifico,
  };
}
