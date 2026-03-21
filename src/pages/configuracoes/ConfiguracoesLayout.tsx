import { Outlet, useLocation, Navigate, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  User, Shield, Bell, Users, Calculator, Plug, Settings, Receipt, Bot
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

interface TabItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  diretorOnly?: boolean;
}

const tabs: TabItem[] = [
  { path: '/configuracoes/meu-perfil', label: 'Meu Perfil', icon: User },
  { path: '/configuracoes/seguranca', label: 'Segurança', icon: Shield },
  { path: '/configuracoes/notificacoes', label: 'Notificações', icon: Bell },
  { path: '/configuracoes/usuarios-acessos', label: 'Usuários e Acessos', icon: Users, adminOnly: true },
  { path: '/configuracoes/grades-comissao', label: 'Grades de Comissão', icon: Calculator, diretorOnly: true },
  { path: '/configuracoes/comissionamento-plano', label: 'Comissionamento por Plano', icon: Receipt, diretorOnly: true },
  { path: '/configuracoes/integracoes', label: 'Integrações', icon: Plug },
  { path: '/configuracoes/sistema', label: 'Sistema', icon: Settings },
];

export function ConfiguracoesLayout() {
  const location = useLocation();
  const { profile } = useAuth();
  const { isDiretor, isDesenvolvedor } = usePermissions();

  const isAdmin = profile?.tipo === 'funcionario';

  if (location.pathname === '/configuracoes') {
    return <Navigate to="/configuracoes/meu-perfil" replace />;
  }

  const visibleTabs = tabs.filter(tab => {
    if (tab.adminOnly && !isAdmin) return false;
    if (tab.diretorOnly && !isDiretor && !isDesenvolvedor) return false;
    return true;
  });

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground mb-4">Configurações</h1>

      <nav className="border-b mb-6 -mx-3 sm:-mx-4 lg:-mx-6 xl:-mx-8 px-3 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex overflow-x-auto scrollbar-hide gap-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.path);
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors shrink-0",
                  active
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}
