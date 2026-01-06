import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppBottomNav } from './AppBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { SessionTimeoutProvider } from '@/components/auth/SessionTimeoutProvider';
import { useNotificacoesRealtime } from '@/hooks/useNotificacoesRealtime';
import { Loader2 } from 'lucide-react';

export function AppLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  
  // Ativar realtime para notificações
  useNotificacoesRealtime();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Check if user is logged in
  if (!user) {
    return <Navigate to="/app/login" state={{ from: location }} replace />;
  }

  // Check if user is an associado
  if (profile?.tipo !== 'associado') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <h2 className="mb-2 text-lg font-semibold text-foreground">Acesso Restrito</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Este app é exclusivo para associados PRATIC.
          </p>
          <p className="text-xs text-muted-foreground">
            Se você é funcionário, acesse o sistema interno em{' '}
            <a href="/dashboard" className="text-primary underline">
              /dashboard
            </a>
          </p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
  };


  return (
    <SessionTimeoutProvider variant="app">
      <div className="flex min-h-screen flex-col bg-muted/30">
        <AppHeader />
        <main className="flex-1 overflow-auto pb-[56px] md:pb-0">
          <div className="mx-auto max-w-lg">
            <Outlet />
          </div>
        </main>
        <AppBottomNav />
      </div>
    </SessionTimeoutProvider>
  );
}
