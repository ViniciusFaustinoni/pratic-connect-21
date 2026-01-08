import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, User } from 'lucide-react';
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
import { UserAvatar } from '@/components/UserAvatar';
import { GlobalBreadcrumb } from '@/components/layout/GlobalBreadcrumb';

export function AppHeader() {
  const navigate = useNavigate();
  const { profile, roles, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-2" />

      {/* Breadcrumb */}
      <GlobalBreadcrumb />

      <div className="ml-auto flex items-center gap-2">
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto gap-3 px-2 py-1.5">
              <UserAvatar src={profile?.avatar_url} name={profile?.nome} size="sm" />
              <div className="hidden flex-col items-start sm:flex">
                <span className="text-sm font-medium truncate max-w-[150px]">
                  {profile?.nome || profile?.email?.split('@')[0] || 'Usuário'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {profile?.email}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="truncate max-w-[180px]">{profile?.nome || profile?.email?.split('@')[0] || 'Usuário'}</span>
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
            <DropdownMenuItem onClick={() => navigate('/perfil')}>
              <User className="mr-2 h-4 w-4" />
              Meu Perfil
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
