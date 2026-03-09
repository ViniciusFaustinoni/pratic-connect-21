import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePermissions } from './usePermissions';
import { useModuleVisibility, MODULE_ROUTES } from './useModuleVisibility';
import { useAppRoles } from './useAppRoles';
import { useAuth } from '@/contexts/AuthContext';

const ALWAYS_ALLOWED = ['/perfil', '/notificacoes', '/definir-senha', '/acesso-negado'];

/**
 * Hook para proteger rotas baseado no perfil do usuário.
 * Usa a tabela role_module_visibility para determinar quais rotas são acessíveis.
 * Usa redirect_path do app_roles_config para perfis operacionais.
 */
export function useRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isInstaladorVistoriadorOnly, isVistoriadorBaseOnly, isReguladorOnly, isSindicanteOnly } = usePermissions();
  const { visibleModules, isLoading } = useModuleVisibility();
  const { isOnlyOperational, getOperationalRedirectPath } = useAppRoles();
  const { perfis } = useAuth();

  useEffect(() => {
    // Não guardar enquanto carrega
    if (isLoading) return;

    // === Perfis operacionais — redirect dinâmico via app_roles_config ===
    if (isOnlyOperational(perfis)) {
      const redirectPath = getOperationalRedirectPath(perfis);
      if (redirectPath && !location.pathname.startsWith(redirectPath)) {
        // Permitir rotas universais
        const isUniversal = ALWAYS_ALLOWED.some(path =>
          location.pathname === path || location.pathname.startsWith(path + '/')
        );
        if (!isUniversal) {
          navigate(redirectPath, { replace: true });
          return;
        }
      }
    }

    // === Guard dinâmico baseado em visibilidade de módulos ===
    if (visibleModules.length > 0) {
      // Rotas sempre permitidas
      const isAlwaysAllowed = ALWAYS_ALLOWED.some(path =>
        location.pathname === path || location.pathname.startsWith(path + '/')
      );
      if (isAlwaysAllowed) return;

      // Construir prefixos de rota permitidos a partir dos módulos visíveis
      const allowedPrefixes = visibleModules.flatMap(m => MODULE_ROUTES[m] || []);

      const isAllowed = allowedPrefixes.some(prefix =>
        location.pathname === prefix || location.pathname.startsWith(prefix + '/')
      );

      if (!isAllowed) {
        // Redirecionar para a primeira rota do primeiro módulo visível
        const firstModule = visibleModules.includes('dashboard') ? 'dashboard' : visibleModules[0];
        const firstRoute = MODULE_ROUTES[firstModule]?.[0] || '/dashboard';
        navigate(firstRoute, { replace: true });
      }
    }
  }, [location.pathname, isOnlyOperational, getOperationalRedirectPath, perfis, visibleModules, isLoading, navigate]);
}
