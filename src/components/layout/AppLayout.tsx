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

export function AppLayout() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { data: preferencias } = useNotificacoesPreferencias();
  
  // Ativar realtime com som baseado nas preferências
  useNotificacoesRealtime({ 
    enableSound: preferencias?.som_notificacao ?? true 
  });

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
          <div className="flex h-screen w-full bg-background">
            <AppSidebar />
            <SidebarInset className="flex flex-1 flex-col min-w-0 min-h-0">
              <AppHeader />
              {/* Main content - pages control their own scroll */}
              <main className="flex-1 flex flex-col min-h-0">
                <Outlet />
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
