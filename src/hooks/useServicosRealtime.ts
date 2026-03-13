import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Hook Realtime para servicos do profissional logado.
 * Invalida queries instantaneamente ao receber INSERT/UPDATE via Supabase Realtime.
 */
export function useServicosRealtime() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const profissionalId = profile?.id;

  useEffect(() => {
    if (!profissionalId) return;

    const channel = supabase
      .channel(`servicos-profissional-${profissionalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'servicos',
          filter: `profissional_id=eq.${profissionalId}`,
        },
        (payload) => {
          console.log('[ServicosRealtime] Mudança detectada:', payload.eventType);

          // Invalidar todas as queries relacionadas
          queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
          queryClient.invalidateQueries({ queryKey: ['servicos'] });
          queryClient.invalidateQueries({ queryKey: ['servico-detalhes'] });
          queryClient.invalidateQueries({ queryKey: ['instalador-instalacoes'] });
          queryClient.invalidateQueries({ queryKey: ['profissional-em-servico'] });

          if (payload.eventType === 'INSERT') {
            toast.success('📋 Nova tarefa atribuída!', {
              description: 'Verifique sua tarefa atual.',
              duration: 6000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profissionalId, queryClient]);
}
