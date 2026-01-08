import { useState, useEffect } from 'react';
import { ETAPAS_KANBAN_VENDAS } from '@/lib/lead-transitions';
import type { EtapaLead } from '@/types/database';

const STORAGE_KEY = 'kanban-leads-column-order';

export function useKanbanColumnOrder() {
  const [columnOrder, setColumnOrder] = useState<EtapaLead[]>(() => {
    if (typeof window === 'undefined') return ETAPAS_KANBAN_VENDAS;
    
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as EtapaLead[];
        // Validar que todas as etapas existem
        if (parsed.length === ETAPAS_KANBAN_VENDAS.length && 
            parsed.every(e => ETAPAS_KANBAN_VENDAS.includes(e))) {
          return parsed;
        }
      } catch {
        // Ignorar erro de parsing
      }
    }
    return ETAPAS_KANBAN_VENDAS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columnOrder));
  }, [columnOrder]);

  const reorderColumns = (activeId: string, overId: string) => {
    const oldIndex = columnOrder.indexOf(activeId as EtapaLead);
    const newIndex = columnOrder.indexOf(overId as EtapaLead);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const newOrder = [...columnOrder];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, activeId as EtapaLead);
    
    setColumnOrder(newOrder);
  };

  const resetOrder = () => {
    setColumnOrder([...ETAPAS_KANBAN_VENDAS]);
  };

  return { columnOrder, reorderColumns, resetOrder };
}
