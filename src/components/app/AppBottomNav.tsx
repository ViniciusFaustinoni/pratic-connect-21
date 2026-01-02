import { NavLink, useLocation } from 'react-router-dom';
import { Home, ReceiptText, MapPin, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { User, FileText, AlertTriangle, Settings, LogOut, Phone } from 'lucide-react';

interface AppBottomNavProps {
  onLogout?: () => void;
}

export function AppBottomNav({ onLogout }: AppBottomNavProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const mainItems = [
    { icon: Home, label: 'Home', path: '/app/home' },
    { icon: ReceiptText, label: 'Boletos', path: '/app/boletos' },
    { icon: MapPin, label: 'Mapa', path: '/app/rastreamento' },
  ];

  const menuItems = [
    { icon: User, label: 'Meu Perfil', path: '/app/perfil' },
    { icon: FileText, label: 'Sinistros', path: '/app/sinistros' },
    { icon: Phone, label: 'Assistência 24h', path: '/app/assistencia' },
    { icon: Settings, label: 'Configurações', path: '/app/configuracoes' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around">
        {mainItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors',
              isActive(item.path)
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className={cn('h-5 w-5', isActive(item.path) && 'text-primary')} />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <Menu className="h-5 w-5" />
              <span className="font-medium">Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="grid gap-2 py-4">
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors',
                    isActive(item.path)
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
              
              <div className="my-2 border-t" />
              
              <Button
                variant="ghost"
                className="flex items-center justify-start gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout?.();
                }}
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Sair</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
