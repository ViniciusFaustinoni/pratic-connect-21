import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export function useMyNotificacoes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-notificacoes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Notificacao[];
    },
    enabled: !!user,
  });
}

export function useUnreadCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['unread-notificacoes-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from('notificacoes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('lida', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notificacoes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-notificacoes-count', user?.id] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('user_id', user.id)
        .eq('lida', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notificacoes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-notificacoes-count', user?.id] });
    },
  });
}
