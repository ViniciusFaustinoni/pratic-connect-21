import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, FileCheck, AlertTriangle, Settings, LogOut, Download, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { IOSInstallGuide } from '@/components/pwa/IOSInstallGuide';
import { RelatarErroModal } from '@/components/suporte/RelatarErroModal';
import { useMyPendingValidations } from '@/hooks/useErrorReports';
import { TestarCorrecoesSheet } from '@/components/suporte/TestarCorrecoesSheet';
import { Badge } from '@/components/ui/badge';

export function AppUserDropdown() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { canInstall, isIOS, promptInstall, showIOSInstructions, setShowIOSInstructions } = usePWAInstall();
  const [relatarOpen, setRelatarOpen] = useState(false);
  const [testarOpen, setTestarOpen] = useState(false);
  const { data: pendingTests = 0 } = useMyPendingValidations();

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      await promptInstall();
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/app/login');
  };

  const initials = profile?.nome
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => navigate('/app/perfil')}>
          <User className="mr-2 h-4 w-4" />
          Meus Dados
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setRelatarOpen(true)}>
          <Bug className="mr-2 h-4 w-4" />
          Relatar Erro
        </DropdownMenuItem>
        {pendingTests > 0 && (
          <DropdownMenuItem onClick={() => setTestarOpen(true)} className="text-warning focus:text-warning animate-pulse">
            <Bug className="mr-2 h-4 w-4" />
            Testar correções
            <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5">{pendingTests}</Badge>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate('/app/documentos')}>
          <FileCheck className="mr-2 h-4 w-4" />
          Documentos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/app/sinistros')}>
          <AlertTriangle className="mr-2 h-4 w-4" />
          Sinistros
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/app/configuracoes')}>
          <Settings className="mr-2 h-4 w-4" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 flex items-center justify-between">
          <span className="text-sm">Tema</span>
          <ThemeToggle />
        </div>
        {canInstall && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleInstall} className="text-primary focus:text-primary">
              <Download className="mr-2 h-4 w-4" />
              Instalar App
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <IOSInstallGuide 
      open={showIOSInstructions} 
      onOpenChange={setShowIOSInstructions} 
    />
    </>
  );
}
