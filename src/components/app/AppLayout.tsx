import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppBottomNav } from './AppBottomNav';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SessionTimeoutProvider } from '@/components/auth/SessionTimeoutProvider';
import { useNotificacoesRealtime } from '@/hooks/useNotificacoesRealtime';

export function AppLayout() {
  // Ativar realtime para notificações
  useNotificacoesRealtime();

  return (
    <ProtectedRoute allowedTipos={['associado']} authRedirect="/app/login">
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
    </ProtectedRoute>
  );
}
