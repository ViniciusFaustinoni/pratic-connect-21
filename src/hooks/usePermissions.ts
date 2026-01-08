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
  | 'isCoordenadorMonitoramento'
  | 'isAnalistaPlataforma'
  | 'isInstaladorVistoriador'
  | 'isAnalistaMarketing'
  | 'isAnalistaJuridico'
  | 'isVendedor'
  | 'isGerencia'
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
  | 'canManageOuvidoria';

/**
 * Hook centralizado de permissões para verificar acessos de forma declarativa
 */
export function usePermissions() {
  const { profile, roles, hasRole, isGerencia, isVendedor, isFuncionario } = useAuth();

  const permissions = {
    // Verificações de tipo de usuário
    isFuncionario: profile?.tipo === 'funcionario',
    isAssociado: profile?.tipo === 'associado',
    isPrestador: profile?.tipo === 'prestador',

    // Verificações de perfil/role
    isDiretor: hasRole('diretor'),
    isDiretorOnly: hasRole('diretor'), // Exclusivo para diretor (não inclui gerente)
    isGerente: hasRole('gerente_comercial'),
    isSupervisor: hasRole('supervisor_vendas'),
    isGerenciaOrSupervisor: isGerencia() || hasRole('supervisor_vendas'),
    isVendedorClt: hasRole('vendedor_clt'),
    isVendedorExterno: hasRole('vendedor_externo'),
    isAnalistaCadastro: hasRole('analista_cadastro'),
    isCoordenadorMonitoramento: hasRole('coordenador_monitoramento'),
    isAnalistaPlataforma: hasRole('analista_plataforma'),
    isInstaladorVistoriador: hasRole('instalador_vistoriador'),
    isAnalistaMarketing: hasRole('analista_marketing'),
    isAnalistaJuridico: hasRole('analista_juridico'),

    // Verificações compostas (alias para funções do AuthContext)
    isVendedor: isVendedor(),
    isGerencia: isGerencia(),

    // Permissões específicas de funcionalidade
    canManageUsers: hasRole('diretor'),
    canManageLeads: isVendedor() || isGerencia(),
    canManagePlanos: isGerencia(),
    canManageContratos: isGerencia(),
    canManageApiSettings: hasRole('diretor') || hasRole('analista_marketing'),
    canManageInstalacoes: hasRole('coordenador_monitoramento') || hasRole('instalador_vistoriador') || isGerencia(),
    canManageRastreadores: hasRole('analista_plataforma') || hasRole('coordenador_monitoramento') || isGerencia(),
    canViewDashboard: profile?.tipo === 'funcionario',
    canAccessApp: profile?.tipo === 'associado',
    canManageCadastro: hasRole('analista_cadastro') || isGerencia(),
    canManageOficinas: hasRole('analista_cadastro') || isGerencia(),
    canManageSinistros: hasRole('analista_cadastro') || isGerencia(),
    canApproveOS: isGerencia(),
    canManageContabilidade: hasRole('diretor') || hasRole('gerente_comercial'),
    canManageJuridico: hasRole('diretor') || hasRole('gerente_comercial') || hasRole('analista_juridico'),
    canManageRH: hasRole('diretor') || hasRole('gerente_comercial'),
    canManageMarketing: hasRole('diretor') || hasRole('gerente_comercial') || hasRole('analista_marketing'),
    canManageOuvidoria: hasRole('diretor') || hasRole('gerente_comercial') || hasRole('analista_cadastro') || isFuncionario(),
  };

  return {
    ...permissions,
    // Lista de roles do usuário
    roles,
    // Função para verificar permissão por chave
    hasPermission: (key: PermissionKey) => permissions[key] ?? false,
  };
}
