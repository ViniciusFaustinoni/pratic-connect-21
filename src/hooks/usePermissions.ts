import { useAuth } from '@/contexts/AuthContext';

// Grupos de perfis para cotações
const PERFIS_VENDEDOR = ['vendedor_clt', 'vendedor_externo'];
const PERFIS_CADASTRO = ['analista_cadastro'];
const PERFIS_GESTOR = ['diretor', 'gerente_comercial', 'supervisor_vendas'];

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
  | 'canManageEquipeEstoque'
  | 'canViewReports'
  | 'canEditRotas';

export type CotacaoViewScope = 'own' | 'team' | 'all';

export interface CotacaoPermissions {
  // Visualização
  canView: boolean;
  canViewAll: boolean;
  viewScope: CotacaoViewScope;
  
  // CRUD
  canCreate: boolean;
  canEdit: boolean;
  canEditOwnOnly: boolean;
  canDelete: boolean;
  
  // Ações
  canSend: boolean;
  canCancel: boolean;
  canDuplicate: boolean;
  
  // Validação (analista/gestor)
  canValidate: boolean;
  canEditClientData: boolean;
  canEditVehicleData: boolean;
  canViewHistory: boolean;
  
  // Exportação e valores
  canExport: boolean;
  canOverrideValue: boolean;
  canGenerateContract: boolean;
}

/**
 * Hook centralizado de permissões para verificar acessos de forma declarativa
 */
export function usePermissions() {
  const { profile, roles, hasRole, isGerencia, isVendedor, isFuncionario, user } = useAuth();

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

  // Verifica se é APENAS vendedor CLT (sem perfis de gerência ou admin)
  const isVendedorCltOnly = hasRole('vendedor_clt') && 
    !isDiretor && 
    !isGerencia() && 
    !isDesenvolvedor && 
    !isAdminMaster;

  // Verifica se é APENAS vendedor (CLT ou Externo, sem perfis de gerência ou admin)
  const isVendedorOnly = isVendedor() && 
    !isDiretor && 
    !isGerencia() && 
    !isDesenvolvedor && 
    !isAdminMaster &&
    !isAnalistaCadastro;

  // Verifica se é APENAS coordenador de monitoramento (sem perfis de gerência ou admin)
  const isCoordenadorMonitoramento = hasRole('coordenador_monitoramento');
  const isCoordenadorMonitoramentoOnly = isCoordenadorMonitoramento && 
    !isDiretor && 
    !isGerencia() && 
    !isDesenvolvedor && 
    !isAdminMaster;

  // Verifica se é APENAS instalador/vistoriador (sem perfis de gerência ou admin)
  const isInstaladorVistoriador = hasRole('instalador_vistoriador');
  const isInstaladorVistoriadorOnly = isInstaladorVistoriador && 
    !isDiretor && 
    !isGerencia() && 
    !isDesenvolvedor && 
    !isAdminMaster;

  // Verifica se é vistoriador base (apenas vistorias na base, sem mapa)
  const isVistoriadorBase = hasRoleByName('vistoriador_base');
  const isVistoriadorBaseOnly = isVistoriadorBase && 
    !isInstaladorVistoriador &&
    !isDiretor && 
    !isGerencia() && 
    !isDesenvolvedor && 
    !isAdminMaster;

  // Regulador
  const isRegulador = hasRoleByName('regulador');
  const isReguladorOnly = isRegulador &&
    !isDiretor &&
    !isGerencia() &&
    !isDesenvolvedor &&
    !isAdminMaster;

  // Analista de Eventos
  const isAnalistaEventos = hasRoleByName('analista_eventos');
  const isAnalistaEventosOnly = isAnalistaEventos &&
    !isDiretor &&
    !isGerencia() &&
    !isDesenvolvedor &&
    !isAdminMaster;

  // Sindicante
  const isSindicante = hasRoleByName('sindicante');
  const isSindicanteOnly = isSindicante &&
    !isDiretor &&
    !isGerencia() &&
    !isDesenvolvedor &&
    !isAdminMaster;

  // Perfis que devem ver "Perfil" ao invés de "Configurações"
  const isPerfilLimitado = isAnalistaCadastroOnly || isVendedorCltOnly || isCoordenadorMonitoramentoOnly || isInstaladorVistoriadorOnly || isVistoriadorBaseOnly || isReguladorOnly || isAnalistaEventosOnly || isSindicanteOnly;

  // Verificações de grupo para cotações
  const isVendedorCotacao = hasRole('vendedor_clt') || hasRole('vendedor_externo');
  const isAnalistaCotacao = hasRole('analista_cadastro');
  const isGestorCotacao = isDiretor || hasRole('gerente_comercial') || hasRole('supervisor_vendas');
  const isSuperAdmin = isDesenvolvedor || isAdminMaster;

  // Escopo de visualização de cotações
  let cotacaoViewScope: CotacaoViewScope = 'own';
  if (isGestorCotacao || isAnalistaCotacao || isSuperAdmin) {
    cotacaoViewScope = 'all';
  }

  // Permissões específicas de Cotação
  const cotacao: CotacaoPermissions = {
    // Visualização
    canView: true,
    canViewAll: isGestorCotacao || isAnalistaCotacao || isSuperAdmin,
    viewScope: cotacaoViewScope,
    
    // CRUD
    canCreate: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
    canEdit: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
    canEditOwnOnly: isVendedorCotacao && !isGestorCotacao && !isSuperAdmin,
    canDelete: isDiretor || isSuperAdmin, // Apenas diretores e super admins podem excluir (cascata)
    
    // Ações
    canSend: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
    canCancel: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
    canDuplicate: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
    
    // Validação (analista/gestor)
    canValidate: isAnalistaCotacao || isGestorCotacao || isSuperAdmin,
    canEditClientData: isAnalistaCotacao || isGestorCotacao || isSuperAdmin,
    canEditVehicleData: isAnalistaCotacao || isGestorCotacao || isSuperAdmin,
    canViewHistory: isAnalistaCotacao || isGestorCotacao || isSuperAdmin,
    
    // Exportação e valores
    canExport: isGestorCotacao || isSuperAdmin,
    canOverrideValue: isGestorCotacao || isSuperAdmin,
    canGenerateContract: isVendedorCotacao || isGestorCotacao || isSuperAdmin,
  };

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

    // Verificações compostas
    isVendedor: isVendedor(),
    isGerencia: isGerencia(),

    // Permissões de sistema
    canManagePermissions: isDesenvolvedor || isDiretor,
    canApprovePermissionChanges: isDesenvolvedor || isDiretor,
    canCreateRoles: isDesenvolvedor || isDiretor || isAdminMaster,

    // Permissões funcionais
    canManageUsers: isDiretor || isDesenvolvedor || isAdminMaster,
    canManageLeads: isVendedor() || isGerencia(),
    canManagePlanos: isGerencia() || isDesenvolvedor,
    canManageContratos: isGerencia() || isDesenvolvedor,
    canManageApiSettings: isDiretor || hasRole('analista_marketing') || isDesenvolvedor,
    canManageInstalacoes: hasRole('coordenador_monitoramento') || hasRole('instalador_vistoriador') || isGerencia() || isDesenvolvedor,
    canManageEquipeEstoque: hasRole('coordenador_monitoramento') || isGerencia() || isDesenvolvedor || isAdminMaster,
    canManageRastreadores: hasRole('analista_plataforma') || hasRole('coordenador_monitoramento') || isGerencia() || isDesenvolvedor,
    canViewDashboard: profile?.tipo === 'funcionario',
    canAccessApp: profile?.tipo === 'associado',
    canManageCadastro: hasRole('analista_cadastro') || isGerencia() || isDesenvolvedor,
    canManageOficinas: hasRole('analista_cadastro') || isAnalistaEventos || isGerencia() || isDesenvolvedor,
    canManageSinistros: hasRole('analista_cadastro') || isAnalistaEventos || isGerencia() || isDesenvolvedor,
    canApproveOS: isGerencia() || isDesenvolvedor,
    canManageContabilidade: isDiretor || hasRole('gerente_comercial') || isDesenvolvedor,
    canManageJuridico: isDiretor || hasRole('gerente_comercial') || hasRole('analista_juridico') || hasRoleByName('advogado') || isDesenvolvedor,
    canManageRH: isDiretor || hasRole('gerente_comercial') || isDesenvolvedor,
    canManageMarketing: isDiretor || hasRole('gerente_comercial') || hasRole('analista_marketing') || isDesenvolvedor,
    canManageOuvidoria: (isDiretor || hasRole('gerente_comercial') || hasRole('analista_cadastro') || isFuncionario() || isDesenvolvedor) && !isVendedorCotacao && !isAnalistaEventosOnly,
    canManageConsultores: isGerencia() || isDiretor || isDesenvolvedor || isAdminMaster,
    canViewReports: (isGerencia() || isDiretor || isDesenvolvedor || isAdminMaster || isAnalistaCadastro) && !isVendedorCotacao,
    // Permissão para editar rotas (coordenador só pode visualizar)
    canEditRotas: isGerencia() || isDiretor || isDesenvolvedor || isAdminMaster,
  };

  return {
    ...permissions,
    roles,
    userId: user?.id,
    cotacao,
    hasPermission: (key: PermissionKey) => permissions[key] ?? false,
  };
}
