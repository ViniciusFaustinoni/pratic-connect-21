import {
  TrendingUp, User, Car, FileCheck, CreditCard, History, MessagesSquare,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TabItem {
  value: string;
  label: string;
  icon: any;
  badge?: number;
  hidden?: boolean;
}

interface AssociadoTabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  veiculosCount: number;
  docsPendentes: number;
  isAnalistaCadastroOnly: boolean;
}

export function AssociadoTabNav({
  activeTab, onTabChange, veiculosCount, docsPendentes, isAnalistaCadastroOnly,
}: AssociadoTabNavProps) {
  const tabs: TabItem[] = [
    { value: 'resumo', label: 'Resumo', icon: TrendingUp },
    { value: 'dados', label: 'Dados Pessoais', icon: User },
    { value: 'veiculos', label: `Veículos${veiculosCount ? ` (${veiculosCount})` : ''}`, icon: Car },
    { value: 'documentos', label: 'Documentos', icon: FileCheck, badge: docsPendentes, hidden: isAnalistaCadastroOnly },
    { value: 'financeiro', label: 'Financeiro', icon: CreditCard },
    { value: 'historico', label: 'Histórico', icon: History },
    { value: 'whatsapp', label: 'WhatsApp', icon: MessagesSquare },
  ];

  return (
    <div className="border-b border-border bg-card rounded-t-lg">
      <div className="flex items-center gap-0.5 overflow-x-auto px-1 py-1 scrollbar-hide">
        {tabs.filter(t => !t.hidden).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && tab.badge > 0 ? (
                <Badge variant="destructive" className="h-4 px-1 text-[10px] leading-none ml-0.5">
                  {tab.badge}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
