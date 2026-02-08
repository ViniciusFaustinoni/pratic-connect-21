import { useState, useEffect } from 'react';
import { ClipboardCheck, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface ChecklistManutencaoItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  checked_at: string | null;
}

const CHECKLIST_ITEMS_INICIAL: ChecklistManutencaoItem[] = [
  {
    id: 'conexao_eletrica',
    label: 'Verificar conexão elétrica do rastreador',
    description: 'Checar fios, conectores e aterramento',
    checked: false,
    checked_at: null,
  },
  {
    id: 'led_status',
    label: 'Verificar LED de status do equipamento',
    description: 'LED piscando = OK, apagado = sem energia',
    checked: false,
    checked_at: null,
  },
  {
    id: 'sinal_gps',
    label: 'Testar sinal GPS',
    description: 'Verificar se rastreador está transmitindo posição',
    checked: false,
    checked_at: null,
  },
  {
    id: 'tensao_bateria',
    label: 'Verificar tensão da bateria do veículo',
    description: 'Mínimo 12V para funcionamento adequado',
    checked: false,
    checked_at: null,
  },
  {
    id: 'estado_fisico',
    label: 'Inspecionar estado físico do rastreador',
    description: 'Sem sinais de violação, oxidação ou dano',
    checked: false,
    checked_at: null,
  },
  {
    id: 'fixacao',
    label: 'Verificar fixação e posicionamento',
    description: 'Rastreador bem fixo e em local discreto',
    checked: false,
    checked_at: null,
  },
];

interface ChecklistManutencaoProps {
  onComplete: () => void;
  onChecklistChange: (items: ChecklistManutencaoItem[]) => void;
  disabled?: boolean;
}

export function ChecklistManutencao({
  onComplete,
  onChecklistChange,
  disabled = false,
}: ChecklistManutencaoProps) {
  const [items, setItems] = useState<ChecklistManutencaoItem[]>(CHECKLIST_ITEMS_INICIAL);

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
      "transition-all",
      isComplete && "border-green-500 bg-green-50/50 dark:bg-green-950/20"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Checklist de Manutenção
          </div>
          {isComplete && (
            <span className="text-sm font-normal text-green-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Completo
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{checkedCount} de {totalItems} verificações</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress 
            value={progressPercent} 
            className="h-2"
            indicatorClassName={isComplete ? "bg-green-500" : undefined}
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
                  ? "bg-green-100/50 dark:bg-green-950/30" 
                  : "hover:bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Checkbox 
                checked={item.checked}
                disabled={disabled}
                className={cn(
                  "h-5 w-5 mt-0.5",
                  item.checked && "border-green-500 bg-green-500 text-white"
                )}
              />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-sm",
                  item.checked && "text-green-700 dark:text-green-300"
                )}>
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground">
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
