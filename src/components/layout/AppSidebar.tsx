import { useState, useMemo } from 'react';
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
  ChevronRight,
  Shield,
  Wrench,
  MapPin,
  Package,
  PackageX,
  Radio,
  Rocket,
  TrendingUp,
  BarChart3,
  ClipboardList,
  Target,
  Map,
  Building2,
  LucideIcon,
  Phone,
  AlertTriangle,
  Search,
  Truck,
  Briefcase,
  ClipboardCheck,
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
  Key,
  MessageCircle,
  Kanban,
  FilePlus,
  History,
  FileCode,
  User,
  Puzzle,
  Ban,
  RefreshCw,
  ShieldAlert,
  Store,
  Bot,
  Bell,
  Send,
  Layers,
  TrendingDown,
  Database,
  ShieldCheck,
  ShieldQuestion,
  Route,
  CalendarCheck,
  Settings2,
  GraduationCap,
  UserSearch,
  ShoppingCart,
  CheckCircle2,
  Network,
  Coins,
  Wallet,
  Bug,
  Percent,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';
import { useModuleVisibility } from '@/hooks/useModuleVisibility';
import { useModuleItemVisibility, MENU_ITEM_IDS } from '@/hooks/useModuleItemVisibility';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';
import { useAppRoles } from '@/hooks/useAppRoles';
import { useFipeMenorAtivo } from '@/hooks/useFipeMenorAtivo';
import { useBiometriasPendentesCount } from '@/hooks/useBiometriasPendentes';
import { useAprovacoesMonitoramentoCount } from '@/hooks/useAprovacoesMonitoramentoCount';
import { useProcessosOperacionaisCount } from '@/hooks/useProcessosOperacionaisCount';
import { usePropostasPendentesCount } from '@/hooks/usePropostasPendentesCount';

// Mapeamento de cores por grupo/item
const MENU_COLORS: Record<string, string> = {
  dashboard: '#3b82f6',      // Azul
  vendas: '#10b981',         // Verde
  cadastro: '#8b5cf6',       // Roxo
  monitoramento: '#f97316',  // Laranja
  eventos: '#ef4444',        // Vermelho
  assistencia: '#dc2626',    // Vermelho vivo
  oficinas: '#6b7280',       // Cinza escuro
  financeiro: '#eab308',     // Amarelo/Dourado
  cobranca: '#d97706',       // Marrom/Bronze
  contabilidade: '#ec4899',  // Rosa
  juridico: '#1e40af',       // Azul escuro
  rh: '#22c55e',             // Verde claro
  marketing: '#d946ef',      // Magenta
  diretoria: '#fbbf24',      // Dourado
  relatorios: '#6366f1',     // Índigo
  configuracoes: '#94a3b8',  // Cinza
};

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  color?: string;
  hideForDiretor?: boolean;
  badge?: string;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  items: MenuItem[];
  color?: string;
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
      color: MENU_COLORS.dashboard,
    },
    {
      title: 'Tutoriais',
      url: '/tutoriais',
      icon: GraduationCap,
      color: MENU_COLORS.dashboard,
    },
  ],
  groups: [
    {
      id: 'vendas',
      label: 'Vendas',
      icon: TrendingUp,
      permission: 'canManageLeads',
      color: MENU_COLORS.vendas,
      items: [
        { title: 'Cotação', url: '/vendas/cotacoes', icon: Calculator },
        { title: 'Aprovações', url: '/vendas/aprovacoes-fipe', icon: TrendingDown, permission: 'canManageConsultores' },
        { title: 'Equipe Comercial', url: '/vendas/equipe-comercial', icon: FileText, permission: 'canManageConsultores' },
        { title: 'Planos e Benefícios', url: '/vendas/planos-beneficios', icon: BookOpen },
        { title: 'Leads', url: '/vendas/leads', icon: UserPlus, badge: 'Dev' },
      ],
    },
    {
      id: 'cadastro',
      label: 'Cadastro',
      icon: FileText,
      permission: 'canManageCadastro',
      color: MENU_COLORS.cadastro,
      items: [
        { title: 'Chat', url: '/eventos/chat-ia', icon: MessageCircle },
        { title: 'Propostas Pendentes', url: '/cadastro/propostas', icon: ClipboardCheck },
        { title: 'Associados', url: '/cadastro/associados', icon: Users },
        { title: 'Veículos', url: '/cadastro/veiculos', icon: Car },
        { title: 'Processos', url: '/cadastro/processos', icon: ClipboardList },
        { title: 'Recusas do Instalador', url: '/cadastro/recusas-instalador', icon: ShieldAlert },
        { title: 'Biometrias Pendentes', url: '/cadastro/biometrias-pendentes', icon: ShieldQuestion },
        { title: 'Base Antiga', url: '/cadastro/base-antiga', icon: Database },
        { title: 'Fila SGA', url: '/configuracoes/integracoes/sga-hinova', icon: RefreshCw },
    ],
  },
  {
    id: 'monitoramento',
      label: 'Monitoramento',
      icon: MapPin,
      permission: 'canManageInstalacoes',
      color: MENU_COLORS.monitoramento,
      items: [
        { title: 'Equipe', url: '/monitoramento/equipe', icon: Users, permission: 'canManageEquipeEstoque' },
        { title: 'Serviços de Campo', url: '/monitoramento/vistorias-instalacoes-mon', icon: ClipboardCheck },
        { title: 'Calendário', url: '/monitoramento/calendario', icon: Calendar },
        
        { 
          title: 'Rastreadores', 
          url: '/monitoramento/rastreadores', 
          icon: Radio,
          permission: 'canManageRastreadores',
        },
        // Mapa movido para aba dentro de "Serviços de Campo"
        // Ressalvas Pendentes e Imprevistos movidos para abas dentro de "Aprovações"
        // Alertas removido temporariamente
        {
          title: 'Aprovações',
          url: '/monitoramento/aprovacoes-monitoramento',
          icon: ShieldAlert,
        },
        // Prestadores Parceiros movido para aba dentro de "Equipe"
        { title: 'Veículos', url: '/cadastro/veiculos', icon: Car },
      ],
    },
    {
      id: 'relacionamento',
      label: 'Relacionamento',
      icon: MessageCircle,
      color: MENU_COLORS.eventos,
      items: [
        { title: 'Chat', url: '/eventos/chat-ia', icon: MessageCircle },
      ],
    },
    {
      id: 'eventos',
      label: 'Eventos',
      icon: AlertTriangle,
      permission: 'canManageSinistros',
      color: MENU_COLORS.eventos,
      items: [
        { title: 'Dashboard', url: '/eventos/dashboard', icon: BarChart3 },
        { title: 'Chat', url: '/eventos/chat', icon: MessageCircle },
        { title: 'Sinistros', url: '/eventos/sinistros', icon: AlertTriangle },
        { title: 'Pré-Análise', url: '/eventos/pre-analise', icon: ClipboardCheck, permission: 'isDiretor' },
        { title: 'SLA', url: '/eventos/sla', icon: Clock },
        { title: 'Sindicâncias', url: '/eventos/sindicancias', icon: Search },
        { title: 'Sindicantes', url: '/eventos/sindicantes', icon: Building2 },
      ],
    },
    {
      id: 'assistencia',
      label: 'Assistência 24h',
      icon: Phone,
      permission: 'canManageSinistros',
      color: MENU_COLORS.assistencia,
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
      color: MENU_COLORS.oficinas,
      items: [
        { title: 'Oficinas', url: '/oficinas', icon: Building2 },
        { title: 'Auto Centers', url: '/oficinas/auto-centers', icon: Store },
        { title: 'Ordens de Serviço', url: '/ordens-servico', icon: ClipboardList },
        { title: 'Relatórios', url: '/oficinas/relatorios', icon: BarChart3 },
      ],
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: DollarSign,
      permission: 'isGerencia',
      color: MENU_COLORS.financeiro,
      items: [
        { title: 'Dashboard', url: '/financeiro', icon: BarChart3 },
        { title: 'Cobranças (Faturas)', url: '/financeiro/cobrancas', icon: Receipt },
        { title: 'Chat Cobrança', url: '/cobranca/chat', icon: MessageCircle },
        { title: 'Contas a Pagar', url: '/financeiro/contas-pagar', icon: CreditCard },
        { title: 'Faturamento', url: '/financeiro/faturamento', icon: FileText },
        { title: 'Extrato', url: '/financeiro/extrato', icon: List },
        { title: 'Contas Bancárias', url: '/financeiro/contas-bancarias', icon: Building2 },
        { title: 'Venda Externa', url: '/financeiro/venda-externa', icon: Users },
      ],
    },
    {
      id: 'comissoes',
      label: 'Comissões',
      icon: Coins,
      permission: 'isGerencia',
      color: MENU_COLORS.financeiro,
      items: [
        { title: 'Dashboard', url: '/comissoes', icon: BarChart3 },
        { title: 'Grades de Comissão', url: '/comissoes/grades', icon: Calculator, permission: 'isDiretor' },
        { title: 'Hierarquia de Comissões', url: '/comissoes/atribuicao', icon: Network, permission: 'isDiretor' },
        { title: 'Relatório', url: '/comissoes/relatorio', icon: FileText },
        { title: 'Pagamentos', url: '/comissoes/pagamentos', icon: Receipt },
      ],
    },
    {
      id: 'contabilidade',
      label: 'Contabilidade',
      icon: BookOpen,
      permission: 'canManageContabilidade',
      color: MENU_COLORS.contabilidade,
      items: [
        { title: 'Dashboard', url: '/contabilidade', icon: BarChart3 },
        { title: 'Plano de Contas', url: '/contabilidade/plano-contas', icon: List },
        { title: 'Lançamentos', url: '/contabilidade/lancamentos', icon: FileText },
        { title: 'Balancete', url: '/contabilidade/balancete', icon: ClipboardList },
        { title: 'Balanço Patrimonial', url: '/contabilidade/balanco-patrimonial', icon: Scale },
        { title: 'DRE', url: '/contabilidade/dre', icon: TrendingUp },
        { title: 'Fechamento', url: '/contabilidade/fechamento', icon: Lock },
      ],
    },
    {
      id: 'juridico',
      label: 'Jurídico',
      icon: Scale,
      permission: 'canManageJuridico',
      color: MENU_COLORS.juridico,
      items: [
        { title: 'Dashboard', url: '/juridico', icon: BarChart3 },
        { title: 'Casos', url: '/juridico/casos', icon: Briefcase },
        { title: 'Processos', url: '/juridico/processos', icon: FileText },
        { title: 'Advogados', url: '/juridico/advogados', icon: Users },
        { title: 'Prazos', url: '/juridico/prazos', icon: Clock },
        { title: 'Audiências', url: '/juridico/audiencias', icon: Calendar },
        { title: 'Consultas 360', url: '/juridico/consultas', icon: Search },
        { title: 'Pareceres', url: '/juridico/pareceres', icon: HelpCircle },
      ],
    },
    {
      id: 'rh',
      label: 'Recursos Humanos',
      icon: UserCheck,
      permission: 'canManageRH',
      color: MENU_COLORS.rh,
      items: [
        { title: 'Dashboard', url: '/rh', icon: BarChart3 },
        { title: 'Funcionários', url: '/rh/funcionarios', icon: Users },
        { title: 'Jornadas', url: '/rh/jornadas', icon: Clock },
        { title: 'Folha de Pagamento', url: '/rh/folha-pagamento', icon: DollarSign },
        { title: 'Ponto', url: '/rh/ponto', icon: Clock },
        { title: 'Férias', url: '/rh/ferias', icon: Palmtree },
        { title: 'Organograma', url: '/rh/organograma', icon: GitBranch },
        { title: 'Departamentos', url: '/rh/departamentos', icon: Building2 },
        { title: 'Benefícios', url: '/rh/beneficios', icon: Gift },
        { title: 'Treinamentos', url: '/rh/treinamentos', icon: GraduationCap },
        { title: 'Recrutamento', url: '/rh/recrutamento', icon: UserSearch },
      ],
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: Megaphone,
      permission: 'canManageMarketing',
      color: MENU_COLORS.marketing,
      items: [
        { title: 'Dashboard', url: '/marketing', icon: BarChart3 },
        { title: 'Campanhas', url: '/marketing/campanhas', icon: Target },
        { title: 'Canais', url: '/marketing/canais', icon: Radio },
        { title: 'Indicações', url: '/marketing/indicacoes', icon: Gift },
        { title: 'UTMs', url: '/marketing/utms', icon: Link },
        { title: 'Distribuição', url: '/marketing/distribuicao', icon: Users },
        { title: 'Relatórios', url: '/marketing/relatorios', icon: ClipboardList },
        { title: 'Origens de Lead', url: '/marketing/origens', icon: Radio },
      ],
    },
    {
      id: 'diretoria',
      label: 'Diretoria',
      icon: Building2,
      permission: 'isDiretorOnly',
      color: MENU_COLORS.diretoria,
      items: [
        { title: 'Dashboard', url: '/diretoria', icon: BarChart3 },
        { title: 'Gestão Comercial', url: '/diretoria/gestao-comercial', icon: Layers },
        
        { title: 'Fechamento & Rateio', url: '/diretoria/fechamento', icon: PieChart },
        { title: 'Faixas & Cotas', url: '/diretoria/faixas-cotas', icon: Calculator },
        { title: 'Redução de Cota (Regra 1%)', url: '/diretoria/reducao-cota', icon: Percent },
        { title: 'Atuarial', url: '/diretoria/indicadores', icon: TrendingUp },
        { title: 'Aprovações', url: '/diretoria/aprovacoes', icon: CheckCircle2 },
        { title: 'Blacklist', url: '/diretoria/blacklist', icon: Ban },
        { title: 'Relatos de Erros', url: '/diretoria/relatos-erros', icon: Bug },
        { title: 'Configurações', url: '/diretoria/configuracoes', icon: Settings },
        { title: 'Perfis', url: '/diretoria/perfis', icon: Shield },
        { title: 'Logs', url: '/diretoria/logs', icon: FileText },
        { title: 'Relatórios', url: '/diretoria/relatorios', icon: ClipboardList },
        { title: 'Vistorias e Instalações', url: '/diretoria/vistorias-instalacoes', icon: ClipboardList },
      ],
    },
    {
      id: 'documentos',
      label: 'Documentos',
      icon: FileText,
      permission: 'canManageCadastro',
      color: MENU_COLORS.documentos,
      items: [
        { title: 'Gerar Documento', url: '/documentos/gerar', icon: FilePlus, hideForDiretor: true },
        { title: 'Histórico', url: '/documentos/historico', icon: History, hideForDiretor: true },
        { title: 'Templates', url: '/documentos/templates', icon: FileCode },
        { title: 'Aditivos', url: '/documentos/aditivos', icon: FileText },
        { title: 'PDF de Cotação', url: '/documentos/pdf-cotacao', icon: BarChart3 },
      ],
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      icon: PieChart,
      permission: 'canViewReports',
      color: MENU_COLORS.relatorios,
      items: [
        { title: 'Central de Relatórios', url: '/relatorios', icon: BarChart3 },
      ],
    },
  ],
};

const configItems: MenuItem[] = [
  { 
    title: 'Configurações', 
    url: '/configuracoes', 
    icon: Settings,
    permission: 'canViewDashboard',
    color: MENU_COLORS.configuracoes,
  },
];

// Super-grupos para diretores
interface SuperGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  moduleIds: string[];
}

const SUPER_GROUPS: SuperGroup[] = [
  {
    id: 'comercial',
    label: 'Comercial',
    icon: ShoppingCart,
    color: '#10b981',
    moduleIds: ['vendas', 'cadastro'],
  },
  {
    id: 'relacionamento',
    label: 'Relacionamento',
    icon: Users,
    color: '#ef4444',
    moduleIds: ['relacionamento', 'monitoramento', 'cobranca'],
  },
  {
    id: 'administrativo',
    label: 'Administrativo',
    icon: Building2,
    color: '#fbbf24',
    moduleIds: ['diretoria', 'documentos'],
  },
  {
    id: 'em_breve',
    label: 'Em Breve',
    icon: Clock,
    color: '#94a3b8',
    moduleIds: ['eventos', 'assistencia', 'oficinas', 'financeiro', 'comissoes', 'contabilidade', 'juridico', 'rh', 'marketing', 'relatorios'],
  },
];

import React from 'react';

// Logo Component
const PraticLogo = React.forwardRef<HTMLDivElement, { collapsed: boolean }>(
  ({ collapsed }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        {/* Logo icon (collapsed) or full (expanded) */}
        {collapsed ? (
          <img 
            src="/logos/logo-icon-light.png" 
            alt="PRATIC" 
            className="h-10 w-10 object-contain"
          />
        ) : (
          <>
            <img 
              src="/logos/logo-full-light.png" 
              alt="PRATIC Car" 
              className="h-10 w-auto object-contain dark:hidden"
            />
            <img 
              src="/logos/logo-full-dark.png" 
              alt="PRATIC Car" 
              className="h-10 w-auto object-contain hidden dark:block"
            />
          </>
        )}
      </div>
    );
  }
);
PraticLogo.displayName = "PraticLogo";

// User Card Component
function UserCard() {
  const { profile, roles } = useAuth();
  const { getRoleLabel } = useAppRoles();
  
  return (
    <div className="flex items-center gap-3 rounded-lg bg-card-hover p-3 border-t border-border">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent to-primary opacity-50" />
        <UserAvatar 
          src={profile?.avatar_url} 
          name={profile?.nome} 
          size="sm" 
          className="relative"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {profile?.nome?.split(' ')[0] || 'Usuário'}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {roles.length > 0 ? getRoleLabel(roles[0]) : 'Colaborador'}
        </p>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  // Em mobile o sidebar abre dentro de um Sheet (drawer); sempre renderizar em modo expandido
  // para o diretor (e demais perfis) verem todos os super-grupos, grupos e itens — igual ao desktop expandido.
  const collapsed = state === 'collapsed' && !isMobile;
  
  const handleNavigation = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  const location = useLocation();
  const permissions = usePermissions();
  const { hasRole } = useAuth();
  const { visibleModules, isLoading: isModuleVisLoading } = useModuleVisibility();
  const { isItemVisible } = useModuleItemVisibility();
  const { fipeMenorAtivo } = useFipeMenorAtivo();
  const { data: biometriasPendentesCount = 0 } = useBiometriasPendentesCount();
  const { data: aprovacoesMonCount = 0 } = useAprovacoesMonitoramentoCount();
  const { data: processosOpCount = 0 } = useProcessosOperacionaisCount();
  const { data: propostasPendentesCount = 0 } = usePropostasPendentesCount();

  const isDataLoading = permissions.isPermissionsLoading || isModuleVisLoading;

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };
  
  const isGroupActive = (items: MenuItem[]) => 
    items.some((item) => location.pathname.startsWith(item.url));

  const filterByPermission = (items: MenuItem[]) => 
    items.filter(item => {
      if (item.hideForDiretor && permissions.isDiretor) return false;
      if (!fipeMenorAtivo && item.url === '/vendas/aprovacoes-fipe') return false;
      return !item.permission || permissions.hasPermission(item.permission);
    });

  const filterGroups = (groups: MenuGroup[]) =>
    groups
      .filter(group => !group.permission || permissions.hasPermission(group.permission))
      .map(group => ({
        ...group,
        items: filterByPermission(group.items).filter(item => {
          const itemId = MENU_ITEM_IDS[item.url];
          if (!itemId) return true;
          return isItemVisible(group.id, itemId);
        }),
      }))
      .filter(group => group.items.length > 0);

  // Filtra grupos visíveis usando visibilidade dinâmica do banco (memoizado)
  const visibleGroups = useMemo(() => {
    if (permissions.isSindicanteOnly) {
      return []; // Sindicante não vê nenhum grupo de menu
    }

    let baseGroups = filterGroups(menuConfig.groups);

    // Injetar badges dinâmicos
    baseGroups = baseGroups.map(g => ({
      ...g,
      items: g.items.map(item => {
        if (item.url === '/cadastro/biometrias-pendentes' && biometriasPendentesCount > 0) {
          return { ...item, badge: String(biometriasPendentesCount) };
        }
        if (item.url === '/monitoramento/aprovacoes-monitoramento' && aprovacoesMonCount > 0) {
          return { ...item, badge: String(aprovacoesMonCount) };
        }
        if (item.url === '/cadastro/processos' && processosOpCount > 0) {
          return { ...item, badge: String(processosOpCount) };
        }
        if (item.url === '/cadastro/propostas' && propostasPendentesCount > 0) {
          return { ...item, badge: String(propostasPendentesCount) };
        }
        return item;
      }),
    }));

    // Filtrar por visibilidade de módulos do banco (se carregado)
    if (visibleModules.length > 0) {
      baseGroups = baseGroups.filter(g => visibleModules.includes(g.id));
    }

    // Ajustes de itens específicos por perfil (mantém lógica existente)
    if (permissions.isAnalistaCadastroOnly) {
      baseGroups = baseGroups.map(group => {
        if (group.id === 'cadastro') {
          return {
            ...group,
            items: group.items.filter(item => 
              item.url === '/cadastro/propostas' ||
              item.url === '/cadastro/associados' ||
              item.url === '/cadastro/veiculos' ||
              item.url === '/cadastro/recusas-instalador'
            ),
          };
        }
        return group;
      });
    }
    
    if (permissions.isVendedorOnly) {
      baseGroups = baseGroups.map(group => {
        if (group.id === 'vendas') {
          return {
            ...group,
            items: group.items.filter(item => item.url !== '/vendas/ativacoes'),
          };
        }
        return group;
      });

      // Consultores podem acompanhar suas próprias solicitações em Cadastro › Processos
      if (!baseGroups.some(g => g.id === 'cadastro')) {
        baseGroups.push({
          id: 'cadastro',
          label: 'Cadastro',
          icon: FileText,
          color: MENU_COLORS.cadastro,
          items: [
            { title: 'Processos', url: '/cadastro/processos', icon: ClipboardList },
          ],
        });
      }
    }
    
    return baseGroups;
  }, [permissions, visibleModules, fipeMenorAtivo, biometriasPendentesCount, aprovacoesMonCount, processosOpCount, propostasPendentesCount]);

  const visibleMainItems = useMemo(() => {
    if (permissions.isSindicanteOnly) {
      return [
        { title: 'Dashboard', url: '/sindicante', icon: LayoutDashboard, color: MENU_COLORS.dashboard },
        { title: 'Meus Casos', url: '/sindicante', icon: Search, color: MENU_COLORS.eventos },
      ];
    }
    return filterByPermission(menuConfig.main).filter(item => {
      if (item.url === '/dashboard') {
        return visibleModules.length === 0 || visibleModules.includes('dashboard');
      }
      return true;
    });
  }, [permissions, visibleModules, fipeMenorAtivo]);
  // Visibilidade de configurações baseada no banco
  const showConfigModule = visibleModules.length === 0 || visibleModules.includes('configuracoes');
  const visibleConfigItems = (permissions.isPerfilLimitado || !showConfigModule) ? [] : filterByPermission(configItems);

  const [openGroups, setOpenGroups] = useState<string[]>([]);

  // Super-group state for directors
  const [openSuperGroups, setOpenSuperGroups] = useState<string[]>([]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => 
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleSuperGroup = (sgId: string) => {
    setOpenSuperGroups(prev =>
      prev.includes(sgId)
        ? prev.filter(id => id !== sgId)
        : [...prev, sgId]
    );
  };

  // Build super-groups with their visible sub-groups (for all users)
  const superGroups = useMemo(() => {
    const result = SUPER_GROUPS.map(sg => ({
      ...sg,
      subGroups: sg.moduleIds
        .map(mid => visibleGroups.find(g => g.id === mid))
        .filter(Boolean) as MenuGroup[],
    })).filter(sg => sg.subGroups.length > 0);
    return result;
  }, [visibleGroups]);

  // If user only has one super-group, skip the super-group level
  const useSuperGroupLayout = superGroups.length > 1;

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <PraticLogo collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        {isDataLoading ? (
          /* LOADING STATE */
          <SidebarGroup className="p-3">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 rounded-md bg-sidebar-accent/30 animate-pulse" />
              ))}
            </div>
          </SidebarGroup>
        ) : collapsed ? (
          /* MODO COLAPSADO */
          <SidebarGroup className="p-1">
            <SidebarMenu className="gap-0.5">
              {visibleMainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={cn(
                      "transition-all duration-200",
                      isActive(item.url) 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_10px_hsl(351,84%,49%,0.3)]" 
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <NavLink to={item.url} onClick={handleNavigation}>
                      <item.icon 
                        className="h-4 w-4" 
                        style={{ color: isActive(item.url) ? 'inherit' : item.color }}
                      />
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {useSuperGroupLayout && superGroups.length > 0 ? (
                superGroups.map((sg) => {
                  const sgActive = sg.subGroups.some(g => isGroupActive(g.items));
                  return (
                    <SidebarMenuItem key={sg.id}>
                      <Popover>
                        <PopoverTrigger asChild>
                          <SidebarMenuButton
                            isActive={sgActive}
                            className={cn(
                              "cursor-pointer transition-all duration-200",
                              sgActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_10px_hsl(351,84%,49%,0.3)]"
                                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                            )}
                            tooltip={sg.label}
                          >
                            <sg.icon
                              className="h-4 w-4"
                              style={{ color: sgActive ? 'inherit' : sg.color }}
                            />
                          </SidebarMenuButton>
                        </PopoverTrigger>
                        <PopoverContent
                          side="right"
                          sideOffset={8}
                          align="start"
                          className="w-56 p-2 bg-card border-border max-h-[70vh] overflow-y-auto"
                        >
                          <div className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold text-foreground">
                            <sg.icon className="h-4 w-4" style={{ color: sg.color }} />
                            {sg.label}
                          </div>
                          {sg.subGroups.map((group) => (
                            <div key={group.id} className="mb-1">
                              <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                <group.icon className="h-3 w-3" style={{ color: group.color }} />
                                {group.label}
                              </div>
                              <div className="space-y-0.5 pl-1">
                                {group.items.map((item) => (
                                  <NavLink
                                    key={item.url}
                                    to={item.url}
                                    onClick={handleNavigation}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                                      "hover:bg-sidebar-accent/50 hover:text-foreground",
                                      isActive(item.url) && "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                                    )}
                                  >
                                    <item.icon
                                      className="h-3.5 w-3.5"
                                      style={{ color: isActive(item.url) ? 'inherit' : group.color }}
                                    />
                                    {item.title}
                                  </NavLink>
                                ))}
                              </div>
                            </div>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </SidebarMenuItem>
                  );
                })
              ) : (
                visibleGroups.map((group) => (
                  <SidebarMenuItem key={group.id}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <SidebarMenuButton
                          isActive={isGroupActive(group.items)}
                          className={cn(
                            "cursor-pointer transition-all duration-200",
                            isGroupActive(group.items)
                              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_10px_hsl(351,84%,49%,0.3)]"
                              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                          )}
                          tooltip={group.label}
                        >
                          <group.icon
                            className="h-4 w-4"
                            style={{ color: isGroupActive(group.items) ? 'inherit' : group.color }}
                          />
                        </SidebarMenuButton>
                      </PopoverTrigger>
                      <PopoverContent
                        side="right"
                        sideOffset={8}
                        align="start"
                        className="w-52 p-2 bg-card border-border"
                      >
                        <div className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold text-foreground">
                          <group.icon className="h-4 w-4" style={{ color: group.color }} />
                          {group.label}
                        </div>
                        <div className="space-y-0.5">
                          {group.items.map((item) => (
                            <NavLink
                              key={item.url}
                              to={item.url}
                              onClick={handleNavigation}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                                "hover:bg-sidebar-accent/50 hover:text-foreground",
                                isActive(item.url) && "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                              )}
                            >
                              <item.icon
                                className="h-4 w-4"
                                style={{ color: isActive(item.url) ? 'inherit' : group.color }}
                              />
                              <span className="truncate">{item.title}</span>
                              {item.badge && (
                                <span className="ml-auto shrink-0 whitespace-nowrap tabular-nums text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  {item.badge}
                                </span>
                              )}
                            </NavLink>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </SidebarMenuItem>
                ))
              )}

              {visibleConfigItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={cn(
                      "transition-all duration-200",
                      isActive(item.url) 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_10px_hsl(351,84%,49%,0.3)]" 
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <NavLink to={item.url} onClick={handleNavigation}>
                      <item.icon 
                        className="h-4 w-4" 
                        style={{ color: isActive(item.url) ? 'inherit' : item.color }}
                      />
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : (
          /* MODO EXPANDIDO */
          <>
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
                          className={cn(
                            "transition-all duration-200",
                            isActive(item.url) 
                              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_10px_hsl(351,84%,49%,0.3)]" 
                              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                          )}
                        >
                          <NavLink to={item.url} onClick={handleNavigation}>
                            <item.icon 
                              className="h-4 w-4" 
                              style={{ color: isActive(item.url) ? 'inherit' : item.color }}
                            />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {useSuperGroupLayout && superGroups.length > 0 ? (
              /* SUPER-GRUPOS PARA TODOS OS PERFIS */
              superGroups.map((sg) => (
                <Collapsible
                  key={sg.id}
                  open={openSuperGroups.includes(sg.id)}
                  onOpenChange={() => toggleSuperGroup(sg.id)}
                  className="group/super"
                >
                  <SidebarGroup className="pb-0">
                    <SidebarGroupLabel
                      asChild
                      className="cursor-pointer hover:bg-sidebar-accent/50 transition-colors text-foreground hover:text-foreground font-semibold text-xs uppercase tracking-wider"
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-2">
                        <sg.icon
                          className="h-4 w-4"
                          style={{ color: sg.color }}
                        />
                        <span className="flex-1 text-left">{sg.label}</span>
                        {openSuperGroups.includes(sg.id) ? (
                          <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                        ) : (
                          <ChevronRight className="h-4 w-4 transition-transform duration-200" />
                        )}
                      </CollapsibleTrigger>
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                      {sg.subGroups.map((group) => (
                        <Collapsible
                          key={group.id}
                          open={openGroups.includes(group.id)}
                          onOpenChange={() => toggleGroup(group.id)}
                          className="group/collapsible"
                        >
                          <div className="pl-2">
                            <SidebarGroupLabel
                              asChild
                              className="cursor-pointer hover:bg-sidebar-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                            >
                              <CollapsibleTrigger className="flex w-full items-center gap-2">
                                <group.icon
                                  className="h-3.5 w-3.5"
                                  style={{ color: group.color }}
                                />
                                <span className="flex-1 text-left">{group.label}</span>
                                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                              </CollapsibleTrigger>
                            </SidebarGroupLabel>
                            <CollapsibleContent>
                              <SidebarGroupContent>
                                <SidebarMenu>
                                  {group.items.map((item) => (
                                    <SidebarMenuItem key={item.url}>
                                      <SidebarMenuButton
                                        asChild
                                        isActive={isActive(item.url)}
                                        tooltip={item.title}
                                        className={cn(
                                          "transition-all duration-200 pl-4",
                                          isActive(item.url)
                                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_10px_hsl(351,84%,49%,0.3)]"
                                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                                        )}
                                      >
                                        <NavLink to={item.url} onClick={handleNavigation}>
                                          <item.icon
                                            className="h-4 w-4"
                                            style={{ color: isActive(item.url) ? 'inherit' : group.color }}
                                          />
                                          <span>{item.title}</span>
                                          {item.badge && (
                                            <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                              {item.badge}
                                            </span>
                                          )}
                                        </NavLink>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  ))}
                                </SidebarMenu>
                              </SidebarGroupContent>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </CollapsibleContent>
                  </SidebarGroup>
                </Collapsible>
              ))
            ) : (
              /* GRUPOS NORMAIS PARA NÃO-DIRETORES */
              visibleGroups.map((group) => (
                <Collapsible 
                  key={group.id}
                  open={openGroups.includes(group.id)}
                  onOpenChange={() => toggleGroup(group.id)}
                  className="group/collapsible"
                >
                  <SidebarGroup>
                    <SidebarGroupLabel 
                      asChild 
                      className="cursor-pointer hover:bg-sidebar-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-2">
                        <group.icon 
                          className="h-4 w-4" 
                          style={{ color: group.color }}
                        />
                        <span className="flex-1 text-left">{group.label}</span>
                        <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                      </CollapsibleTrigger>
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {group.items.map((item) => (
                            <SidebarMenuItem key={item.url}>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive(item.url)}
                                tooltip={item.title}
                                className={cn(
                                  "transition-all duration-200",
                                  isActive(item.url) 
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_10px_hsl(351,84%,49%,0.3)]" 
                                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                                )}
                              >
                                <NavLink to={item.url} onClick={handleNavigation}>
                                  <item.icon 
                                    className="h-4 w-4" 
                                    style={{ color: isActive(item.url) ? 'inherit' : group.color }}
                                  />
                                  <span>{item.title}</span>
                                  {item.badge && (
                                    <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                      {item.badge}
                                    </span>
                                  )}
                                </NavLink>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </SidebarGroup>
                </Collapsible>
              ))
            )}
          </>
        )}
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="p-3 border-t border-border">
          {(!showConfigModule || permissions.isPerfilLimitado) ? (
            <div className="space-y-1">
              <NavLink 
                to="/perfil" 
                onClick={handleNavigation}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-3 transition-colors",
                  "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
                  isActive('/perfil') && "bg-sidebar-primary text-sidebar-primary-foreground"
                )}
              >
                <User 
                  className="h-5 w-5" 
                  style={{ color: isActive('/perfil') ? 'inherit' : MENU_COLORS.configuracoes }}
                />
                <span className="text-sm font-medium">Perfil</span>
              </NavLink>
              {(permissions.isVendedorOnly || permissions.isPerfilLimitado || hasRole('supervisor_externo') || hasRole('agencia')) && (
                <NavLink 
                  to="/perfil/conta-corrente" 
                  onClick={handleNavigation}
                  className={cn(
                    "flex items-center gap-3 rounded-lg p-3 transition-colors",
                    "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
                    isActive('/perfil/conta-corrente') && "bg-sidebar-primary text-sidebar-primary-foreground"
                  )}
                >
                  <DollarSign 
                    className="h-5 w-5" 
                    style={{ color: isActive('/perfil/conta-corrente') ? 'inherit' : MENU_COLORS.financeiro }}
                  />
                  <span className="text-sm font-medium">Conta Corrente</span>
                </NavLink>
              )}
            </div>
          ) : (
            <NavLink 
              to="/configuracoes" 
              onClick={handleNavigation}
              className={cn(
                "flex items-center gap-3 rounded-lg p-3 transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
                isActive('/configuracoes') && "bg-sidebar-primary text-sidebar-primary-foreground"
              )}
            >
              <Settings 
                className="h-5 w-5" 
                style={{ color: isActive('/configuracoes') ? 'inherit' : MENU_COLORS.configuracoes }}
              />
              <span className="text-sm font-medium">Configurações</span>
            </NavLink>
          )}
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
