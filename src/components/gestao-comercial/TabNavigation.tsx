import { useState } from 'react';
import { Package, Shield, Gift, Calculator, ShieldCheck, Gavel, MapPin, Settings, Globe, LucideIcon, Store, Cog, Menu, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface TabItem {
  label: string;
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
    title: 'Produtos e Preços',
    icon: Store,
    items: [
      { label: 'Planos, Produtos e Preços', icon: Package, description: 'Crie e edite planos, vincule linhas e defina preços por faixa FIPE' },
      { label: 'Benefícios & Coberturas', icon: Shield, description: 'Gerencie os benefícios exibidos nos cards e coberturas de marketing' },
      { label: 'Adicionais', icon: Gift, description: 'Configure benefícios adicionais opcionais com valor extra' },
    ],
  },
  {
    title: 'Financeiro e Rateio',
    icon: Calculator,
    items: [
      { label: 'Simulador de Rateio', icon: Calculator, description: 'Simule a distribuição de custos entre associados' },
      { label: 'Configuração do Rateio', icon: Settings, description: 'Defina os parâmetros e regras do cálculo de rateio' },
    ],
  },
  {
    title: 'Regras e Operação',
    icon: Cog,
    items: [
      { label: 'Elegibilidade', icon: ShieldCheck, description: 'Defina quais veículos (marca, modelo, ano) cada plano aceita' },
      { label: 'Regras de Venda', icon: Gavel, description: 'Configure limites FIPE, comissões e taxas administrativas' },
      { label: 'Instalação e Rotas', icon: MapPin, description: 'Gerencie pontos de instalação e rotas de atendimento' },
      { label: 'Mapa de Atendimento', icon: Globe, description: 'Visualize a cobertura geográfica de atendimento' },
    ],
  },
];

// Flat list for index mapping
const allItems = tabGroups.flatMap(g => g.items);

interface TabNavigationProps {
  active: number;
  onChange: (index: number) => void;
}

function SidebarContent({ active, onChange, onSelect }: TabNavigationProps & { onSelect?: () => void }) {
  let globalIndex = 0;

  return (
    <nav className="space-y-5 p-4">
      {tabGroups.map((group) => (
        <div key={group.title}>
          <div className="flex items-center gap-2 px-3 mb-2">
            <group.icon className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {group.title}
            </p>
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const idx = globalIndex++;
              const isActive = active === idx;
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  onClick={() => { onChange(idx); onSelect?.(); }}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150',
                    isActive
                      ? 'bg-accent border-l-[3px] border-primary text-accent-foreground'
                      : 'border-l-[3px] border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', isActive && 'text-primary')} />
                  <div className="min-w-0">
                    <p className={cn('text-sm leading-tight', isActive ? 'font-semibold' : 'font-medium')}>
                      {item.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function TabNavigation({ active, onChange }: TabNavigationProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const currentItem = allItems[active];

  if (isMobile) {
    return (
      <div className="border-b bg-background">
        <div className="p-3">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="gap-2 px-3 w-full justify-start">
                <Menu className="h-5 w-5" />
                <span className="font-medium truncate">{currentItem?.label || 'Gestão Comercial'}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="p-5 pb-3 border-b">
                <SheetTitle>Gestão Comercial</SheetTitle>
              </SheetHeader>
              <SidebarContent active={active} onChange={onChange} onSelect={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-72 shrink-0 border-r bg-card/50 overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navegação</h3>
      </div>
      <SidebarContent active={active} onChange={onChange} />
    </aside>
  );
}

export { allItems };
