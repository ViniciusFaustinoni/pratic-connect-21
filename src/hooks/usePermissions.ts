import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook centralizado de permissões para verificar acessos de forma declarativa
 */
export function usePermissions() {
  const { profile, roles, hasRole, isGerencia, isVendedor, isFuncionario } = useAuth();

  return {
    // Verificações de tipo de usuário
    isFuncionario: profile?.tipo === 'funcionario',
    isAssociado: profile?.tipo === 'associado',
    isPrestador: profile?.tipo === 'prestador',

    // Verificações de perfil/role
    isDiretor: hasRole('diretor'),
    isGerente: hasRole('gerente_comercial'),
    isSupervisor: hasRole('supervisor_vendas'),
    isVendedorClt: hasRole('vendedor_clt'),
    isVendedorExterno: hasRole('vendedor_externo'),
    isAnalistaCadastro: hasRole('analista_cadastro'),
    isCoordenadorMonitoramento: hasRole('coordenador_monitoramento'),
    isAnalistaPlataforma: hasRole('analista_plataforma'),
    isInstaladorVistoriador: hasRole('instalador_vistoriador'),
    isAnalistaMarketing: hasRole('analista_marketing'),

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
    canViewDashboard: isFuncionario(),
    canAccessApp: profile?.tipo === 'associado',

    // Lista de roles do usuário
    roles,
  };
}
