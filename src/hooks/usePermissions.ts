import { useAuth } from '@/contexts/AuthContext';
import { useAppRoles, type AppRoleConfig } from '@/hooks/useAppRoles';

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
  | 'canCreateRoles'
  | 'canManageConsultores'
  | 'canManageEquipe'
  | 'canManageEquipeEstoque'
  | 'canViewReports'
  | 'canEditRotas'
  // Phase 4 capabilities
  | 'canManageComissoes'
  | 'canApproveComissoes'
  | 'canDeleteCotacao'
  | 'canDeleteAssociado'
  | 'canDeleteSinistro'
  | 'canCreateTemplate'
  | 'canEditTemplate'
  | 'canDeleteTemplate'
  | 'canCreateUser'
  | 'canImportUsers'
  | 'canResetPassword'
  | 'canDeleteAtivacao'
  | 'canManageIntegracoes'
  | 'canApproveElegibilidade'
  | 'canViewElegibilidadePendente';

export type CotacaoViewScope = 'own' | 'team' | 'all';

export interface CotacaoPermissions {
  canView: boolean;
  canViewAll: boolean;
  viewScope: CotacaoViewScope;
  canCreate: boolean;
  canEdit: boolean;
  canEditOwnOnly: boolean;
  canDelete: boolean;
  canSend: boolean;
  canCancel: boolean;
  canDuplicate: boolean;
  canValidate: boolean;
  canEditClientData: boolean;
  canEditVehicleData: boolean;
  canViewHistory: boolean;
  canExport: boolean;
  canOverrideValue: boolean;
  canGenerateContract: boolean;
}

/**
 * Hook centralizado de permissões.
 * 
 * Capability permissions (canXxx) são derivadas da tabela app_roles_config.permissions.
 * Identity flags (isXxx) são derivadas de hasRole() (identidade do role).
 * Exclusivity flags (isXxxOnly) são computadas a partir da combinação de roles.
 */
export function usePermissions() {
  const { profile, roles, hasRole, isGerencia, isVendedor, isFuncionario, user, loading: isAuthLoading } = useAuth();
  const { getPermissionsForRoles, isOnlyOperational, getOperationalRedirectPath, isRoleOperational, isLoading: isRolesConfigLoading } = useAppRoles();

  // ============================================
  // PERMISSIONS DERIVADAS DO BANCO
  // ============================================
  const dbPerms = getPermissionsForRoles(roles || []);
  const hasPerm = (key: string): boolean => dbPerms.has(key);

  // ============================================
  // IDENTITY FLAGS (baseadas em role names)
  // Mantidas para compatibilidade — gradualmente migrar para hasPerm()
  // ============================================
  const hasRoleByName = (roleName: string) => roles?.includes(roleName as any) ?? false;

  const isDesenvolvedor = hasRoleByName('desenvolvedor');
  const isAdminMaster = hasRoleByName('admin_master');
  const isDiretor = hasRole('diretor');
  const isAnalistaCadastro = hasRole('analista_cadastro');
  const isCoordenadorMonitoramento = hasRole('coordenador_monitoramento');
  const isInstaladorVistoriador = hasRole('instalador_vistoriador');
  const isRegulador = hasRoleByName('regulador');
  const isAnalistaEventos = hasRoleByName('analista_eventos');
  const isSindicante = hasRoleByName('sindicante');

  const isSuperAdmin = isDesenvolvedor || isAdminMaster;

  // ============================================
  // EXCLUSIVITY FLAGS — agora derivadas do banco via is_operational
  // Se o usuário SÓ tem roles marcados como is_operational, ele é "only".
  // ============================================
  const hasPrivilegedRole = isDiretor || isGerencia() || isDesenvolvedor || isAdminMaster;
  const userIsOnlyOperational = !hasPrivilegedRole && isOnlyOperational(roles || []);

  // Flags específicas para cada role operacional — derivadas dinamicamente
  const isInstaladorVistoriadorOnly = userIsOnlyOperational && isInstaladorVistoriador;
  const isReguladorOnly = userIsOnlyOperational && isRegulador;
  const isSindicanteOnly = userIsOnlyOperational && isSindicante;
  const isAnalistaEventosOnly = userIsOnlyOperational && isAnalistaEventos;
  const isCoordenadorMonitoramentoOnly = userIsOnlyOperational && isCoordenadorMonitoramento;

  // Flags não-operacionais que mantém lógica especial
  const isAnalistaCadastroOnly = isAnalistaCadastro && !hasPrivilegedRole;
  const isVendedorCltOnly = hasRole('vendedor_clt') && !hasPrivilegedRole;
  const isVendedorOnly = isVendedor() && !hasPrivilegedRole && !isAnalistaCadastro;

  const isVistoriadorBase = false;
  const isVistoriadorBaseOnly = false;

  const isPerfilLimitado = isAnalistaCadastroOnly || isVendedorCltOnly ||
    isCoordenadorMonitoramentoOnly || isInstaladorVistoriadorOnly ||
    isVistoriadorBaseOnly || isReguladorOnly || isAnalistaEventosOnly || isSindicanteOnly;

  /** Redirect path para roles operacionais — obtido do banco */
  const operationalRedirectPath = getOperationalRedirectPath(roles || []);

  // ============================================
  // COTAÇÃO PERMISSIONS (role-based logic)
  // ============================================
  const isVendedorCotacao = hasRole('vendedor_clt') || hasRole('vendedor_externo');
  const isAnalistaCotacao = hasRole('analista_cadastro');
  const isGestorCotacao = isDiretor || hasRole('gerente_comercial') || hasRole('supervisor_vendas');

  let cotacaoViewScope: CotacaoViewScope = 'own';
  if (isGestorCotacao || isAnalistaCotacao || isSuperAdmin) {
    cotacaoViewScope = 'all';
  }

  const cotacao: CotacaoPermissions = {
    canView: true,
    canViewAll: isGestorCotacao || isAnalistaCotacao || isSuperAdmin,
    viewScope: cotacaoViewScope,
    canCreate: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
    canEdit: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
    canEditOwnOnly: isVendedorCotacao && !isGestorCotacao && !isSuperAdmin,
    canDelete: isDiretor || isSuperAdmin,
    canSend: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
    canCancel: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
    canDuplicate: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
    canValidate: isAnalistaCotacao || isGestorCotacao || isSuperAdmin,
    canEditClientData: isAnalistaCotacao || isGestorCotacao || isSuperAdmin,
    canEditVehicleData: isAnalistaCotacao || isGestorCotacao || isSuperAdmin,
    canViewHistory: isAnalistaCotacao || isGestorCotacao || isSuperAdmin,
    canExport: isGestorCotacao || isSuperAdmin,
    canOverrideValue: isGestorCotacao || isSuperAdmin,
    canGenerateContract: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
  };

  // ============================================
  // PERMISSÕES FINAIS
  // Capability permissions (canXxx) vêm do banco via getPermissionsForRoles.
  // canViewDashboard e canAccessApp permanecem baseados em tipo.
  // ============================================
  const permissions = {
    // Tipo de usuário
    isFuncionario: profile?.tipo === 'funcionario',
    isAssociado: profile?.tipo === 'associado',
    isPrestador: profile?.tipo === 'prestador',

    // Privilégio alto
    isDesenvolvedor,
    isAdminMaster,

    // Identity flags
    isDiretor,
    isDiretorOnly: isDiretor,
    isGerente: hasRole('gerente_comercial'),
    isSupervisor: hasRole('supervisor_vendas'),
    isSupervisorVendas: hasRole('supervisor_vendas'),
    isGerenciaOrSupervisor: isGerencia() || hasRole('supervisor_vendas'),
    isVendedorClt: hasRole('vendedor_clt'),
    isVendedorExterno: hasRole('vendedor_externo'),
    isAnalistaCadastro,
    isAnalistaCadastroOnly,
    isVendedorCltOnly,
    isVendedorOnly,
    isPerfilLimitado,
    isCoordenadorMonitoramento,
    isCoordenadorMonitoramentoOnly,
    isInstaladorVistoriadorOnly,
    isVistoriadorBase,
    isVistoriadorBaseOnly,
    isRegulador,
    isReguladorOnly,
    isAnalistaEventos,
    isAnalistaEventosOnly,
    isSindicante,
    isSindicanteOnly,
    isAnalistaPlataforma: hasRole('analista_plataforma'),
    isInstaladorVistoriador,
    isAnalistaMarketing: hasRole('analista_marketing'),
    isAnalistaJuridico: hasRole('analista_juridico'),

    // Compostos
    isVendedor: isVendedor(),
    isGerencia: isGerencia(),

    // === CAPABILITY PERMISSIONS (derivadas do banco) ===
    canManagePermissions: hasPerm('canManagePermissions'),
    canApprovePermissionChanges: hasPerm('canApprovePermissionChanges'),
    canCreateRoles: hasPerm('canCreateRoles'),

    canManageUsers: hasPerm('canManageUsers'),
    canManageLeads: hasPerm('canManageLeads'),
    canManagePlanos: hasPerm('canManagePlanos'),
    canManageContratos: hasPerm('canManageContratos'),
    canManageApiSettings: hasPerm('canManageApiSettings'),
    canManageInstalacoes: hasPerm('canManageInstalacoes'),
    canManageEquipeEstoque: hasPerm('canManageEquipeEstoque'),
    canManageRastreadores: hasPerm('canManageRastreadores'),
    canViewDashboard: profile?.tipo === 'funcionario', // baseado em tipo, não role
    canAccessApp: profile?.tipo === 'associado',       // baseado em tipo, não role
    canManageCadastro: hasPerm('canManageCadastro'),
    canManageOficinas: hasPerm('canManageOficinas'),
    canManageSinistros: hasPerm('canManageSinistros'),
    canApproveOS: hasPerm('canApproveOS'),
    canManageContabilidade: hasPerm('canManageContabilidade'),
    canManageJuridico: hasPerm('canManageJuridico'),
    canManageRH: hasPerm('canManageRH'),
    canManageMarketing: hasPerm('canManageMarketing'),
    canManageOuvidoria: hasPerm('canManageOuvidoria'),
    canManageConsultores: hasPerm('canManageConsultores'),
    canManageEquipe: hasPerm('canManageEquipe'),
    canViewReports: hasPerm('canViewReports'),
    canEditRotas: hasPerm('canEditRotas'),

    // === NOVAS CAPABILITY PERMISSIONS (Fase 4) ===
    canManageComissoes: hasPerm('canManageComissoes'),
    canApproveComissoes: hasPerm('canApproveComissoes'),
    canDeleteCotacao: hasPerm('canDeleteCotacao'),
    canDeleteAssociado: hasPerm('canDeleteAssociado'),
    canDeleteSinistro: hasPerm('canDeleteSinistro'),
    canCreateTemplate: hasPerm('canCreateTemplate'),
    canEditTemplate: hasPerm('canEditTemplate'),
    canDeleteTemplate: hasPerm('canDeleteTemplate'),
    canCreateUser: hasPerm('canCreateUser'),
    canImportUsers: hasPerm('canImportUsers'),
    canResetPassword: hasPerm('canResetPassword'),
    canDeleteAtivacao: hasPerm('canDeleteAtivacao'),
    canManageIntegracoes: hasPerm('canManageIntegracoes'),
    canApproveElegibilidade: hasPerm('canApproveElegibilidade'),
    canViewElegibilidadePendente: hasPerm('canViewElegibilidadePendente'),
  };

  return {
    ...permissions,
    roles,
    userId: user?.id,
    cotacao,
    hasPerm,
    operationalRedirectPath,
    userIsOnlyOperational,
    hasPermission: (key: PermissionKey) => permissions[key] ?? false,
    isPermissionsLoading: isRolesConfigLoading || isAuthLoading || (!!user && (roles?.length ?? 0) === 0 && profile?.tipo !== 'associado'),
  };
}
