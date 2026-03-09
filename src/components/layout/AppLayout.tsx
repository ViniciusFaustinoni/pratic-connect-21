import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SessionTimeoutProvider } from '@/components/auth/SessionTimeoutProvider';
import { ColaboradorOnboarding } from './ColaboradorOnboarding';
import { useNotificacoesRealtime } from '@/hooks/useNotificacoesRealtime';
import { useNotificacoesPreferencias } from '@/hooks/useNotificacoesPreferencias';
import { useRouteGuard } from '@/hooks/useRouteGuard';

export function AppLayout() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { data: preferencias } = useNotificacoesPreferencias();
  
  // Ativar realtime com som baseado nas preferências
  useNotificacoesRealtime({ 
    enableSound: preferencias?.som_notificacao ?? true 
  });

  // Proteção de rotas baseada no perfil
  useRouteGuard();

  // Mostrar onboarding se não foi completado
  useEffect(() => {
    if (preferencias && !preferencias.onboarding_completo) {
      setShowOnboarding(true);
    }
  }, [preferencias]);

  return (
    <ProtectedRoute allowedTipos={['funcionario']}>
      <SessionTimeoutProvider variant="internal">
        <SidebarProvider>
          <div className="flex h-screen w-full bg-background overflow-x-hidden">
            <AppSidebar />
            <SidebarInset className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
              <AppHeader />
              {/* Main content - single scroll container with overscroll isolation */}
              <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden app-scroll-container">
                <div className="px-3 py-4 sm:px-4 sm:py-6 lg:px-6 xl:px-8 max-w-screen-2xl mx-auto w-full">
                  <Outlet />
                </div>
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
        
        {/* Onboarding Modal */}
        <ColaboradorOnboarding 
          open={showOnboarding} 
          onOpenChange={setShowOnboarding} 
        />
      </SessionTimeoutProvider>
    </ProtectedRoute>
  );
}
