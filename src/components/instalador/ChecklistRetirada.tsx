import { useState, useEffect } from 'react';
import { ClipboardCheck, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface ChecklistRetiradaItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  checked_at: string | null;
}

const CHECKLIST_ITEMS_INICIAL: ChecklistRetiradaItem[] = [
  {
    id: 'acabamento_desmontado',
    label: 'Acabamento do veículo desmontado com cuidado',
    description: 'Remover painéis necessários sem danificar',
    checked: false,
    checked_at: null,
  },
  {
    id: 'rastreador_localizado',
    label: 'Rastreador localizado e removido',
    description: 'Encontrar e desconectar o equipamento',
    checked: false,
    checked_at: null,
  },
  {
    id: 'fios_isolados',
    label: 'Fios cortados e isolados corretamente',
    description: 'Sem risco de curto-circuito',
    checked: false,
    checked_at: null,
  },
  {
    id: 'chip_removido',
    label: 'Chip removido do módulo',
    description: 'Retirar SIM card do rastreador',
    checked: false,
    checked_at: null,
  },
  {
    id: 'acabamento_recolocado',
    label: 'Acabamento do veículo recolocado',
    description: 'Painéis e acabamentos no lugar',
    checked: false,
    checked_at: null,
  },
  {
    id: 'integridade_verificada',
    label: 'Aparelho verificado visualmente',
    description: 'Checar estado físico do rastreador',
    checked: false,
    checked_at: null,
  },
];

interface ChecklistRetiradaProps {
  onComplete: () => void;
  onChecklistChange: (items: ChecklistRetiradaItem[]) => void;
  disabled?: boolean;
}

export function ChecklistRetirada({
  onComplete,
  onChecklistChange,
  disabled = false,
}: ChecklistRetiradaProps) {
  const [items, setItems] = useState<ChecklistRetiradaItem[]>(CHECKLIST_ITEMS_INICIAL);

  const checkedCount = items.filter(item => item.checked).length;
  const totalItems = items.length;
  const progressPercent = (checkedCount / totalItems) * 100;
  const isComplete = checkedCount === totalItems;

  useEffect(() => {
    if (isComplete) {
      onComplete();
    }
    onChecklistChange(items);
  }, [items, isComplete, onComplete, onChecklistChange]);

  const handleToggle = (id: string) => {
    if (disabled) return;
    
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          checked: !item.checked,
          checked_at: !item.checked ? new Date().toISOString() : null,
        };
      }
      return item;
    }));
  };

  return (
    <Card className={cn(
      "border-slate-700 bg-slate-800 transition-all",
      isComplete && "border-green-500 bg-green-950/20"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-red-400" />
            Checklist de Retirada
          </div>
          {isComplete && (
            <span className="text-sm font-normal text-green-400 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Completo
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{checkedCount} de {totalItems} verificações</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress 
            value={progressPercent} 
            className="h-2 bg-slate-700"
            indicatorClassName={isComplete ? "bg-green-500" : "bg-red-500"}
          />
        </div>

        {/* Checklist items */}
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleToggle(item.id)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors min-h-[48px]",
                item.checked 
                  ? "bg-green-900/30" 
                  : "hover:bg-slate-700/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Checkbox 
                checked={item.checked}
                disabled={disabled}
                className={cn(
                  "h-5 w-5 mt-0.5 border-slate-500",
                  item.checked && "border-green-500 bg-green-500 text-white"
                )}
              />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-sm",
                  item.checked ? "text-green-300" : "text-white"
                )}>
                  {item.label}
                </p>
                <p className="text-xs text-slate-400">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
