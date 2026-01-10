import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  User, Shield, Bell, Building2, Settings,
  Users, KeyRound, Plug, ScrollText, ChevronDown,
  Menu
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface MenuItem {
  path: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuSection {
  category: string;
  gradient: string;
  iconColor: string;
  adminOnly?: boolean;
  items: MenuItem[];
}

const menuItems: MenuSection[] = [
  {
    category: 'Pessoal',
    gradient: 'from-blue-500/20 to-blue-600/10',
    iconColor: 'text-blue-500',
    items: [
      { path: '/configuracoes/meu-perfil', label: 'Meu Perfil', sublabel: 'Dados pessoais e foto', icon: User },
      { path: '/configuracoes/seguranca', label: 'Segurança', sublabel: 'Senha e autenticação', icon: Shield },
      { path: '/configuracoes/notificacoes', label: 'Notificações', sublabel: 'Alertas e avisos', icon: Bell },
    ]
  },
  {
    category: 'Administração',
    gradient: 'from-purple-500/20 to-purple-600/10',
    iconColor: 'text-purple-500',
    adminOnly: true,
    items: [
      { path: '/configuracoes/usuarios', label: 'Usuários', sublabel: 'Gerenciar equipe', icon: Users },
      { path: '/configuracoes/perfis', label: 'Perfis e Permissões', sublabel: 'Controle de acesso', icon: KeyRound },
      { path: '/configuracoes/logs', label: 'Logs de Auditoria', sublabel: 'Histórico de ações', icon: ScrollText },
    ]
  },
  {
    category: 'Sistema',
    gradient: 'from-emerald-500/20 to-emerald-600/10',
    iconColor: 'text-emerald-500',
    items: [
      { path: '/configuracoes/empresa', label: 'Empresa', sublabel: 'Dados da associação', icon: Building2 },
      { path: '/configuracoes/integracoes', label: 'Integrações', sublabel: 'APIs e serviços', icon: Plug },
      { path: '/configuracoes/sistema', label: 'Sistema', sublabel: 'Preferências gerais', icon: Settings },
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

  const CurrentIcon = currentItem?.icon || Settings;

  return (
    <div className="lg:hidden sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="px-4 py-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between h-12"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <CurrentIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">{currentItem?.label || 'Configurações'}</p>
                  <p className="text-xs text-muted-foreground">{currentItem?.sublabel || 'Selecione uma opção'}</p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </SheetTrigger>
          
          <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
            <SheetHeader className="pb-4">
              <SheetTitle className="flex items-center gap-2">
                <Menu className="h-5 w-5" />
                Configurações
              </SheetTitle>
            </SheetHeader>
            
            <ScrollArea className="h-[calc(80vh-100px)]">
              <nav className="space-y-6 pr-4">
                {menuItems.map((section) => {
                  if (section.adminOnly && !isAdmin) return null;

                  return (
                    <div key={section.category}>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                        {section.category}
                      </h3>
                      <div className="space-y-1">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = location.pathname === item.path || 
                                         location.pathname.startsWith(item.path + '/');
                          
                          return (
                            <NavLink
                              key={item.path}
                              to={item.path}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all",
                                isActive 
                                  ? "bg-primary/10 text-primary border border-primary/20" 
                                  : "text-foreground hover:bg-muted"
                              )}
                            >
                              <div className={cn(
                                "p-2 rounded-lg bg-gradient-to-br",
                                section.gradient
                              )}>
                                <Icon className={cn("h-4 w-4", section.iconColor)} />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{item.label}</p>
                                <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                              </div>
                              {isActive && (
                                <div className="w-2 h-2 rounded-full bg-primary" />
                              )}
                            </NavLink>
                          );
                        })}
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  );
                })}
              </nav>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
