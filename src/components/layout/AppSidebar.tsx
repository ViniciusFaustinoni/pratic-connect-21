import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FileText,
  Calculator,
  Car,
  FileCheck,
  Settings,
  ChevronDown,
  Shield,
  Wrench,
  MapPin,
  Package,
  Radio,
  Kanban,
  TrendingUp,
  BarChart3,
  ClipboardList,
  Target,
  Map,
  Building2,
  LucideIcon,
  Phone,
  AlertTriangle,
  Truck,
  DollarSign,
  Receipt,
  CreditCard,
  List,
  Handshake,
  UserX,
  BookOpen,
  Lock,
  Scale,
  Clock,
  Calendar,
  HelpCircle,
  Palmtree,
  UserCheck,
  GitBranch,
  Gift,
  Megaphone,
  Link,
  PieChart,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: PermissionKey;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  items: MenuItem[];
}

const menuConfig: {
  main: MenuItem[];
  groups: MenuGroup[];
} = {
  main: [
    { 
      title: 'Dashboard', 
      url: '/dashboard', 
      icon: LayoutDashboard,
      permission: 'canViewDashboard',
    },
  ],
  groups: [
    {
      id: 'vendas',
      label: 'Vendas',
      icon: TrendingUp,
      permission: 'canManageLeads',
      items: [
        { title: 'Dashboard', url: '/vendas/dashboard', icon: BarChart3 },
        { title: 'Leads', url: '/vendas/leads', icon: UserPlus },
        { title: 'Acompanhamento', url: '/vendas/acompanhamento', icon: Kanban },
        { title: 'Cotador', url: '/vendas/cotacoes', icon: Calculator },
        { title: 'Contratos', url: '/vendas/contratos', icon: FileText },
        { title: 'Metas', url: '/vendas/metas', icon: Target },
        { title: 'Relatórios', url: '/vendas/relatorios', icon: ClipboardList },
      ],
    },
    {
      id: 'cadastro',
      label: 'Cadastro',
      icon: FileText,
      permission: 'canManageCadastro',
      items: [
        { title: 'Associados', url: '/cadastro/associados', icon: Users },
        { title: 'Veículos', url: '/cadastro/veiculos', icon: Car },
        { title: 'Documentos', url: '/cadastro/documentos', icon: FileCheck },
      ],
    },
    {
      id: 'monitoramento',
      label: 'Monitoramento',
      icon: MapPin,
      permission: 'canManageInstalacoes',
      items: [
        { title: 'Instalações', url: '/monitoramento/instalacoes', icon: Wrench },
        { title: 'Rotas', url: '/monitoramento/rotas', icon: MapPin },
        { title: 'Estoque', url: '/monitoramento/estoque', icon: Package },
        { 
          title: 'Rastreadores', 
          url: '/monitoramento/rastreadores', 
          icon: Radio,
          permission: 'canManageRastreadores',
        },
        { 
          title: 'Mapa', 
          url: '/monitoramento/mapa', 
          icon: Map,
          permission: 'canManageRastreadores',
        },
      ],
    },
    {
      id: 'eventos',
      label: 'Eventos',
      icon: AlertTriangle,
      permission: 'canManageSinistros',
      items: [
        { title: 'Dashboard', url: '/eventos/dashboard', icon: BarChart3 },
        { title: 'Sinistros', url: '/eventos/sinistros', icon: AlertTriangle },
      ],
    },
    {
      id: 'assistencia',
      label: 'Assistência 24h',
      icon: Phone,
      permission: 'canManageSinistros',
      items: [
        { title: 'Dashboard', url: '/assistencia', icon: BarChart3 },
        { title: 'Fila de Chamados', url: '/assistencia/chamados', icon: ClipboardList },
        { title: 'Prestadores', url: '/assistencia/prestadores', icon: Truck },
      ],
    },
    {
      id: 'oficinas',
      label: 'Oficinas',
      icon: Wrench,
      permission: 'canManageOficinas',
      items: [
        { title: 'Oficinas', url: '/oficinas', icon: Building2 },
        { title: 'Ordens de Serviço', url: '/ordens-servico', icon: ClipboardList },
      ],
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: DollarSign,
      permission: 'isGerencia',
      items: [
        { title: 'Dashboard', url: '/financeiro', icon: BarChart3 },
        { title: 'Cobranças', url: '/financeiro/cobrancas', icon: Receipt },
        { title: 'Contas a Pagar', url: '/financeiro/contas-pagar', icon: CreditCard },
        { title: 'Faturamento', url: '/financeiro/faturamento', icon: FileText },
        { title: 'Extrato', url: '/financeiro/extrato', icon: List },
      ],
    },
    {
      id: 'cobranca',
      label: 'Cobrança',
      icon: UserX,
      permission: 'isGerencia',
      items: [
        { title: 'Dashboard', url: '/cobranca', icon: BarChart3 },
        { title: 'Inadimplentes', url: '/cobranca/inadimplentes', icon: UserX },
        { title: 'Fila de Trabalho', url: '/cobranca/fila', icon: ClipboardList },
        { title: 'Acordos', url: '/cobranca/acordos', icon: Handshake },
        { title: 'Negativação', url: '/cobranca/negativacao', icon: AlertTriangle },
        { title: 'Régua', url: '/cobranca/regua', icon: List },
      ],
    },
    {
      id: 'contabilidade',
      label: 'Contabilidade',
      icon: BookOpen,
      permission: 'canManageContabilidade',
      items: [
        { title: 'Dashboard', url: '/contabilidade', icon: BarChart3 },
        { title: 'Plano de Contas', url: '/contabilidade/plano-contas', icon: List },
        { title: 'Lançamentos', url: '/contabilidade/lancamentos', icon: FileText },
        { title: 'Balancete', url: '/contabilidade/balancete', icon: ClipboardList },
        { title: 'DRE', url: '/contabilidade/dre', icon: TrendingUp },
        { title: 'Fechamento', url: '/contabilidade/fechamento', icon: Lock },
      ],
    },
    {
      id: 'juridico',
      label: 'Jurídico',
      icon: Scale,
      permission: 'canManageJuridico',
      items: [
        { title: 'Dashboard', url: '/juridico', icon: BarChart3 },
        { title: 'Processos', url: '/juridico/processos', icon: FileText },
        { title: 'Advogados', url: '/juridico/advogados', icon: Users },
        { title: 'Prazos', url: '/juridico/prazos', icon: Clock },
        { title: 'Audiências', url: '/juridico/audiencias', icon: Calendar },
        { title: 'Consultas', url: '/juridico/consultas', icon: HelpCircle },
      ],
    },
    {
      id: 'rh',
      label: 'Recursos Humanos',
      icon: UserCheck,
      permission: 'canManageRH',
      items: [
        { title: 'Dashboard', url: '/rh', icon: BarChart3 },
        { title: 'Funcionários', url: '/rh/funcionarios', icon: Users },
        { title: 'Ponto', url: '/rh/ponto', icon: Clock },
        { title: 'Férias', url: '/rh/ferias', icon: Palmtree },
        { title: 'Organograma', url: '/rh/organograma', icon: GitBranch },
        { title: 'Departamentos', url: '/rh/departamentos', icon: Building2 },
        { title: 'Benefícios', url: '/rh/beneficios', icon: Gift },
      ],
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: Megaphone,
      permission: 'canManageMarketing',
      items: [
        { title: 'Dashboard', url: '/marketing', icon: BarChart3 },
        { title: 'Campanhas', url: '/marketing/campanhas', icon: Target },
        { title: 'Canais', url: '/marketing/canais', icon: Radio },
        { title: 'Indicações', url: '/marketing/indicacoes', icon: Gift },
        { title: 'UTMs', url: '/marketing/utms', icon: Link },
        { title: 'Distribuição', url: '/marketing/distribuicao', icon: Users },
        { title: 'Relatórios', url: '/marketing/relatorios', icon: ClipboardList },
      ],
    },
    {
      id: 'diretoria',
      label: 'Diretoria',
      icon: Building2,
      permission: 'isGerencia',
      items: [
        { title: 'Dashboard', url: '/diretoria', icon: BarChart3 },
        { title: 'Produtos', url: '/diretoria/produtos', icon: Package },
        { title: 'Tabela de Preços', url: '/diretoria/precos', icon: DollarSign },
        { title: 'Rateio', url: '/diretoria/rateios', icon: PieChart },
        { title: 'Atuarial', url: '/diretoria/indicadores', icon: TrendingUp },
        { title: 'Configurações', url: '/diretoria/configuracoes', icon: Settings },
        { title: 'Perfis', url: '/diretoria/perfis', icon: Shield },
        { title: 'Logs', url: '/diretoria/logs', icon: FileText },
        { title: 'Relatórios', url: '/diretoria/relatorios', icon: ClipboardList },
      ],
    },
  ],
};

const configItems: MenuItem[] = [
  { 
    title: 'Configurações', 
    url: '/configuracoes', 
    icon: Settings,
    permission: 'isGerencia',
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { profile } = useAuth();
  const permissions = usePermissions();

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (items: MenuItem[]) => 
    items.some((item) => location.pathname.startsWith(item.url));

  // Filtrar itens por permissão
  const filterByPermission = (items: MenuItem[]) => 
    items.filter(item => !item.permission || permissions.hasPermission(item.permission));

  // Filtrar grupos por permissão
  const filterGroups = (groups: MenuGroup[]) =>
    groups
      .filter(group => !group.permission || permissions.hasPermission(group.permission))
      .map(group => ({
        ...group,
        items: filterByPermission(group.items),
      }))
      .filter(group => group.items.length > 0);

  const visibleMainItems = filterByPermission(menuConfig.main);
  const visibleGroups = filterGroups(menuConfig.groups);
  const visibleConfigItems = filterByPermission(configItems);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "gap-3"
        )}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <Shield className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground">PRATIC</span>
              <span className="text-xs text-sidebar-foreground/70">SGA 2.0</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        {/* Main */}
        {visibleMainItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleMainItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Dynamic Groups */}
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.id}>
            {collapsed ? (
              /* VERSÃO MINIMIZADA: Popover com todos os subitens */
              <SidebarMenu>
                <SidebarMenuItem>
                  <Popover>
                    <PopoverTrigger asChild>
                      <SidebarMenuButton
                        isActive={isGroupActive(group.items)}
                        className="cursor-pointer"
                      >
                        <group.icon className="h-4 w-4" />
                      </SidebarMenuButton>
                    </PopoverTrigger>
                    <PopoverContent 
                      side="right" 
                      sideOffset={8}
                      align="start"
                      className="w-52 p-2"
                    >
                      <div className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold text-foreground">
                        <group.icon className="h-4 w-4" />
                        {group.label}
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item) => (
                          <NavLink 
                            key={item.url} 
                            to={item.url}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                              "hover:bg-accent hover:text-accent-foreground",
                              isActive(item.url) && "bg-accent text-accent-foreground font-medium"
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.title}
                          </NavLink>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </SidebarMenuItem>
              </SidebarMenu>
            ) : (
              /* VERSÃO EXPANDIDA: Collapsible com subitens */
              <Collapsible defaultOpen={isGroupActive(group.items)}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50">
                    <group.icon className="h-4 w-4" />
                    <span>{group.label}</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive(item.url)}
                            tooltip={item.title}
                          >
                            <NavLink to={item.url}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarGroup>
        ))}

      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border space-y-1 py-2">
        {/* Configurações - Agora no Footer */}
        {visibleConfigItems.length > 0 && (
          <SidebarMenu>
            {visibleConfigItems.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={item.title}
                >
                  <NavLink to={item.url}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        )}

        {/* Perfil do Usuário */}
        {profile && (
          <SidebarMenu>
            <SidebarMenuItem>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-10 w-full items-center justify-center">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
                          {profile.nome?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    <div className="flex flex-col">
                      <span className="font-medium">{profile.nome}</span>
                      <span className="text-xs text-muted-foreground">{profile.email}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-3 px-2 py-1.5">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
                      {profile.nome?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate text-sm font-medium text-sidebar-foreground">
                      {profile.nome}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      {profile.email}
                    </span>
                  </div>
                </div>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
