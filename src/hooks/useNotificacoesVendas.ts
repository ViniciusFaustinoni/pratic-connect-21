import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface NotificacaoVendas {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  lead_id: string | null;
  dados_extras: Record<string, any> | null;
  lida: boolean;
  lida_em: string | null;
  created_at: string;
}

export function useNotificacoesVendas() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['notificacoes-vendas', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('notificacoes_vendas')
        .select('*')
        .eq('usuario_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as NotificacaoVendas[];
    },
    enabled: !!profile?.id,
  });
}

export function useNotificacoesVendasNaoLidas() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['notificacoes-vendas-nao-lidas', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;

      const { count, error } = await supabase
        .from('notificacoes_vendas')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', profile.id)
        .eq('lida', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.id,
  });
}

export function useMarcarNotificacaoLida() {
  const queryClient = useQueryClient();

  return async (notificacaoId: string) => {
    const { error } = await supabase
      .from('notificacoes_vendas')
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq('id', notificacaoId);

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['notificacoes-vendas'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes-vendas-nao-lidas'] });
    }
  };
}

// Hook para escutar notificações em tempo real
export function useNotificacoesVendasRealtime() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('notificacoes-vendas-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes_vendas',
          filter: `usuario_id=eq.${profile.id}`,
        },
        (payload) => {
          const notif = payload.new as NotificacaoVendas;
          
          // Invalidar queries
          queryClient.invalidateQueries({ queryKey: ['notificacoes-vendas'] });
          queryClient.invalidateQueries({ queryKey: ['notificacoes-vendas-nao-lidas'] });

          // Mostrar toast baseado no tipo
          if (notif.tipo === 'contrato_assinado') {
            toast.success(notif.titulo, {
              description: notif.mensagem || undefined,
              duration: 8000,
            });
          } else if (notif.tipo === 'lead_atribuido') {
            toast.info(notif.titulo, {
              description: notif.mensagem || undefined,
              duration: 5000,
            });
          } else {
            toast(notif.titulo, {
              description: notif.mensagem || undefined,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, queryClient]);
}

// Hook para escutar mudanças em leads (para atualizar Kanban em tempo real)
export function useLeadsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        (payload) => {
          // Invalidar queries de leads
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['all-leads'] });

          // Toast quando contrato é assinado
          if (
            payload.eventType === 'UPDATE' &&
            (payload.new as any)?.contrato_status === 'assinado' &&
            (payload.old as any)?.contrato_status !== 'assinado'
          ) {
            const lead = payload.new as any;
            toast.success('🎉 Contrato Assinado!', {
              description: `${lead.nome} assinou o contrato`,
              duration: 8000,
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
