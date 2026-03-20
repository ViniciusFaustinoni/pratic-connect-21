import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  User, Shield, Bell, Building2, Settings,
  Users, KeyRound, Plug, ScrollText, Calculator
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  diretorOnly?: boolean;
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
      { path: '/configuracoes/usuarios-acessos', label: 'Usuários e Acessos', icon: Users },
      
    ]
  },
  {
    category: 'Geral',
    items: [
      
      { path: '/configuracoes/integracoes', label: 'Integrações', icon: Plug },
      { path: '/configuracoes/sistema', label: 'Sistema', icon: Settings },
    ]
  }
];

export function ConfiguracoesSidebar() {
  const location = useLocation();
  const { profile } = useAuth();
  const { isDiretor, isDesenvolvedor } = usePermissions();
  
  const isAdmin = profile?.tipo === 'funcionario';

  const isItemActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="space-y-6">
      {menuItems.map((section) => {
        if (section.adminOnly && !isAdmin) return null;

        return (
          <div key={section.category}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-3">
              {section.category}
            </p>
            <div className="space-y-1">
              {section.items
                .filter(item => !item.diretorOnly || isDiretor || isDesenvolvedor)
                .map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
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
  );
}
