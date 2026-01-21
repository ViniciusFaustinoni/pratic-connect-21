import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para escutar atualizações em tempo real da tabela de contratos
 * Invalida queries automaticamente e exibe toast quando contrato é assinado
 * IMPORTANTE: Toasts são exibidos APENAS para o vendedor responsável pela proposta
 */
export function useContratosRealtime() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  useEffect(() => {
    console.log('[useContratosRealtime] Iniciando listener realtime para contratos');
    
    const channel = supabase
      .channel('contratos-realtime-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contratos',
        },
        (payload) => {
          console.log('[useContratosRealtime] Mudança detectada:', payload.eventType, payload);
          
          // Invalidar todas as queries de contratos
          queryClient.invalidateQueries({ queryKey: ['contratos'] });
          queryClient.invalidateQueries({ queryKey: ['contrato'] });
          queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
          queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
          // Também invalidar cotações pois a etapa de venda depende do contrato
          queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
          
          // Se for uma atualização e o status mudou para 'assinado'
          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as any;
            const oldData = payload.old as any;
            
            // Contrato foi assinado - mostrar APENAS para o vendedor responsável
            if (newData.status === 'assinado' && oldData.status !== 'assinado') {
              if (profile?.id && newData.vendedor_id === profile.id) {
                toast.success('🎉 Contrato Assinado!', {
                  description: `Contrato ${newData.numero || ''} foi assinado com sucesso!`,
                  duration: 10000,
                });
              }
            }
            
            // Contrato foi visualizado - mostrar APENAS para o vendedor responsável
            if (newData.status === 'visualizado' && oldData.status !== 'visualizado') {
              if (profile?.id && newData.vendedor_id === profile.id) {
                toast.info('👁️ Contrato Visualizado', {
                  description: `O cliente abriu o contrato ${newData.numero || ''}`,
                  duration: 5000,
                });
              }
            }
            
            // Contrato foi rejeitado - mostrar APENAS para o vendedor responsável
            if (newData.status === 'rejeitado' && oldData.status !== 'rejeitado') {
              if (profile?.id && newData.vendedor_id === profile.id) {
                toast.warning('⚠️ Contrato Rejeitado', {
                  description: `Contrato ${newData.numero || ''} foi rejeitado pelo cliente`,
                  duration: 8000,
                });
              }
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[useContratosRealtime] Status da subscription:', status);
      });

    // Listener para vistorias (afeta requisitos de ativação)
    const vistoriasChannel = supabase
      .channel('vistorias-ativacoes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vistorias',
        },
        (payload) => {
          console.log('[useContratosRealtime] Vistoria alterada:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
        }
      )
      .subscribe();

    return () => {
      console.log('[useContratosRealtime] Removendo listeners realtime');
      supabase.removeChannel(channel);
      supabase.removeChannel(vistoriasChannel);
    };
  }, [queryClient, profile?.id]);
}

/**
 * Hook para escutar atualizações de um contrato específico pelo token
 * Útil para páginas públicas do associado
 */
export function useContratoRealtimeByToken(token: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;
    
    console.log('[useContratoRealtimeByToken] Iniciando listener para token:', token);
    
    const channel = supabase
      .channel(`contrato-token-${token}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contratos',
          filter: `link_token=eq.${token}`,
        },
        (payload) => {
          console.log('[useContratoRealtimeByToken] Contrato atualizado:', payload);
          
          // Invalidar query do contrato público
          queryClient.invalidateQueries({ queryKey: ['contrato-publico', token] });
          
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          // Contrato foi assinado - feedback para o associado
          if (newData.status === 'assinado' && oldData.status !== 'assinado') {
            toast.success('🎉 Contrato Assinado com Sucesso!', {
              description: 'Sua assinatura foi registrada. Obrigado!',
              duration: 10000,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[useContratoRealtimeByToken] Status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token, queryClient]);
}
