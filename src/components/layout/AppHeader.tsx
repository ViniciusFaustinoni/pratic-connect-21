import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, ChevronRight, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/types/database';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/vendas': 'Vendas',
  '/vendas/leads': 'Leads',
  '/vendas/kanban': 'Kanban',
  '/vendas/cotacoes': 'Cotador',
  '/vendas/contratos': 'Contratos',
  '/cadastro': 'Cadastro',
  '/cadastro/associados': 'Associados',
  '/cadastro/veiculos': 'Veículos',
  '/cadastro/documentos': 'Documentos',
  '/monitoramento': 'Monitoramento',
  '/monitoramento/instalacoes': 'Instalações',
  '/monitoramento/rotas': 'Rotas',
  '/monitoramento/estoque': 'Estoque',
  '/monitoramento/rastreadores': 'Rastreadores',
  '/configuracoes': 'Configurações',
};

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, roles, signOut } = useAuth();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((_, index) => {
    const path = '/' + pathParts.slice(0, index + 1).join('/');
    return { path, label: routeLabels[path] || pathParts[index] };
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-2" />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span
              className={
                index === breadcrumbs.length - 1
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground'
              }
            >
              {crumb.label}
            </span>
          </div>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            3
          </span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2 pr-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {profile?.nome?.charAt(0).toUpperCase()}
              </div>
              <span className="hidden font-medium sm:inline-block">
                {profile?.nome?.split(' ')[0]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{profile?.nome}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {profile?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {roles.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Perfis: {roles.map((r) => ROLE_LABELS[r]).join(', ')}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
