import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface AssociadoGuardProps {
  children: React.ReactNode;
}

/**
 * Guard para rotas que só podem ser acessadas por associados
 * Redireciona funcionários para /dashboard e não autenticados para /app/login
 */
export function AssociadoGuard({ children }: AssociadoGuardProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/app/login" state={{ from: location }} replace />;
  }

  // Verificar primeiro_acesso - forçar definição de senha
  if (profile?.primeiro_acesso) {
    return <Navigate to="/definir-senha" replace />;
  }

  // Se é funcionário, redirecionar para o dashboard interno
  if (profile?.tipo === 'funcionario') {
    return <Navigate to="/dashboard" replace />;
  }

  // Se é prestador, redirecionar para o dashboard (ou área de prestadores quando existir)
  if (profile?.tipo === 'prestador') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
