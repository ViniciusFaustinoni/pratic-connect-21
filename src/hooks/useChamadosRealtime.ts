import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useChamadosRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('chamados-assistencia-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chamados_assistencia' },
        (payload) => {
          console.log('[ChamadosRealtime] Mudança detectada:', payload.eventType);

          queryClient.invalidateQueries({ queryKey: ['chamados-assistencia'] });
          queryClient.invalidateQueries({ queryKey: ['chamados-contadores'] });
          queryClient.invalidateQueries({ queryKey: ['chamados-ativos'] });
          queryClient.invalidateQueries({ queryKey: ['assistencia-estatisticas'] });

          if (payload.eventType === 'INSERT') {
            toast.info('🔔 Novo chamado na fila', {
              description: 'A fila de chamados foi atualizada',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
