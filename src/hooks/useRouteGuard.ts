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
  const { isAnalistaCadastroOnly, isInstaladorVistoriadorOnly, isVistoriadorBaseOnly, isReguladorOnly, isAnalistaEventosOnly, isSindicanteOnly } = usePermissions();

  useEffect(() => {
    // Regulador só pode acessar /regulador/*
    if (isReguladorOnly) {
      const isInReguladorArea = location.pathname.startsWith('/regulador');
      if (!isInReguladorArea) {
        navigate('/regulador', { replace: true });
        return;
      }
    }

    // Instalador/Vistoriador só pode acessar /instalador/*
    if (isInstaladorVistoriadorOnly) {
      const isInInstaladorArea = location.pathname.startsWith('/instalador');
      if (!isInInstaladorArea) {
        navigate('/instalador', { replace: true });
        return;
      }
    }

    // Vistoriador Base só pode acessar /instalador/* (sem mapa)
    if (isVistoriadorBaseOnly) {
      const isInInstaladorArea = location.pathname.startsWith('/instalador');
      const isMapaRoute = location.pathname === '/instalador/mapa';
      if (!isInInstaladorArea || isMapaRoute) {
        navigate('/instalador', { replace: true });
        return;
      }
    }

    // Analista de eventos - redirecionar das rotas mobile antigas para o sistema web
    if (isAnalistaEventosOnly) {
      if (location.pathname.startsWith('/analista-eventos')) {
        navigate('/dashboard', { replace: true });
        return;
      }
      const allowedPaths = [
        '/dashboard',
        '/eventos',
        '/perfil',
        '/notificacoes',
        '/eventos/solicitacoes-ia',
        '/assistencia',
        '/oficinas',
        '/ordens-servico',
      ];
      const isAllowed = allowedPaths.some(path =>
        location.pathname === path || location.pathname.startsWith(path + '/')
      );
      if (!isAllowed) {
        navigate('/dashboard', { replace: true });
      }
    }

    // Sindicante só pode acessar /sindicante/*, /perfil, /definir-senha
    if (isSindicanteOnly) {
      const allowedPaths = [
        '/sindicante',
        '/perfil',
        '/definir-senha',
        '/notificacoes',
      ];
      const isAllowed = allowedPaths.some(path =>
        location.pathname === path || location.pathname.startsWith(path + '/')
      );
      if (!isAllowed) {
        navigate('/sindicante', { replace: true });
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
  }, [location.pathname, isAnalistaCadastroOnly, isInstaladorVistoriadorOnly, isVistoriadorBaseOnly, isReguladorOnly, isAnalistaEventosOnly, isSindicanteOnly, navigate]);
}
