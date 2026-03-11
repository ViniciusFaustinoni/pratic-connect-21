import { Package, Shield, DollarSign, Gift, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tab {
  label: string;
  icon: LucideIcon;
}

const tabs: Tab[] = [
  { label: 'Produtos & Planos', icon: Package },
  { label: 'Benefícios & Coberturas', icon: Shield },
  { label: 'Tabela de Preços', icon: DollarSign },
  { label: 'Adicionais', icon: Gift },
];

interface TabNavigationProps {
  active: number;
  onChange: (index: number) => void;
}

export function TabNavigation({ active, onChange }: TabNavigationProps) {
  return (
    <div className="border-b">
      <div className="flex gap-0">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => onChange(i)}
            className={cn(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium',
              'border-b-2 transition-all duration-200 -mb-[1px]',
              active === i
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
