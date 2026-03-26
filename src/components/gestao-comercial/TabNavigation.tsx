import { useState } from 'react';
import { Package, Shield, Gift, Calculator, ShieldCheck, Gavel, MapPin, Settings, Globe, LucideIcon, Store, Cog, Menu, ChevronDown, ChevronRight, Layers, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
      { label: 'Planos, Produtos e Preços', shortLabel: 'Planos & Preços', icon: Package, description: 'Planos, linhas e faixas FIPE' },
      { label: 'Linhas de Produto', shortLabel: 'Linhas de Produto', icon: Layers, description: 'Categorias e tipos de plano' },
      { label: 'Coberturas & Benefícios', shortLabel: 'Cob. & Benef.', icon: Shield, description: 'Catálogo de coberturas e benefícios' },
      { label: 'Adicionais', shortLabel: 'Adicionais', icon: Gift, description: 'Opcionais com valor extra' },
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
      { label: 'Elegibilidade', shortLabel: 'Elegibilidade', icon: ShieldCheck, description: 'Critérios por veículo' },
      { label: 'Regras de Venda', shortLabel: 'Regras', icon: Gavel, description: 'Limites e comissões' },
      { label: 'Instalação e Rotas', shortLabel: 'Instalação', icon: MapPin, description: 'Bases e rotas' },
      { label: 'Mapa de Atendimento', shortLabel: 'Mapa', icon: Globe, description: 'Cobertura geográfica' },
      { label: 'Cadastros Base', shortLabel: 'Cadastros', icon: Database, description: 'Categorias, regiões e especiais' },
    ],
  },
];

// Flat list for index mapping
const allItems = tabGroups.flatMap(g => g.items);

interface TabNavigationProps {
  active: number;
  onChange: (index: number) => void;
}

function NavContent({ active, onChange, onSelect }: TabNavigationProps & { onSelect?: () => void }) {
  let globalIndex = 0;

  return (
    <nav className="py-2 px-3 space-y-4">
      {tabGroups.map((group, groupIdx) => {
        const startIdx = globalIndex;
        const groupItems = group.items.map((item) => {
          const idx = globalIndex++;
          return { ...item, idx };
        });
        const isGroupActive = groupItems.some(i => i.idx === active);

        return (
          <div key={group.title}>
            {/* Group header */}
            <div className={cn(
              'flex items-center gap-2 px-2 py-1.5 mb-1 rounded-md transition-colors',
              isGroupActive ? 'text-foreground' : 'text-muted-foreground'
            )}>
              <group.icon className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-[0.08em]">
                {group.title}
              </span>
              <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0 h-4 font-normal">
                {group.items.length}
              </Badge>
            </div>

            {/* Items */}
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
                    {/* Active indicator */}
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
                      <p className={cn(
                        'text-[13px] leading-tight truncate',
                        isActive ? 'font-semibold' : 'font-medium'
                      )}>
                        {item.shortLabel}
                      </p>
                      <p className={cn(
                        'text-[10px] leading-snug mt-0.5 truncate transition-colors',
                        isActive ? 'text-primary/70' : 'text-muted-foreground/70'
                      )}>
                        {item.description}
                      </p>
                    </div>

                    {isActive && (
                      <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function TabNavigation({ active, onChange }: TabNavigationProps) {
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

  return (
    <aside className="w-64 shrink-0 border-r bg-card/30 overflow-y-auto">
      <NavContent active={active} onChange={onChange} />
    </aside>
  );
}

export { allItems };
