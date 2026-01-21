import { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Home, ClipboardList, Map, User, Bell, LogOut, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV_ITEMS = [
  { icon: Home, label: 'Início', path: '/vistoriador/home' },
  { icon: ClipboardList, label: 'Tarefas', path: '/vistoriador/tarefas' },
  { icon: Map, label: 'Mapa', path: '/vistoriador/mapa' },
  { icon: User, label: 'Perfil', path: '/vistoriador/perfil' },
];

interface VistoriadorLayoutProps {
  children?: React.ReactNode;
}

export function VistoriadorLayout({ children }: VistoriadorLayoutProps) {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificacoesPendentes] = useState(0);

  // Detectar status online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getPrimeiroNome = () => {
    if (!profile?.nome) return 'Vistoriador';
    return profile.nome.split(' ')[0];
  };

  const getIniciais = () => {
    if (!profile?.nome) return 'V';
    const partes = profile.nome.split(' ');
    if (partes.length >= 2) {
      return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
    }
    return partes[0][0].toUpperCase();
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Container mobile-first */}
      <div className="max-w-md mx-auto border-x border-border min-h-screen bg-background flex flex-col relative">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background shadow-sm border-b">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Logo + Nome */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                P
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">
                  {getPrimeiroNome()}
                </span>
                <div className="flex items-center gap-1.5">
                  {isOnline ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs text-muted-foreground">Online</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs text-muted-foreground">Offline</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Ações do Header */}
            <div className="flex items-center gap-2">
              {/* Notificações */}
              <Button variant="ghost" size="icon" className="relative" asChild>
                <Link to="/vistoriador/notificacoes">
                  <Bell className="h-5 w-5" />
                  {notificacoesPendentes > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {notificacoesPendentes > 9 ? '9+' : notificacoesPendentes}
                    </Badge>
                  )}
                </Link>
              </Button>

              {/* Avatar + Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getIniciais()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{profile?.nome || 'Vistoriador'}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/vistoriador/perfil" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Meu Perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => signOut()}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Área de Conteúdo */}
        <main className="flex-1 overflow-hidden pb-20">
          <div className="h-full overflow-y-auto px-4 py-4 relative">
            {children || <Outlet />}
          </div>
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-around py-2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors min-w-[64px]',
                      active 
                        ? 'text-primary' 
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', active && 'stroke-[2.5px]')} />
                    <span className={cn(
                      'text-xs',
                      active ? 'font-semibold' : 'font-medium'
                    )}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
