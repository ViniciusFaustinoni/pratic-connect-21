import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  User, Shield, Bell, Building2, Settings,
  Users, KeyRound, Plug, ScrollText, Menu, ChevronDown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuSection {
  category: string;
  adminOnly?: boolean;
  items: MenuItem[];
}

const menuItems: MenuSection[] = [
  {
    category: 'Conta',
    items: [
      { path: '/configuracoes/meu-perfil', label: 'Meu Perfil', icon: User },
      { path: '/configuracoes/seguranca', label: 'Segurança', icon: Shield },
      { path: '/configuracoes/notificacoes', label: 'Notificações', icon: Bell },
    ]
  },
  {
    category: 'Administração',
    adminOnly: true,
    items: [
      { path: '/configuracoes/usuarios', label: 'Usuários', icon: Users },
      { path: '/configuracoes/perfis', label: 'Perfis', icon: KeyRound },
      { path: '/configuracoes/logs', label: 'Logs', icon: ScrollText },
    ]
  },
  {
    category: 'Geral',
    items: [
      { path: '/configuracoes/empresa', label: 'Empresa', icon: Building2 },
      { path: '/configuracoes/integracoes', label: 'Integrações', icon: Plug },
      { path: '/configuracoes/sistema', label: 'Sistema', icon: Settings },
    ]
  }
];

export function ConfiguracoesMobileNav() {
  const location = useLocation();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  
  const isAdmin = profile?.tipo === 'funcionario';

  // Find current page
  const currentItem = menuItems.flatMap(s => s.items).find(
    item => location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  );

  const isItemActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="lg:hidden border-b bg-background">
      <div className="p-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" className="gap-2 px-3">
              <Menu className="h-5 w-5" />
              <span className="font-medium">{currentItem?.label || 'Configurações'}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </SheetTrigger>
          
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="p-6 pb-4 border-b">
              <SheetTitle>Configurações</SheetTitle>
            </SheetHeader>
            
            <nav className="p-4 space-y-6">
              {menuItems.map((section) => {
                if (section.adminOnly && !isAdmin) return null;

                return (
                  <div key={section.category}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-3">
                      {section.category}
                    </p>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = isItemActive(item.path);

                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                              isActive
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
