import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useFilasRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateInstalacoesQueries = () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('instalac');
        }
      });
    };

    const invalidateVistoriasQueries = () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('vistoria');
        }
      });
    };

    const handleInstalacoesChange = (payload: any) => {
      console.log('[Realtime Filas] Mudança em instalacoes:', payload);
      invalidateInstalacoesQueries();

      if (payload.eventType === 'INSERT') {
        toast.info('📅 Nova instalação agendada', {
          description: 'A fila de instalações foi atualizada',
        });
      }
    };

    const handleVistoriasChange = (payload: any) => {
      console.log('[Realtime Filas] Mudança em vistorias:', payload);
      invalidateVistoriasQueries();

      if (payload.eventType === 'INSERT') {
        toast.info('📋 Nova vistoria agendada', {
          description: 'A fila de vistorias foi atualizada',
        });
      }
    };

    const channel = supabase
      .channel('filas-realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'instalacoes' },
        handleInstalacoesChange
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'vistorias' },
        handleVistoriasChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
