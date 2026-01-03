import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, User, FileCheck, AlertTriangle, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';

const menuItems = [
  { path: '/app/perfil', label: 'Meus Dados', icon: User },
  { path: '/app/documentos', label: 'Documentos', icon: FileCheck },
  { path: '/app/sinistros', label: 'Sinistros', icon: AlertTriangle },
  { path: '/app/configuracoes', label: 'Configurações', icon: Settings },
];

export function AppMobileMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    setOpen(false);
    navigate('/app/login');
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px]">
        <SheetHeader>
          <SheetTitle className="text-left">Menu</SheetTitle>
        </SheetHeader>

        {/* User info */}
        {profile && (
          <div className="mt-4 rounded-lg bg-muted p-3">
            <p className="font-medium text-foreground">{profile.nome}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
        )}

        {/* Menu items */}
        <nav className="mt-6 flex flex-col gap-1">
          {menuItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className="justify-start gap-3"
              onClick={() => handleNavigate(item.path)}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Button>
          ))}
        </nav>

        <Separator className="my-4" />

        {/* Logout */}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Sair da conta
        </Button>
      </SheetContent>
    </Sheet>
  );
}
