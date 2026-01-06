import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PerfilAcesso } from '@/types/auth';

// ============================================
// TIPOS
// ============================================

interface UseRequireAuthOptions {
  /** URL para redirect se não autenticado (default: '/auth') */
  redirectTo?: string;
  
  /** Perfis permitidos (se vazio, qualquer autenticado pode acessar) */
  allowedPerfis?: PerfilAcesso[];
  
  /** Tipo de usuário permitido */
  allowedTipo?: 'funcionario' | 'associado' | 'prestador' | 'any';
  
  /** URL para redirect se não autorizado (perfil não permitido) */
  unauthorizedRedirect?: string;
  
  /** Preservar URL atual para redirect após login */
  preserveUrl?: boolean;
}

interface UseRequireAuthReturn {
  /** Autenticação verificada e autorizada */
  isReady: boolean;
  
  /** Está carregando verificação */
  isLoading: boolean;
  
  /** Usuário autenticado */
  isAuthenticated: boolean;
  
  /** Usuário autorizado (perfil correto) */
  isAuthorized: boolean;
  
  /** Motivo se não autorizado */
  reason?: 'not_authenticated' | 'not_authorized' | 'wrong_type';
}

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useRequireAuth(options: UseRequireAuthOptions = {}): UseRequireAuthReturn {
  const {
    redirectTo = '/auth',
    allowedPerfis = [],
    allowedTipo = 'any',
    unauthorizedRedirect = '/unauthorized',
    preserveUrl = true,
  } = options;

  const navigate = useNavigate();
  const location = useLocation();
  const { 
    user,
    loading, 
    initialized,
    profile,
    canAccess,
  } = useAuth();

  const [isReady, setIsReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [reason, setReason] = useState<UseRequireAuthReturn['reason']>();

  const isAuthenticated = !!user;
  const isFuncionario = profile?.tipo === 'funcionario';
  const isAssociado = profile?.tipo === 'associado';

  useEffect(() => {
    // Aguardar inicialização do AuthContext
    if (!initialized || loading) {
      return;
    }

    // Verificar autenticação
    if (!isAuthenticated) {
      setReason('not_authenticated');
      setIsAuthorized(false);
      setIsReady(false);

      // Construir URL de redirect
      const redirectUrl = preserveUrl 
        ? `${redirectTo}?returnTo=${encodeURIComponent(location.pathname + location.search)}`
        : redirectTo;

      navigate(redirectUrl, { replace: true });
      return;
    }

    // Verificar tipo de usuário
    if (allowedTipo !== 'any') {
      const tipoMatch = 
        (allowedTipo === 'funcionario' && isFuncionario) ||
        (allowedTipo === 'associado' && isAssociado) ||
        (allowedTipo === 'prestador' && profile?.tipo === 'prestador');

      if (!tipoMatch) {
        setReason('wrong_type');
        setIsAuthorized(false);
        setIsReady(false);

        // Redirect baseado no tipo do usuário
        const targetRedirect = isFuncionario ? '/dashboard' : '/app/home';
        navigate(targetRedirect, { replace: true });
        return;
      }
    }

    // Verificar perfis permitidos
    if (allowedPerfis.length > 0) {
      const hasPermission = canAccess(allowedPerfis);

      if (!hasPermission) {
        setReason('not_authorized');
        setIsAuthorized(false);
        setIsReady(false);
        navigate(unauthorizedRedirect, { replace: true });
        return;
      }
    }

    // Tudo OK
    setIsAuthorized(true);
    setIsReady(true);
    setReason(undefined);

  }, [
    initialized,
    loading,
    isAuthenticated,
    isFuncionario,
    isAssociado,
    profile?.tipo,
    allowedPerfis,
    allowedTipo,
    canAccess,
    navigate,
    location.pathname,
    location.search,
    redirectTo,
    unauthorizedRedirect,
    preserveUrl,
  ]);

  return {
    isReady,
    isLoading: !initialized || loading,
    isAuthenticated,
    isAuthorized,
    reason,
  };
}

// ============================================
// HOOKS ESPECIALIZADOS
// ============================================

/**
 * Hook para páginas do sistema interno (funcionários)
 * Redireciona para /auth se não autenticado
 * Redireciona para /app/home se for associado
 */
export function useRequireFuncionario(allowedPerfis?: PerfilAcesso[]) {
  return useRequireAuth({
    redirectTo: '/auth',
    allowedTipo: 'funcionario',
    allowedPerfis,
    unauthorizedRedirect: '/unauthorized',
  });
}

/**
 * Hook para páginas do App do Associado
 * Redireciona para /app/login se não autenticado
 * Redireciona para /dashboard se for funcionário
 */
export function useRequireAssociado() {
  return useRequireAuth({
    redirectTo: '/app/login',
    allowedTipo: 'associado',
    unauthorizedRedirect: '/app/unauthorized',
  });
}

/**
 * Hook para páginas administrativas (diretores/gerentes)
 */
export function useRequireAdmin() {
  return useRequireAuth({
    redirectTo: '/auth',
    allowedTipo: 'funcionario',
    allowedPerfis: ['diretor', 'gerente_comercial'],
    unauthorizedRedirect: '/unauthorized',
  });
}

/**
 * Hook para páginas de vendas
 */
export function useRequireVendas() {
  return useRequireAuth({
    redirectTo: '/auth',
    allowedTipo: 'funcionario',
    allowedPerfis: [
      'diretor',
      'gerente_comercial',
      'supervisor_vendas',
      'vendedor_clt',
      'vendedor_externo',
    ],
  });
}

/**
 * Hook para páginas de cadastro
 */
export function useRequireCadastro() {
  return useRequireAuth({
    redirectTo: '/auth',
    allowedTipo: 'funcionario',
    allowedPerfis: [
      'diretor',
      'gerente_comercial',
      'analista_cadastro',
    ],
  });
}

/**
 * Hook para páginas de monitoramento
 */
export function useRequireMonitoramento() {
  return useRequireAuth({
    redirectTo: '/auth',
    allowedTipo: 'funcionario',
    allowedPerfis: [
      'diretor',
      'coordenador_monitoramento',
      'analista_plataforma',
      'instalador_vistoriador',
    ],
  });
}

/**
 * Hook para páginas financeiras
 */
export function useRequireFinanceiro() {
  return useRequireAuth({
    redirectTo: '/auth',
    allowedTipo: 'funcionario',
    allowedPerfis: [
      'diretor',
      'gerente_comercial',
    ],
  });
}

/**
 * Hook para páginas jurídicas
 */
export function useRequireJuridico() {
  return useRequireAuth({
    redirectTo: '/auth',
    allowedTipo: 'funcionario',
    allowedPerfis: [
      'diretor',
      'analista_juridico',
    ],
  });
}

// ============================================
// EXPORTS
// ============================================

export type { UseRequireAuthOptions, UseRequireAuthReturn };
