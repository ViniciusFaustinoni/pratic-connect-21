import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function useNotificacoesRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notificacoes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Invalidar queries para refetch automático
          queryClient.invalidateQueries({ 
            queryKey: ['my-notificacoes', user.id] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['unread-notificacoes-count', user.id] 
          });

          // Mostrar toast para novas notificações
          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as { titulo: string; mensagem: string };
            toast(newNotification.titulo, {
              description: newNotification.mensagem,
              action: {
                label: 'Ver',
                onClick: () => navigate('/app/notificacoes')
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, navigate]);
}
