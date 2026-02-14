import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Home, ClipboardList, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AnalistaEventosGuard } from './AnalistaEventosGuard';
import logoFullDark from '@/assets/logos/logo-full-dark.png';

const NAV_ITEMS = [
  { icon: Home, label: 'Início', path: '/analista-eventos' },
  { icon: ClipboardList, label: 'Eventos', path: '/analista-eventos/fila' },
  { icon: User, label: 'Perfil', path: '/analista-eventos/perfil' },
];

export function AnalistaEventosLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/instalador/login');
  };

  const isActive = (path: string) => {
    if (path === '/analista-eventos') return location.pathname === '/analista-eventos';
    return location.pathname.startsWith(path);
  };

  const getPrimeiroNome = () => {
    if (!profile?.nome) return 'Analista';
    return profile.nome.split(' ')[0];
  };

  const getIniciais = () => {
    if (!profile?.nome) return 'A';
    const partes = profile.nome.split(' ');
    if (partes.length >= 2) return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
    return partes[0][0].toUpperCase();
  };

  return (
    <AnalistaEventosGuard>
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-md mx-auto border-x border-border min-h-screen bg-background flex flex-col relative">
          {/* Header */}
          <header className="sticky top-0 z-50 bg-slate-800 shadow-sm border-b border-slate-700">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <img src={logoFullDark} alt="PRATIC" className="h-9 w-auto" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">{getPrimeiroNome()}</span>
                  <span className="text-xs text-slate-400">Analista de Eventos</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-sky-600 text-white text-xs font-semibold">
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
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto pb-16">
            <Outlet />
          </main>

          {/* Bottom Navigation */}
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800 border-t border-slate-700 max-w-md mx-auto bottom-nav-safe">
            <div className="flex items-center justify-around py-2 pb-safe">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                      active ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', active && 'text-sky-400')} />
                    <span className={cn('text-xs', active ? 'font-medium text-sky-400' : 'text-slate-400')}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </AnalistaEventosGuard>
  );
}
