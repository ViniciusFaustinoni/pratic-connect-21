import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useFilasRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateInstalacoesQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacao'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-contagem'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-dia'] });
    };

    const invalidateVistoriasQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-metricas'] });
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
