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
  const { isAnalistaCadastroOnly, isInstaladorVistoriadorOnly } = usePermissions();

  useEffect(() => {
    // Instalador/Vistoriador só pode acessar /instalador/*
    if (isInstaladorVistoriadorOnly) {
      const isInInstaladorArea = location.pathname.startsWith('/instalador');
      
      if (!isInInstaladorArea) {
        navigate('/instalador', { replace: true });
        return;
      }
    }

    // Analista de cadastro - rotas permitidas específicas
    if (isAnalistaCadastroOnly) {
      const allowedPaths = [
        '/dashboard',
        '/cadastro/propostas',
        '/cadastro/documentos',
        '/cadastro/associados',
        '/perfil',
        '/notificacoes',
      ];

      const isAllowed = allowedPaths.some(path => 
        location.pathname === path || location.pathname.startsWith(path + '/')
      );

      if (!isAllowed) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [location.pathname, isAnalistaCadastroOnly, isInstaladorVistoriadorOnly, navigate]);
}
