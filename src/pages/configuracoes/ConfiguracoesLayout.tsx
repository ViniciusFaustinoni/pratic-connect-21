import { Outlet, NavLink, useLocation, Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  User, Shield, Bell, Building2, Settings,
  Users, KeyRound, Plug, ScrollText, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MenuItem {
  path: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuSection {
  category: string;
  adminOnly?: boolean;
  items: MenuItem[];
}

const menuItems: MenuSection[] = [
  {
    category: 'Pessoal',
    items: [
      { path: '/configuracoes/meu-perfil', label: 'Meu Perfil', sublabel: 'Dados pessoais e foto', icon: User },
      { path: '/configuracoes/seguranca', label: 'Segurança', sublabel: 'Senha e autenticação', icon: Shield },
      { path: '/configuracoes/notificacoes', label: 'Notificações', sublabel: 'Alertas e avisos', icon: Bell },
    ]
  },
  {
    category: 'Administração',
    adminOnly: true,
    items: [
      { path: '/configuracoes/usuarios', label: 'Usuários', sublabel: 'Gerenciar equipe', icon: Users },
      { path: '/configuracoes/perfis', label: 'Perfis e Permissões', sublabel: 'Controle de acesso', icon: KeyRound },
      { path: '/configuracoes/logs', label: 'Logs de Auditoria', sublabel: 'Histórico de ações', icon: ScrollText },
    ]
  },
  {
    category: 'Sistema',
    items: [
      { path: '/configuracoes/empresa', label: 'Empresa', sublabel: 'Dados da associação', icon: Building2 },
      { path: '/configuracoes/integracoes', label: 'Integrações', sublabel: 'APIs e serviços', icon: Plug },
      { path: '/configuracoes/sistema', label: 'Sistema', sublabel: 'Preferências gerais', icon: Settings },
    ]
  }
];

export function ConfiguracoesLayout() {
  const location = useLocation();
  const { profile } = useAuth();
  
  // Verificar se é admin (funcionário = colaborador interno)
  const isAdmin = profile?.tipo === 'funcionario';

  // Redirecionar para meu-perfil se acessar /configuracoes diretamente
  if (location.pathname === '/configuracoes') {
    return <Navigate to="/configuracoes/meu-perfil" replace />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie suas preferências e configurações da conta
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-full max-w-7xl mx-auto flex gap-6 p-4 sm:p-6 lg:p-8">
          
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-72 shrink-0">
            <ScrollArea className="h-[calc(100vh-180px)]">
              <nav className="space-y-6 pr-4">
                {menuItems.map((section) => {
                  // Esconder seção de administração para não-admins
                  if (section.adminOnly && !isAdmin) return null;
                  
                  return (
                    <div key={section.category}>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
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
                              className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group',
                                isActive 
                                  ? 'bg-primary/10 text-primary border border-primary/20' 
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              )}
                            >
                              <div className={cn(
                                'p-1.5 rounded-md',
                                isActive ? 'bg-primary/10' : 'bg-muted group-hover:bg-background'
                              )}>
                                <Icon className={cn(
                                  'h-4 w-4',
                                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                                )} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  'font-medium truncate',
                                  isActive ? 'text-primary' : ''
                                )}>
                                  {item.label}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.sublabel}
                                </p>
                              </div>
                              <ChevronRight className={cn(
                                'h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity',
                                isActive && 'opacity-100 text-primary'
                              )} />
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </ScrollArea>
          </aside>

          {/* Mobile Navigation - Horizontal Scroll */}
          <div className="lg:hidden fixed left-0 right-0 top-[137px] z-10 bg-background border-b px-4 py-2 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {menuItems.flatMap((section) => {
                if (section.adminOnly && !isAdmin) return [];
                return section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  );
                });
              })}
            </div>
          </div>

          {/* Conteúdo */}
          <main className="flex-1 min-w-0 lg:pt-0 pt-14">
            <ScrollArea className="h-[calc(100vh-180px)] lg:h-[calc(100vh-180px)]">
              <div className="pr-4">
                <Outlet />
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>
    </div>
  );
}
