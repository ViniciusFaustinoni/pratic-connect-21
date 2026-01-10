import { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  User, Shield, Bell, Building2, Settings,
  Users, KeyRound, Plug, ScrollText, Search,
  ChevronDown, HelpCircle, MessageCircle, Sparkles
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MenuItem {
  path: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface MenuSection {
  category: string;
  categoryIcon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconColor: string;
  adminOnly?: boolean;
  items: MenuItem[];
}

const menuItems: MenuSection[] = [
  {
    category: 'Pessoal',
    categoryIcon: User,
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
    categoryIcon: Users,
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
    categoryIcon: Settings,
    gradient: 'from-emerald-500/20 to-emerald-600/10',
    iconColor: 'text-emerald-500',
    items: [
      { path: '/configuracoes/empresa', label: 'Empresa', sublabel: 'Dados da associação', icon: Building2 },
      { path: '/configuracoes/integracoes', label: 'Integrações', sublabel: 'APIs e serviços', icon: Plug, badge: 'Novo' },
      { path: '/configuracoes/sistema', label: 'Sistema', sublabel: 'Preferências gerais', icon: Settings },
    ]
  }
];

export function ConfiguracoesSidebar() {
  const location = useLocation();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<string[]>(['Pessoal', 'Administração', 'Sistema']);
  
  const isAdmin = profile?.tipo === 'funcionario';

  // Filter items based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;
    
    const query = searchQuery.toLowerCase();
    return menuItems.map(section => ({
      ...section,
      items: section.items.filter(item => 
        item.label.toLowerCase().includes(query) ||
        item.sublabel.toLowerCase().includes(query)
      )
    })).filter(section => section.items.length > 0);
  }, [searchQuery]);

  const toggleSection = (category: string) => {
    setOpenSections(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const isItemActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Find current active section
  const activeSection = menuItems.find(section => 
    section.items.some(item => isItemActive(item.path))
  );

  return (
    <aside className="w-72 shrink-0 hidden lg:flex flex-col h-[calc(100vh-140px)]">
      {/* Search */}
      <div className="px-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar configurações..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/50 border-transparent focus:border-primary/30 focus:bg-background transition-all"
          />
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        <nav className="space-y-2">
          <TooltipProvider delayDuration={300}>
            {filteredSections.map((section) => {
              if (section.adminOnly && !isAdmin) return null;
              
              const isOpen = openSections.includes(section.category);
              const isSectionActive = activeSection?.category === section.category;
              const CategoryIcon = section.categoryIcon;

              return (
                <Collapsible
                  key={section.category}
                  open={isOpen}
                  onOpenChange={() => toggleSection(section.category)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                      isSectionActive 
                        ? "bg-muted text-foreground" 
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}>
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "p-1.5 rounded-md bg-gradient-to-br",
                          section.gradient
                        )}>
                          <CategoryIcon className={cn("h-3.5 w-3.5", section.iconColor)} />
                        </div>
                        <span>{section.category}</span>
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )} />
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                    <div className="mt-1 ml-3 space-y-0.5 border-l-2 border-muted pl-3">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = isItemActive(item.path);
                        
                        return (
                          <Tooltip key={item.path}>
                            <TooltipTrigger asChild>
                              <NavLink
                                to={item.path}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group relative",
                                  isActive 
                                    ? "bg-primary/10 text-primary" 
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                              >
                                {/* Active indicator bar */}
                                {isActive && (
                                  <div className="absolute -left-[15px] top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-full" />
                                )}
                                
                                <div className={cn(
                                  "p-1.5 rounded-md transition-colors",
                                  isActive 
                                    ? "bg-primary/10" 
                                    : "bg-muted/50 group-hover:bg-muted"
                                )}>
                                  <Icon className={cn(
                                    "h-3.5 w-3.5",
                                    isActive ? section.iconColor : "text-muted-foreground group-hover:text-foreground"
                                  )} />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "font-medium truncate",
                                      isActive && "text-primary"
                                    )}>
                                      {item.label}
                                    </span>
                                    {item.badge && (
                                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-primary/10 text-primary border-0">
                                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                        {item.badge}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </NavLink>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[200px]">
                              <p className="font-medium">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </TooltipProvider>
        </nav>
      </ScrollArea>

      {/* Footer Links */}
      <div className="mt-4 pt-4 border-t space-y-1">
        <a
          href="https://docs.pratic.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Documentação</span>
        </a>
        <a
          href="https://wa.me/5500000000000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Suporte</span>
        </a>
      </div>
    </aside>
  );
}
