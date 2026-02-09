import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Home, ClipboardList, Map, User, LogOut } from 'lucide-react';
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
import { InstaladorGuard } from './InstaladorGuard';
import { TelaLocalizacaoBloqueada } from '@/components/vistoriador/TelaLocalizacaoBloqueada';
import { useIniciarServico } from '@/hooks/useIniciarServico';
import { useTarefaAtual } from '@/hooks/useTarefaAtual';
import { toast } from 'sonner';
import { PWAInstallPromptProfissional } from '@/components/pwa/PWAInstallPromptProfissional';
import { PushNotificationBanner } from './PushNotificationBanner';
import logoFullDark from '@/assets/logos/logo-full-dark.png';

const NAV_ITEMS = [
  { icon: Home, label: 'Início', path: '/instalador' },
  { icon: ClipboardList, label: 'Tarefas', path: '/instalador/tarefas' },
  { icon: Map, label: 'Mapa', path: '/instalador/mapa' },
  { icon: User, label: 'Perfil', path: '/instalador/perfil' },
];

export function InstaladorLayout() {
  const { profile, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isRetrying, setIsRetrying] = useState(false);

  // Verificar se é vistoriador base (sem acesso a mapa)
  const isVistoriadorBase = hasRole('vistoriador_base') && !hasRole('instalador_vistoriador');

  // Hooks para verificar localização e tarefa ativa
  const { geoState } = useIniciarServico();
  const { data: tarefaAtual } = useTarefaAtual();

  // Filtrar itens de navegação (vistoriador base não vê mapa)
  const navItems = NAV_ITEMS.filter(item => {
    if (isVistoriadorBase && item.path === '/instalador/mapa') {
      return false;
    }
    return true;
  });

  // Condição: bloquear se localização negada/indisponível E tem tarefa ativa
  // Vistoriador base não precisa de GPS
  // Rotas de execução não devem ser bloqueadas por localização
  const isRotaExecucao = location.pathname.match(
    /\/instalador\/(retirada|vistoria|manutencao|instalacao)\//
  );

  const deveBloqueiarPorLocalizacao = 
    !isVistoriadorBase &&
    !isRotaExecucao &&
    (geoState.status === 'denied' || geoState.status === 'unavailable') &&
    tarefaAtual !== null;

  // Função para tentar novamente obter localização
  const tentarNovamente = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não disponível neste dispositivo');
      return;
    }

    setIsRetrying(true);

    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      toast.success('Localização ativada!');
    } catch (error: any) {
      if (error.code === 1) {
        toast.error('Permissão de localização negada. Ative nas configurações do dispositivo.');
      } else {
        toast.error('Não foi possível obter sua localização. Verifique se o GPS está ativo.');
      }
    } finally {
      setIsRetrying(false);
    }
  }, []);

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
      {/* Tela de Bloqueio por Localização */}
      {deveBloqueiarPorLocalizacao && (
        <TelaLocalizacaoBloqueada 
          onRetry={tentarNovamente} 
          isRetrying={isRetrying} 
        />
      )}

      <div className={cn("min-h-screen bg-muted/30", deveBloqueiarPorLocalizacao && "hidden")}>
        {/* Container mobile-first */}
        <div className="max-w-md mx-auto border-x border-border min-h-screen bg-background flex flex-col relative">
          {/* Header */}
          <header className="sticky top-0 z-50 bg-slate-800 shadow-sm border-b border-slate-700">
            <div className="flex items-center justify-between px-4 py-3">
              {/* Logo + Status */}
              <div className="flex items-center gap-3">
                <img src={logoFullDark} alt="PRATIC" className="h-9 w-auto" />
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
          <main className="flex-1 overflow-hidden pb-16 relative min-h-0">
            {location.pathname.includes('/mapa') ? (
              <div className="absolute inset-0">
                <Outlet />
              </div>
            ) : (
              <div className="h-full overflow-y-auto overscroll-contain">
                {/* Banner de Push Notifications - apenas na home */}
                {location.pathname === '/instalador' && (
                  <div className="pt-4">
                    <PushNotificationBanner />
                  </div>
                )}
                <Outlet />
              </div>
            )}
          </main>

          {/* Bottom Navigation */}
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800 border-t border-slate-700 max-w-md mx-auto bottom-nav-safe">
            <div className="flex items-center justify-around py-2 pb-safe">
              {navItems.map((item) => {
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

          {/* PWA Install Prompt */}
          <PWAInstallPromptProfissional />
        </div>
      </div>
    </InstaladorGuard>
  );
}
