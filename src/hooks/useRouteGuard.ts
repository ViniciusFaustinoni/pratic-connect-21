import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePermissions } from './usePermissions';

/**
 * Hook para proteger rotas baseado no perfil do usuário.
 * Redireciona usuários que tentam acessar rotas não permitidas.
 */
export function useRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAnalistaCadastroOnly } = usePermissions();

  useEffect(() => {
    if (!isAnalistaCadastroOnly) return;

    // Rotas permitidas para analista de cadastro
    const allowedPaths = [
      '/dashboard',
      '/cadastro/documentos',
      '/cadastro/associados',
      '/perfil',
      '/notificacoes',
    ];

    // Verificar se a rota atual é permitida
    const isAllowed = allowedPaths.some(path => 
      location.pathname === path || location.pathname.startsWith(path + '/')
    );

    if (!isAllowed) {
      // Redirecionar para dashboard se tentar acessar rota não permitida
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, isAnalistaCadastroOnly, navigate]);
}