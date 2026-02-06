import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PerfilAcesso } from '@/types/auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Roles permitidos (usa canAccess para verificar) */
  allowedRoles?: PerfilAcesso[];
  /** Tipos de usuário permitidos */
  allowedTipos?: ('funcionario' | 'associado' | 'prestador')[];
  /** URL de redirect quando não autenticado */
  authRedirect?: string;
  /** Pular autenticação (usado para modo de teste) */
  skipAuth?: boolean;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  allowedTipos,
  authRedirect = '/auth',
  skipAuth = false,
}: ProtectedRouteProps) {
  const { user, profile, loading, initialized, canAccess } = useAuth();
  const location = useLocation();

  // Se skipAuth está ativo (modo de teste), permite acesso direto
  if (skipAuth) {
    return <>{children}</>;
  }

  // Loading state - aguardar profile carregar se temos user mas profile ainda não veio
  // Isso evita decisões prematuras sobre permissões
  if (!initialized || loading || (user && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Não autenticado
  if (!user) {
    return <Navigate to={authRedirect} state={{ from: location }} replace />;
  }

  // Verificar primeiro_acesso - redirecionar para definir senha
  if (profile?.primeiro_acesso) {
    return <Navigate to="/definir-senha" replace />;
  }

  // Verificar tipo (funcionario/associado/prestador)
  if (allowedTipos && allowedTipos.length > 0) {
    const userTipo = profile?.tipo;
    
    if (!userTipo || !allowedTipos.includes(userTipo as 'funcionario' | 'associado' | 'prestador')) {
      // Redirecionar para área correta baseado no tipo
      if (userTipo === 'associado') {
        return <Navigate to="/app/home" replace />;
      } else if (userTipo === 'funcionario') {
        return <Navigate to="/dashboard" replace />;
      } else {
        return <Navigate to={authRedirect} replace />;
      }
    }
  }

  // Verificar roles específicos usando canAccess
  if (allowedRoles && allowedRoles.length > 0 && !canAccess(allowedRoles)) {
    return <Navigate to="/acesso-negado" replace />;
  }

  return <>{children}</>;
}
