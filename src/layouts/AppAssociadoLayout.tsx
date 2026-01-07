import { Outlet, useLocation, Link } from 'react-router-dom';
import { Home, Receipt, MapPin, Phone, User, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { icon: Home, label: 'Início', path: '/app' },
  { icon: Receipt, label: 'Boletos', path: '/app/boletos' },
  { icon: MapPin, label: 'Rastrear', path: '/app/rastreamento' },
  { icon: Phone, label: 'Ajuda', path: '/app/assistencia' },
  { icon: User, label: 'Perfil', path: '/app/perfil' },
];

export function AppAssociadoLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const notificacoesNaoLidas = 3; // Mock - substituir por contexto real

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

            {/* NOTIFICAÇÕES */}
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link to="/app/notificacoes">
                <Bell className="h-5 w-5" />
                {notificacoesNaoLidas > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
                    {notificacoesNaoLidas > 9 ? '9+' : notificacoesNaoLidas}
                  </span>
                )}
              </Link>
            </Button>
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
    </div>
  );
}

export default AppAssociadoLayout;
