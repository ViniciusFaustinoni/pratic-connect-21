import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface AnalistaEventosGuardProps {
  children: React.ReactNode;
}

export function AnalistaEventosGuard({ children }: AnalistaEventosGuardProps) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!hasRole('analista_eventos' as any)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Acesso Negado</h1>
          <p className="mt-2 text-slate-400">
            Você não tem permissão para acessar a área do Analista de Eventos.
          </p>
          <button
            onClick={() => window.location.href = '/auth'}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Voltar para Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
