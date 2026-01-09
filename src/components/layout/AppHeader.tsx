import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, User, Search, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { NotificationBell } from '@/components/layout/NotificationBell';

export function AppHeader() {
  const navigate = useNavigate();
  const { profile, roles, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-40 flex h-[60px] items-center gap-4 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground" />

      {/* Search Field */}
      <div className="hidden md:flex flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar associado, placa..." 
            className="pl-9 bg-card-hover border-border focus:border-border-hover"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <NotificationBell variant="internal" />
        
        {/* Settings */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/configuracoes')}
        >
          <Settings className="h-5 w-5" />
        </Button>
        
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto gap-3 px-2 py-1.5 hover:bg-card-hover">
              <UserAvatar src={profile?.avatar_url} name={profile?.nome} size="sm" />
              <div className="hidden flex-col items-start lg:flex">
                <span className="text-sm font-medium truncate max-w-[150px] text-foreground">
                  {profile?.nome || profile?.email?.split('@')[0] || 'Usuário'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {roles.length > 0 ? ROLE_LABELS[roles[0]] : 'Colaborador'}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="truncate max-w-[180px]">{profile?.nome || profile?.email?.split('@')[0] || 'Usuário'}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {profile?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            {roles.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Perfis: {roles.map((r) => ROLE_LABELS[r]).join(', ')}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate('/perfil')} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/configuracoes')} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={handleSignOut} className="text-accent cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
