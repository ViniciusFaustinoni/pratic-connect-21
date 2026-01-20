import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Home, ClipboardList, Map, User, Bell, LogOut, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InstaladorGuard } from './InstaladorGuard';

const NAV_ITEMS = [
  { icon: Home, label: 'Início', path: '/instalador' },
  { icon: ClipboardList, label: 'Fila', path: '/instalador/fila' },
  { icon: Map, label: 'Mapa', path: '/instalador/mapa' },
  { icon: User, label: 'Perfil', path: '/instalador/perfil' },
];

export function InstaladorLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/instalador/login');
  };

  const isActive = (path: string) => {
    if (path === '/instalador') {
      return location.pathname === '/instalador';
    }
    return location.pathname.startsWith(path);
  };

  const getPrimeiroNome = () => {
    if (!profile?.nome) return 'Instalador';
    return profile.nome.split(' ')[0];
  };

  const getIniciais = () => {
    if (!profile?.nome) return 'I';
    const partes = profile.nome.split(' ');
    if (partes.length >= 2) {
      return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
    }
    return partes[0][0].toUpperCase();
  };

  return (
    <InstaladorGuard>
      <div className="min-h-screen bg-muted/30">
        {/* Container mobile-first */}
        <div className="max-w-md mx-auto border-x border-border min-h-screen bg-background flex flex-col relative">
          {/* Header */}
          <header className="sticky top-0 z-50 bg-slate-800 shadow-sm border-b border-slate-700">
            <div className="flex items-center justify-between px-4 py-3">
              {/* Logo + Nome */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">
                    {getPrimeiroNome()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isOnline ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-slate-400">Online</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-xs text-slate-400">Offline</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Ações do Header */}
              <div className="flex items-center gap-2">
                {/* Avatar + Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                          {getIniciais()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{profile?.nome}</p>
                      <p className="text-xs text-muted-foreground">{profile?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Conteúdo Principal */}
          <main className="flex-1 pb-20">
            <Outlet />
          </main>

          {/* Bottom Navigation */}
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800 border-t border-slate-700 max-w-md mx-auto">
            <div className="flex items-center justify-around py-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                      active 
                        ? 'text-blue-400' 
                        : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', active && 'text-blue-400')} />
                    <span className={cn(
                      'text-xs',
                      active ? 'font-medium text-blue-400' : 'text-slate-400'
                    )}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </InstaladorGuard>
  );
}
