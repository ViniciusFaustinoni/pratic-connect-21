import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePermissions } from './usePermissions';
import { useModuleVisibility, MODULE_ROUTES } from './useModuleVisibility';

const ALWAYS_ALLOWED = ['/perfil', '/notificacoes', '/definir-senha', '/acesso-negado'];

/**
 * Hook para proteger rotas baseado no perfil do usuário.
 * Usa a tabela role_module_visibility para determinar quais rotas são acessíveis.
 * Mantém redirects hardcoded para perfis com layouts especiais (regulador, instalador, sindicante).
 */
export function useRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isInstaladorVistoriadorOnly, isVistoriadorBaseOnly, isReguladorOnly, isSindicanteOnly } = usePermissions();
  const { visibleModules, isLoading } = useModuleVisibility();

  useEffect(() => {
    // Não guardar enquanto carrega
    if (isLoading) return;

    // === Perfis com layout especial (redirects hardcoded) ===

    // Regulador só pode acessar /regulador/*
    if (isReguladorOnly) {
      if (!location.pathname.startsWith('/regulador')) {
        navigate('/regulador', { replace: true });
        return;
      }
    }

    // Instalador/Vistoriador só pode acessar /instalador/*
    if (isInstaladorVistoriadorOnly) {
      if (!location.pathname.startsWith('/instalador')) {
        navigate('/instalador', { replace: true });
        return;
      }
    }

    // NOTA: Bloqueio de mapa para vistoriador base agora é feito
    // pelo InstaladorLayout via useAlocacaoDiaria, não mais por role.

    // Sindicante só pode acessar /sindicante/*, /perfil, /definir-senha
    if (isSindicanteOnly) {
      const allowedPaths = ['/sindicante', '/perfil', '/definir-senha', '/notificacoes'];
      const isAllowed = allowedPaths.some(path =>
        location.pathname === path || location.pathname.startsWith(path + '/')
      );
      if (!isAllowed) {
        navigate('/sindicante', { replace: true });
        return;
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
  }, [location.pathname, isInstaladorVistoriadorOnly, isVistoriadorBaseOnly, isReguladorOnly, isSindicanteOnly, visibleModules, isLoading, navigate]);
}
