import { Outlet, useLocation, Link } from 'react-router-dom';
import { Home, Receipt, MapPin, HelpCircle, User, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { icon: Home, label: 'Início', path: '/app' },
  { icon: Receipt, label: 'Boletos', path: '/app/boletos' },
  { icon: MapPin, label: 'Rastrear', path: '/app/rastreamento' },
  { icon: HelpCircle, label: 'Ajuda', path: '/app/ajuda' },
  { icon: User, label: 'Perfil', path: '/app/perfil' },
];

export function AppAssociadoLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app' || location.pathname === '/app/home';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="max-w-md mx-auto border-x border-gray-200 min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm h-14 px-4 flex justify-between items-center">
        <Link to="/app" className="font-bold text-xl text-blue-600">
          PRATIC
        </Link>

        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link to="/app/notificacoes">
            <Bell className="h-5 w-5" />
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              3
            </Badge>
          </Link>
        </Button>
      </header>

      {/* Área de Conteúdo */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children || <Outlet />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 z-50 bg-white border-t border-gray-200 max-w-md mx-auto w-full h-16 grid grid-cols-5">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center transition-colors ${
                active 
                  ? 'text-blue-600' 
                  : 'text-gray-500 hover:text-blue-600'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
