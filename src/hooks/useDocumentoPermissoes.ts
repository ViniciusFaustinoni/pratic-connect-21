import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useMemo } from 'react';
import type { PerfilAcesso } from '@/types/auth';

/**
 * Permissões específicas para o módulo de Documentos
 */
interface PermissoesDocumentos {
  podeGerar: boolean;
  podeVerHistorico: boolean;
  podeCriarTemplate: boolean;
  podeEditarTemplate: boolean;
  podeExcluirTemplate: boolean;
  podeEnviarAssinatura: boolean;
  podeVerTodosDocumentos: boolean;
}

type PerfilDocumentos = 'admin' | 'diretor' | 'gerente' | 'supervisor' | 'analista' | 'vendedor' | 'instalador';

const PERMISSOES_POR_PERFIL: Record<PerfilDocumentos, PermissoesDocumentos> = {
  admin: {
    podeGerar: true,
    podeVerHistorico: true,
    podeCriarTemplate: true,
    podeEditarTemplate: true,
    podeExcluirTemplate: true,
    podeEnviarAssinatura: true,
    podeVerTodosDocumentos: true,
  },
  diretor: {
    podeGerar: true,
    podeVerHistorico: true,
    podeCriarTemplate: true,
    podeEditarTemplate: true,
    podeExcluirTemplate: true,
    podeEnviarAssinatura: true,
    podeVerTodosDocumentos: true,
  },
  gerente: {
    podeGerar: true,
    podeVerHistorico: true,
    podeCriarTemplate: true,
    podeEditarTemplate: true,
    podeExcluirTemplate: false,
    podeEnviarAssinatura: true,
    podeVerTodosDocumentos: true,
  },
  supervisor: {
    podeGerar: true,
    podeVerHistorico: true,
    podeCriarTemplate: false,
    podeEditarTemplate: false,
    podeExcluirTemplate: false,
    podeEnviarAssinatura: true,
    podeVerTodosDocumentos: true,
  },
  analista: {
    podeGerar: true,
    podeVerHistorico: true,
    podeCriarTemplate: false,
    podeEditarTemplate: false,
    podeExcluirTemplate: false,
    podeEnviarAssinatura: true,
    podeVerTodosDocumentos: false,
  },
  vendedor: {
    podeGerar: true,
    podeVerHistorico: true,
    podeCriarTemplate: false,
    podeEditarTemplate: false,
    podeExcluirTemplate: false,
    podeEnviarAssinatura: true,
    podeVerTodosDocumentos: false,
  },
  instalador: {
    podeGerar: false,
    podeVerHistorico: false,
    podeCriarTemplate: false,
    podeEditarTemplate: false,
    podeExcluirTemplate: false,
    podeEnviarAssinatura: false,
    podeVerTodosDocumentos: false,
  },
};

/**
 * Mapeia os perfis do sistema (user_roles) para o perfil do módulo de documentos
 */
function mapearPerfilParaDocumentos(roles: PerfilAcesso[]): PerfilDocumentos {
  // Ordem de prioridade: quem tem maior privilégio ganha
  if (roles.includes('diretor')) return 'diretor';
  if (roles.includes('gerente_comercial')) return 'gerente';
  if (roles.includes('supervisor_vendas')) return 'supervisor';
  if (roles.includes('analista_cadastro')) return 'analista';
  if (roles.includes('analista_marketing')) return 'analista';
  if (roles.includes('analista_juridico')) return 'analista';
  if (roles.includes('analista_plataforma')) return 'analista';
  if (roles.includes('vendedor_clt') || roles.includes('vendedor_externo')) return 'vendedor';
  if (roles.includes('instalador_vistoriador')) return 'instalador';
  if (roles.includes('coordenador_monitoramento')) return 'supervisor';
  
  // Fallback para o perfil mais restrito
  return 'vendedor';
}

/**
 * Hook de permissões específico para o módulo de Documentos
 */
export function useDocumentoPermissoes() {
  const { roles } = useAuth();

  // Mapear o perfil do sistema para o perfil de documentos
  const perfilDocumentos = useMemo(() => {
    return mapearPerfilParaDocumentos(roles as PerfilAcesso[]);
  }, [roles]);

  // Obter permissões baseadas no perfil
  const permissoes = useMemo(() => {
    return PERMISSOES_POR_PERFIL[perfilDocumentos] || PERMISSOES_POR_PERFIL.vendedor;
  }, [perfilDocumentos]);

  /**
   * Verificar se pode editar um template específico baseado nos perfis permitidos
   * @param perfisPermitidos - Array de perfis que podem editar o template (do banco)
   */
  const podeEditarTemplateEspecifico = useCallback((perfisPermitidos?: string[] | null): boolean => {
    // Se já tem permissão global de edição, permite
    if (permissoes.podeEditarTemplate) {
      return true;
    }
    
    // Se não tem perfis definidos, usa permissão padrão
    if (!perfisPermitidos || perfisPermitidos.length === 0) {
      return permissoes.podeEditarTemplate;
    }
    
    // Verificar se algum dos perfis do usuário está na lista permitida
    const rolesArray = roles as PerfilAcesso[];
    return rolesArray.some(role => perfisPermitidos.includes(role));
  }, [roles, permissoes.podeEditarTemplate]);

  return {
    perfil: perfilDocumentos,
    ...permissoes,
    podeEditarTemplateEspecifico,
  };
}
