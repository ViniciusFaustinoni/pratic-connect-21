import { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Home, Receipt, MapPin, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useNotificacoesRealtime } from '@/hooks/useNotificacoesRealtime';
import { useNotificacoesPreferencias } from '@/hooks/useNotificacoesPreferencias';
import { NotificacoesOnboarding } from '@/components/app/NotificacoesOnboarding';

const NAV_ITEMS = [
  { icon: Home, label: 'Início', path: '/app' },
  { icon: Receipt, label: 'Boletos', path: '/app/boletos' },
  { icon: MapPin, label: 'Rastrear', path: '/app/rastreamento' },
  { icon: Phone, label: 'Ajuda', path: '/app/assistencia' },
  { icon: User, label: 'Perfil', path: '/app/perfil' },
];

export function AppAssociadoLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const { data: preferencias } = useNotificacoesPreferencias();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Ativar realtime (sem som para associados por padrão)
  useNotificacoesRealtime({ enableSound: false });

  // Mostrar onboarding se não foi completado
  useEffect(() => {
    if (preferencias && !preferencias.onboarding_completo) {
      // Pequeno delay para não mostrar imediatamente ao carregar
      const timer = setTimeout(() => setShowOnboarding(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [preferencias]);

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app' || location.pathname === '/app/home';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* CONTAINER MOBILE */}
      <div className="max-w-md mx-auto border-x border-border min-h-screen bg-background flex flex-col">
        
        {/* HEADER FIXO */}
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="h-14 px-4 flex items-center justify-between">
            {/* LOGO */}
            <Link to="/app" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">P</span>
              </div>
              <span className="font-bold text-lg text-foreground">PRATIC</span>
            </Link>

          </div>
        </header>

        {/* ÁREA DE CONTEÚDO */}
        <main className="flex-1 overflow-y-auto pb-24">
          {children || <Outlet />}
        </main>

        {/* BOTTOM NAVIGATION */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
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
                        ? 'text-primary' 
                        : 'text-muted-foreground hover:text-primary'
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
          <div className="h-safe-area-inset-bottom bg-background" />
        </nav>

      </div>

      {/* Onboarding Modal */}
      <NotificacoesOnboarding 
        open={showOnboarding} 
        onOpenChange={setShowOnboarding} 
      />
    </div>
  );
}

export default AppAssociadoLayout;
