import { Outlet } from 'react-router-dom';
import { useContext } from 'react';
import { AppHeader } from './AppHeader';
import { AppBottomNav } from './AppBottomNav';
import { TestModeBanner } from './TestModeBanner';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import { useNotificacoesRealtime } from '@/hooks/useNotificacoesRealtime';
import { AssociadoContext } from '@/contexts/AssociadoContext';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';

export function AppLayout() {
  // Verificar se o contexto existe antes de usar
  const context = useContext(AssociadoContext);
  
  // Se não houver contexto, renderizar versão mínima (fallback de segurança)
  if (!context) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/30">
        <main className="flex-1 overflow-auto pb-[56px] md:pb-0">
          <div className="mx-auto max-w-lg px-4">
            <Outlet />
          </div>
        </main>
      </div>
    );
  }
  
  const { isTestMode } = context;
  
  // Ativar realtime para notificações
  useNotificacoesRealtime();

  return (
    <ProtectedRoute allowedTipos={['associado']} authRedirect="/app/login" skipAuth={isTestMode}>
        <div className="flex min-h-screen flex-col bg-muted/30">
          <TestModeBanner />
          <AppHeader />
          <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-[56px] md:pb-0">
            <div className="mx-auto max-w-lg px-4">
              <Outlet />
            </div>
          </main>
          <AppBottomNav />
          <PWAInstallPrompt />
        </div>
    </ProtectedRoute>
  );
}
