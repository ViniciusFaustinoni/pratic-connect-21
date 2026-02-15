import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChecklistItem {
  id: string;
  label: string;
  autoVerificado?: boolean;
  verificado?: boolean;
  carregando?: boolean;
}

interface Props {
  items: ChecklistItem[];
  onChange: (id: string, checked: boolean) => void;
  todosVerificados: boolean;
}

export function ChecklistFechamento({ items, onChange, todosVerificados }: Props) {
  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Checklist de Verificação
      </h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border',
              item.verificado ? 'bg-green-50 dark:bg-green-950/20 border-green-200' : 'bg-background'
            )}
          >
            {item.autoVerificado ? (
              <div className="flex items-center justify-center h-4 w-4">
                {item.carregando ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : item.verificado ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <X className="h-4 w-4 text-red-600" />
                )}
              </div>
            ) : (
              <Checkbox
                id={item.id}
                checked={item.verificado}
                onCheckedChange={(checked) => onChange(item.id, !!checked)}
              />
            )}
            <Label
              htmlFor={item.id}
              className={cn(
                'text-sm cursor-pointer flex-1',
                item.verificado && 'text-green-700 dark:text-green-400'
              )}
            >
              {item.label}
              {item.autoVerificado && (
                <span className="text-xs text-muted-foreground ml-2">(automático)</span>
              )}
            </Label>
          </div>
        ))}
      </div>
      
      <div className={cn(
        'p-3 rounded-lg text-center font-medium text-sm',
        todosVerificados
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : 'bg-muted text-muted-foreground'
      )}>
        {todosVerificados
          ? '✓ Todos os itens verificados — pronto para fechar'
          : `${items.filter(i => i.verificado).length} de ${items.length} itens verificados`
        }
      </div>
    </div>
  );
}
