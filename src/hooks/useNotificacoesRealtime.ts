import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';

// Som de notificação (base64 de um beep curto)
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' + 'AAAAA=';

interface UseNotificacoesRealtimeOptions {
  enableSound?: boolean;
}

export function useNotificacoesRealtime(options: UseNotificacoesRealtimeOptions = {}) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Determinar se estamos no app do associado ou sistema interno
  const isApp = location.pathname.startsWith('/app');
  const notificacoesPath = isApp ? '/app/notificacoes' : '/notificacoes';

  // Determinar se som está habilitado (para colaboradores)
  const enableSound = options.enableSound ?? (profile?.tipo !== 'associado');

  useEffect(() => {
    if (!user) return;

    // Criar elemento de áudio para som
    if (enableSound && !audioRef.current) {
      audioRef.current = new Audio(NOTIFICATION_SOUND);
      audioRef.current.volume = 0.3;
    }

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
        async (payload) => {
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
            
            // Tocar som se habilitado
            if (enableSound && audioRef.current) {
              try {
                await audioRef.current.play();
              } catch (e) {
                // Ignorar erro se som não puder ser reproduzido
              }
            }
            
            toast(newNotification.titulo, {
              description: newNotification.mensagem,
              action: {
                label: 'Ver',
                onClick: () => navigate(notificacoesPath)
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, navigate, notificacoesPath, enableSound]);
}
