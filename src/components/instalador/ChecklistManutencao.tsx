import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ChecklistItem, type ChecklistStatus } from '@/components/instalador/ChecklistItem';

export interface ChecklistManutencaoItem {
  id: string;
  label: string;
  description: string;
  critico: boolean;
  status: ChecklistStatus;
  observacao?: string;
  fotos?: string[];
  checked_at: string | null;
  // backwards compat
  checked: boolean;
}

const CHECKLIST_ITEMS_INICIAL: Omit<ChecklistManutencaoItem, 'status' | 'checked' | 'checked_at' | 'observacao' | 'fotos'>[] = [
  {
    id: 'conexao_eletrica',
    label: 'Verificar conexão elétrica do rastreador',
    description: 'Checar fios, conectores e aterramento',
    critico: true,
  },
  {
    id: 'led_status',
    label: 'Verificar LED de status do equipamento',
    description: 'LED piscando = OK, apagado = sem energia',
    critico: false,
  },
  {
    id: 'sinal_gps',
    label: 'Testar sinal GPS',
    description: 'Verificar se rastreador está transmitindo posição',
    critico: true,
  },
  {
    id: 'tensao_bateria',
    label: 'Verificar tensão da bateria do veículo',
    description: 'Mínimo 12V para funcionamento adequado',
    critico: false,
  },
  {
    id: 'estado_fisico',
    label: 'Inspecionar estado físico do rastreador',
    description: 'Sem sinais de violação, oxidação ou dano',
    critico: false,
  },
  {
    id: 'fixacao',
    label: 'Verificar fixação e posicionamento',
    description: 'Rastreador bem fixo e em local discreto',
    critico: false,
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
  const [items, setItems] = useState<ChecklistManutencaoItem[]>(() =>
    CHECKLIST_ITEMS_INICIAL.map(item => ({
      ...item,
      status: 'pendente' as ChecklistStatus,
      checked: false,
      checked_at: null,
    }))
  );

  const completedCount = items.filter(item => item.status !== 'pendente').length;
  const totalItems = items.length;
  const progressPercent = (completedCount / totalItems) * 100;
  const isComplete = items.every(item => {
    if (item.status === 'ok') return true;
    if (item.status === 'nok' && item.observacao?.trim()) return true;
    return false;
  });

  const itensNok = items.filter(item => item.status === 'nok');
  const temNok = itensNok.length > 0;

  useEffect(() => {
    if (isComplete) {
      onComplete();
    }
    onChecklistChange(items);
  }, [items, isComplete, onComplete, onChecklistChange]);

  const handleStatusChange = useCallback((id: string, status: ChecklistStatus) => {
    if (disabled) return;
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status,
          checked: status === 'ok',
          checked_at: status !== 'pendente' ? new Date().toISOString() : null,
        };
      }
      return item;
    }));
  }, [disabled]);

  const handleObservacaoChange = useCallback((id: string, observacao: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, observacao };
      }
      return item;
    }));
  }, []);

  return (
    <Card className={cn(
      "transition-all",
      isComplete && !temNok && "border-green-500 bg-green-50/50 dark:bg-green-950/20",
      isComplete && temNok && "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Checklist de Manutenção
          </div>
          {isComplete && !temNok && (
            <span className="text-sm font-normal text-green-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Completo
            </span>
          )}
          {isComplete && temNok && (
            <span className="text-sm font-normal text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Com ressalvas
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{completedCount} de {totalItems} verificações</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress 
            value={progressPercent} 
            className="h-2"
          />
        </div>

        {/* Checklist items using ChecklistItem (OK/NOK) */}
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id}>
              {item.critico && (
                <p className="text-[10px] text-red-500 font-semibold uppercase mb-1 ml-1">Crítico</p>
              )}
              <ChecklistItem
                label={`${item.label}`}
                status={item.status}
                observacao={item.observacao}
                onStatusChange={(status) => handleStatusChange(item.id, status)}
                onObservacaoChange={(obs) => handleObservacaoChange(item.id, obs)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
