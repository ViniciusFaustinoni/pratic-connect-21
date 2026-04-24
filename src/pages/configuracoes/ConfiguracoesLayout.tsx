import { Outlet, useLocation, Navigate, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  User, Shield, Bell, Users, Calculator, Plug, Settings, Receipt, Bot, Network
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

interface TabItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  diretorOnly?: boolean;
  group: 'conta' | 'empresa' | 'avancado';
}

const tabs: TabItem[] = [
  { path: '/configuracoes/meu-perfil', label: 'Meu Perfil', icon: User, group: 'conta' },
  { path: '/configuracoes/seguranca', label: 'Segurança', icon: Shield, group: 'conta' },
  { path: '/configuracoes/notificacoes', label: 'Notificações', icon: Bell, group: 'conta' },
  { path: '/configuracoes/usuarios-acessos', label: 'Usuários e Acessos', icon: Users, adminOnly: true, group: 'empresa' },
  { path: '/configuracoes/grades-comissao', label: 'Grades de Comissão', icon: Calculator, diretorOnly: true, group: 'empresa' },
  { path: '/configuracoes/atribuicao-comissoes', label: 'Hierarquia de Comissões', icon: Network, diretorOnly: true, group: 'empresa' },
  { path: '/configuracoes/comissionamento-plano', label: 'Comissionamento por Plano', icon: Receipt, diretorOnly: true, group: 'empresa' },
  { path: '/configuracoes/integracoes', label: 'Integrações', icon: Plug, group: 'avancado' },
  { path: '/configuracoes/agente-consultor-ia', label: 'Agente Consultor IA', icon: Bot, diretorOnly: true, group: 'avancado' },
  { path: '/configuracoes/sistema', label: 'Sistema', icon: Settings, group: 'avancado' },
];

const groupLabels: Record<string, string> = {
  conta: 'Minha Conta',
  empresa: 'Empresa',
  avancado: 'Avançado',
};

const groupOrder = ['conta', 'empresa', 'avancado'] as const;

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

  const activeTab = visibleTabs.find(t => isActive(t.path));

  // Group tabs
  const grouped = groupOrder.map(g => ({
    key: g,
    label: groupLabels[g],
    items: visibleTabs.filter(t => t.group === g),
  })).filter(g => g.items.length > 0);

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 min-h-0">
      {/* Sidebar navigation — desktop */}
      <aside className="hidden lg:block w-56 shrink-0 py-1">
        <nav className="sticky top-20 space-y-5">
          {grouped.map((group) => (
            <div key={group.key}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((tab) => {
                  const Icon = tab.icon;
                  const active = isActive(tab.path);
                  return (
                    <NavLink
                      key={tab.path}
                      to={tab.path}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                        active
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                      <span className="truncate">{tab.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile navigation — horizontal compact pills */}
      <nav className="lg:hidden -mx-3 sm:-mx-4 px-3 sm:px-4 pb-4 border-b border-border mb-4">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.path);
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors border',
                  active
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 min-w-0">
        {activeTab && (
          <div className="mb-5">
            <h1 className="text-xl font-bold text-foreground">{activeTab.label}</h1>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
