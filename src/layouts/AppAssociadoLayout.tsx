import { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Home, Receipt, MapPin, MessageCircle, User, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useNotificacoesRealtime } from '@/hooks/useNotificacoesRealtime';
import { useNotificacoesPreferencias } from '@/hooks/useNotificacoesPreferencias';
import { useAppAssociadoRealtime } from '@/hooks/useAppAssociadoRealtime';
import { useNotificacoesNaoLidas } from '@/hooks/useAppAssociado';
import { NotificacoesOnboarding } from '@/components/app/NotificacoesOnboarding';
import { PWAInstallModal } from '@/components/app/PWAInstallModal';
import { usePWAInstall } from '@/hooks/usePWAInstall';

const NAV_ITEMS = [
  { icon: Home, label: 'Início', path: '/app' },
  { icon: Receipt, label: 'Boletos', path: '/app/boletos' },
  { icon: MessageCircle, label: 'Ajuda', path: '/app/chat' },
  { icon: MapPin, label: 'Rastrear', path: '/app/rastreamento' },
  { icon: User, label: 'Perfil', path: '/app/perfil' },
];

const PWA_FIRST_VISIT_KEY = 'pratic_pwa_first_visit_shown';

export function AppAssociadoLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const { data: preferencias } = useNotificacoesPreferencias();
  const { data: notificacoesNaoLidas = 0 } = useNotificacoesNaoLidas();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPWAModal, setShowPWAModal] = useState(false);
  
  const { isInstallable, isInstalled } = usePWAInstall();

  // Ativar realtime para notificações (sem som para associados por padrão)
  useNotificacoesRealtime({ enableSound: false });
  
  // Ativar realtime para status do associado e boletos
  useAppAssociadoRealtime();

  // Mostrar onboarding se não foi completado
  useEffect(() => {
    if (preferencias && !preferencias.onboarding_completo) {
      // Pequeno delay para não mostrar imediatamente ao carregar
      const timer = setTimeout(() => setShowOnboarding(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [preferencias]);

  // Mostrar modal PWA na primeira visita (após o onboarding ou se já completou)
  useEffect(() => {
    const alreadyShown = localStorage.getItem(PWA_FIRST_VISIT_KEY);
    
    // Só mostrar se: não foi mostrado antes, pode instalar, não está instalado, e onboarding já foi fechado ou completado
    if (!alreadyShown && isInstallable && !isInstalled && !showOnboarding) {
      const timer = setTimeout(() => {
        setShowPWAModal(true);
        localStorage.setItem(PWA_FIRST_VISIT_KEY, 'true');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, showOnboarding]);

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app' || location.pathname === '/app/home';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* CONTAINER MOBILE */}
      <div className="max-w-md mx-auto border-x border-gray-200 min-h-screen bg-white flex flex-col">
        
        {/* HEADER FIXO */}
        <header className="sticky top-0 z-50 bg-white shadow-sm">
          <div className="h-14 px-4 flex items-center justify-between">
            {/* LOGO */}
            <Link to="/app" className="flex items-center">
              <span className="font-bold text-xl text-blue-600">PRATIC</span>
            </Link>

            {/* NOTIFICAÇÕES */}
            <Link to="/app/notificacoes" className="relative p-2">
              <Bell className="h-6 w-6 text-gray-600" />
              {notificacoesNaoLidas > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {notificacoesNaoLidas > 9 ? '9+' : notificacoesNaoLidas}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* ÁREA DE CONTEÚDO */}
        <main className="flex-1 overflow-y-auto pb-20">
          {children || <Outlet />}
        </main>

        {/* BOTTOM NAVIGATION */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
          <div className="max-w-md mx-auto">
            <div className="h-16 grid grid-cols-5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 transition-colors',
                      active 
                        ? 'text-blue-600' 
                        : 'text-gray-500 hover:text-blue-600'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Safe area para iPhones com notch */}
          <div className="h-safe-area-inset-bottom bg-white" />
        </nav>

      </div>

      {/* Onboarding Modal */}
      <NotificacoesOnboarding 
        open={showOnboarding} 
        onOpenChange={setShowOnboarding} 
      />

      {/* PWA Install Modal - Primeira visita */}
      <PWAInstallModal 
        open={showPWAModal} 
        onOpenChange={setShowPWAModal} 
      />
    </div>
  );
}

export default AppAssociadoLayout;
