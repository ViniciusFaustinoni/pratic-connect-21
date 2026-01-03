import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface FuncionarioGuardProps {
  children: React.ReactNode;
}

/**
 * Guard para rotas que só podem ser acessadas por funcionários
 * Redireciona associados para /app/home e não autenticados para /auth
 */
export function FuncionarioGuard({ children }: FuncionarioGuardProps) {
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
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Se é associado, redirecionar para o app do associado
  if (profile?.tipo === 'associado') {
    return <Navigate to="/app/home" replace />;
  }

  // Se é prestador, redirecionar para área de prestadores (ou dashboard por enquanto)
  if (profile?.tipo === 'prestador') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
