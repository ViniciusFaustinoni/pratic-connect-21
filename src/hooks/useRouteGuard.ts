import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePermissions } from './usePermissions';
import { useModuleVisibility, MODULE_ROUTES } from './useModuleVisibility';
import { useAppRoles } from './useAppRoles';
import { useAuth } from '@/contexts/AuthContext';

const ALWAYS_ALLOWED = ['/perfil', '/notificacoes', '/definir-senha', '/acesso-negado'];

/**
 * Guard de rotas baseado em perfil + acessos extras do banco.
 *
 * Semântica ADITIVA: o usuário pode acessar uma rota se ELA é coberta
 * pelo perfil de acesso (comportamento padrão do app, deixado a cargo
 * das telas/permissões individuais — guard NÃO bloqueia aqui) OU se o
 * módulo correspondente foi concedido como extra via card "Acesso a Módulos".
 *
 * Antes este hook tratava `additionalModules` como filtro restritivo
 * (mostrava SÓ esses módulos), apagando o que o perfil garantia — bug
 * corrigido para overlay aditivo.
 */
export function useRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOnlyOperational, getOperationalRedirectPath } = useAppRoles();
  const { perfis } = useAuth();
  // Mantemos o hook pra invalidar cache em mudanças, mas não bloqueamos por ele.
  const { isLoading } = useModuleVisibility();
  // Evita warning de import não-utilizado das constantes de rotas — pode ser útil futuramente.
  void MODULE_ROUTES;
  void usePermissions;

  useEffect(() => {
    if (isLoading) return;

    // Perfis 100% operacionais (instalador, regulador, sindicante, etc.) — redirect dedicado.
    if (isOnlyOperational(perfis)) {
      const redirectPath = getOperationalRedirectPath(perfis);
      if (redirectPath && !location.pathname.startsWith(redirectPath) && location.pathname !== redirectPath) {
        const isUniversal = ALWAYS_ALLOWED.some(path =>
          location.pathname === path || location.pathname.startsWith(path + '/')
        );
        if (!isUniversal) {
          navigate(redirectPath, { replace: true });
          return;
        }
      }
    }

    // NÃO há mais redirect restritivo aqui. O perfil padrão do usuário libera
    // o que ele pode ver — o card "Acesso a Módulos" só adiciona, nunca remove.
    // Controle fino de cada rota fica a cargo dos guards específicos (AuthGuard,
    // FuncionarioGuard, AssociadoGuard, SindicanteGuard etc.) e das próprias telas.
  }, [location.pathname, isOnlyOperational, getOperationalRedirectPath, perfis, isLoading, navigate]);
}
