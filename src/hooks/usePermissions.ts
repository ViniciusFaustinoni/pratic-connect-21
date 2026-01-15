import { useAuth } from '@/contexts/AuthContext';

export type PermissionKey = 
  | 'isFuncionario'
  | 'isAssociado'
  | 'isPrestador'
  | 'isDiretor'
  | 'isDiretorOnly'
  | 'isGerente'
  | 'isSupervisor'
  | 'isGerenciaOrSupervisor'
  | 'isVendedorClt'
  | 'isVendedorExterno'
  | 'isAnalistaCadastro'
  | 'isAnalistaCadastroOnly'
  | 'isCoordenadorMonitoramento'
  | 'isAnalistaPlataforma'
  | 'isInstaladorVistoriador'
  | 'isAnalistaMarketing'
  | 'isAnalistaJuridico'
  | 'isVendedor'
  | 'isGerencia'
  | 'isDesenvolvedor'
  | 'isAdminMaster'
  | 'canManageUsers'
  | 'canManageLeads'
  | 'canManagePlanos'
  | 'canManageContratos'
  | 'canManageApiSettings'
  | 'canManageInstalacoes'
  | 'canManageRastreadores'
  | 'canViewDashboard'
  | 'canAccessApp'
  | 'canManageCadastro'
  | 'canManageOficinas'
  | 'canManageSinistros'
  | 'canApproveOS'
  | 'canManageContabilidade'
  | 'canManageJuridico'
  | 'canManageRH'
  | 'canManageMarketing'
  | 'canManageOuvidoria'
  | 'canManagePermissions'
  | 'canApprovePermissionChanges'
  | 'canCreateRoles';

/**
 * Hook centralizado de permissões para verificar acessos de forma declarativa
 */
export function usePermissions() {
  const { profile, roles, hasRole, isGerencia, isVendedor, isFuncionario } = useAuth();

  // Verificar roles usando busca direta no array (para novos perfis não tipados ainda)
  const hasRoleByName = (roleName: string) => roles?.includes(roleName as any) ?? false;

  // Novos perfis privilegiados
  const isDesenvolvedor = hasRoleByName('desenvolvedor');
  const isAdminMaster = hasRoleByName('admin_master');
  const isDiretor = hasRole('diretor');
  const isAnalistaCadastro = hasRole('analista_cadastro');
  
  // Verifica se é APENAS analista de cadastro (sem perfis de gerência ou admin)
  const isAnalistaCadastroOnly = isAnalistaCadastro && 
    !isDiretor && 
    !isGerencia() && 
    !isDesenvolvedor && 
    !isAdminMaster;

  const permissions = {
    // Verificações de tipo de usuário
    isFuncionario: profile?.tipo === 'funcionario',
    isAssociado: profile?.tipo === 'associado',
    isPrestador: profile?.tipo === 'prestador',

    // Novos perfis de alto privilégio
    isDesenvolvedor,
    isAdminMaster,

    // Verificações de perfil/role
    isDiretor,
    isDiretorOnly: isDiretor,
    isGerente: hasRole('gerente_comercial'),
    isSupervisor: hasRole('supervisor_vendas'),
    isGerenciaOrSupervisor: isGerencia() || hasRole('supervisor_vendas'),
    isVendedorClt: hasRole('vendedor_clt'),
    isVendedorExterno: hasRole('vendedor_externo'),
    isAnalistaCadastro,
    isAnalistaCadastroOnly,
    isCoordenadorMonitoramento: hasRole('coordenador_monitoramento'),
    isAnalistaPlataforma: hasRole('analista_plataforma'),
    isInstaladorVistoriador: hasRole('instalador_vistoriador'),
    isAnalistaMarketing: hasRole('analista_marketing'),
    isAnalistaJuridico: hasRole('analista_juridico'),

    // Verificações compostas
    isVendedor: isVendedor(),
    isGerencia: isGerencia(),

    // Permissões de sistema
    canManagePermissions: isDesenvolvedor || isDiretor || isAdminMaster,
    canApprovePermissionChanges: isDesenvolvedor || isDiretor,
    canCreateRoles: isDesenvolvedor || isDiretor || isAdminMaster,

    // Permissões funcionais
    canManageUsers: isDiretor || isDesenvolvedor || isAdminMaster,
    canManageLeads: isVendedor() || isGerencia(),
    canManagePlanos: isGerencia() || isDesenvolvedor,
    canManageContratos: isGerencia() || isDesenvolvedor,
    canManageApiSettings: isDiretor || hasRole('analista_marketing') || isDesenvolvedor,
    canManageInstalacoes: hasRole('coordenador_monitoramento') || hasRole('instalador_vistoriador') || isGerencia() || isDesenvolvedor,
    canManageRastreadores: hasRole('analista_plataforma') || hasRole('coordenador_monitoramento') || isGerencia() || isDesenvolvedor,
    canViewDashboard: profile?.tipo === 'funcionario',
    canAccessApp: profile?.tipo === 'associado',
    canManageCadastro: hasRole('analista_cadastro') || isGerencia() || isDesenvolvedor,
    canManageOficinas: hasRole('analista_cadastro') || isGerencia() || isDesenvolvedor,
    canManageSinistros: hasRole('analista_cadastro') || isGerencia() || isDesenvolvedor,
    canApproveOS: isGerencia() || isDesenvolvedor,
    canManageContabilidade: isDiretor || hasRole('gerente_comercial') || isDesenvolvedor,
    canManageJuridico: isDiretor || hasRole('gerente_comercial') || hasRole('analista_juridico') || isDesenvolvedor,
    canManageRH: isDiretor || hasRole('gerente_comercial') || isDesenvolvedor,
    canManageMarketing: isDiretor || hasRole('gerente_comercial') || hasRole('analista_marketing') || isDesenvolvedor,
    canManageOuvidoria: isDiretor || hasRole('gerente_comercial') || hasRole('analista_cadastro') || isFuncionario() || isDesenvolvedor,
  };

  return {
    ...permissions,
    roles,
    hasPermission: (key: PermissionKey) => permissions[key] ?? false,
  };
}
