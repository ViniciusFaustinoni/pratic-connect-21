import { useState, useEffect, useMemo } from 'react';
import { Package, Shield, Calculator, ShieldCheck, Gavel, MapPin, Settings, Globe, LucideIcon, Store, Cog, Menu, ChevronDown, ChevronRight, ChevronLeft, Layers, Database, Car, Fuel, PanelLeftClose, PanelLeftOpen, ScrollText, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

interface TabItem {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
}

interface TabGroup {
  title: string;
  icon: LucideIcon;
  items: TabItem[];
}

const tabGroups: TabGroup[] = [
  {
    title: 'Produtos',
    icon: Store,
    items: [
      { label: 'Coberturas e Benefícios', shortLabel: 'Cob. & Benef.', icon: Shield, description: 'Catálogo global com valores' },
      { label: 'Linhas e Planos', shortLabel: 'Linhas & Planos', icon: Package, description: 'Hierarquia e montagem de planos' },
    ],
  },
  {
    title: 'Financeiro',
    icon: Calculator,
    items: [
      { label: 'Simulador de Rateio', shortLabel: 'Simulador', icon: Calculator, description: 'Distribuição de custos' },
      { label: 'Configuração do Rateio', shortLabel: 'Config. Rateio', icon: Settings, description: 'Parâmetros e regras' },
    ],
  },
  {
    title: 'Operação',
    icon: Cog,
    items: [
      { label: 'Regras de Venda', shortLabel: 'Regras', icon: Gavel, description: 'Limites e comissões' },
      { label: 'Vistorias', shortLabel: 'Vistorias', icon: MapPin, description: 'Configurações de vistorias e rotas' },
    ],
  },
  {
    title: 'Cadastros',
    icon: Database,
    items: [
      { label: 'Tabelas de Apoio', shortLabel: 'Tabelas de Apoio', icon: Database, description: 'Categorias, regiões, tipos' },
      { label: 'Marcas e Modelos', shortLabel: 'Marcas & Modelos', icon: Car, description: 'Cadastro com importação em lote' },
    ],
  },
  {
    title: 'Logs',
    icon: ScrollText,
    items: [
      { label: 'Log do Sistema', shortLabel: 'Sistema', icon: Activity, description: 'Ações de usuários no sistema' },
      { label: 'Log de Requisições', shortLabel: 'Requisições', icon: Globe, description: 'Chamadas de APIs e funções' },
    ],
  },
];

// Flat list for index mapping
const allItems = tabGroups.flatMap(g => g.items);

function getActiveGroupTitle(activeIndex: number): string | null {
  let idx = 0;
  for (const group of tabGroups) {
    for (const _ of group.items) {
      if (idx === activeIndex) return group.title;
      idx++;
    }
  }
  return null;
}

interface TabNavigationProps {
  active: number;
  onChange: (index: number) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function NavContent({ active, onChange, onSelect }: TabNavigationProps & { onSelect?: () => void }) {
  const activeGroupTitle = getActiveGroupTitle(active);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (activeGroupTitle) initial.add(activeGroupTitle);
    return initial;
  });

  useEffect(() => {
    if (activeGroupTitle) {
      setExpandedGroups(prev => {
        if (prev.has(activeGroupTitle)) return prev;
        const next = new Set(prev);
        next.add(activeGroupTitle);
        return next;
      });
    }
  }, [activeGroupTitle]);

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  let globalIndex = 0;

  return (
    <nav className="py-2 px-3 space-y-1">
      {tabGroups.map((group) => {
        const groupItems = group.items.map((item) => {
          const idx = globalIndex++;
          return { ...item, idx };
        });
        const isGroupActive = groupItems.some(i => i.idx === active);
        const isExpanded = expandedGroups.has(group.title);

        return (
          <Collapsible key={group.title} open={isExpanded} onOpenChange={() => toggleGroup(group.title)}>
            <CollapsibleTrigger asChild>
              <button className={cn(
                'flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-md transition-colors w-full text-left cursor-pointer hover:bg-muted/60',
                isGroupActive ? 'text-foreground' : 'text-muted-foreground'
              )}>
                <group.icon className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] flex-1">{group.title}</span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-normal">{group.items.length}</Badge>
                {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="space-y-0.5">
                {groupItems.map((item) => {
                  const isActive = active === item.idx;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      onClick={() => { onChange(item.idx); onSelect?.(); }}
                      className={cn(
                        'group w-full flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-lg text-left transition-all duration-200 relative',
                        isActive
                          ? 'bg-primary/8 text-foreground shadow-sm ring-1 ring-primary/15'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      )}
                    >
                      <div className={cn(
                        'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-200',
                        isActive ? 'h-5 bg-primary' : 'h-0 bg-transparent'
                      )} />

                      <div className={cn(
                        'flex items-center justify-center h-7 w-7 rounded-md shrink-0 transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/80 text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className={cn('text-[13px] leading-tight truncate', isActive ? 'font-semibold' : 'font-medium')}>{item.shortLabel}</p>
                        <p className={cn('text-[10px] leading-snug mt-0.5 truncate transition-colors', isActive ? 'text-primary/70' : 'text-muted-foreground/70')}>{item.description}</p>
                      </div>

                      {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
  );
}

export function TabNavigation({ active, onChange, collapsed, onToggleCollapse }: TabNavigationProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const currentItem = allItems[active];

  if (isMobile) {
    return (
      <div className="border-b bg-card">
        <div className="p-2">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="gap-2 px-3 w-full justify-start h-10">
                <Menu className="h-4 w-4" />
                <span className="font-medium truncate text-sm">{currentItem?.shortLabel || 'Gestão Comercial'}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="px-5 pt-5 pb-3 border-b">
                <SheetTitle className="text-base">Gestão Comercial</SheetTitle>
              </SheetHeader>
              <NavContent active={active} onChange={onChange} onSelect={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    );
  }

  // Collapsed: show only icons
  if (collapsed) {
    let globalIdx = 0;
    return (
      <aside className="w-12 shrink-0 border-r bg-card/30 flex flex-col items-center py-2 gap-1 transition-all duration-300">
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted/60 text-muted-foreground mb-1"
          title="Expandir menu"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        {tabGroups.flatMap((group) =>
          group.items.map((item) => {
            const idx = globalIdx++;
            const isActive = active === idx;
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => onChange(idx)}
                title={item.shortLabel}
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })
        )}
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 border-r bg-card/30 overflow-y-auto flex flex-col transition-all duration-300">
      <div className="flex items-center justify-end px-3 pt-2">
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/60 text-muted-foreground"
          title="Recolher menu"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <NavContent active={active} onChange={onChange} />
    </aside>
  );
}

export { allItems };
