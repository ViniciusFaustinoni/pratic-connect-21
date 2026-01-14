import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook para escutar atualizações em tempo real da tabela de contratos
 * Invalida queries automaticamente e exibe toast quando contrato é assinado
 */
export function useContratosRealtime() {
  const queryClient = useQueryClient();

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
          
          // Se for uma atualização e o status mudou para 'assinado'
          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as any;
            const oldData = payload.old as any;
            
            // Contrato foi assinado
            if (newData.status === 'assinado' && oldData.status !== 'assinado') {
              toast.success('🎉 Contrato Assinado!', {
                description: `Contrato ${newData.numero || ''} foi assinado com sucesso!`,
                duration: 10000,
              });
            }
            
            // Contrato foi visualizado
            if (newData.status === 'visualizado' && oldData.status !== 'visualizado') {
              toast.info('👁️ Contrato Visualizado', {
                description: `O cliente abriu o contrato ${newData.numero || ''}`,
                duration: 5000,
              });
            }
            
            // Contrato foi rejeitado
            if (newData.status === 'rejeitado' && oldData.status !== 'rejeitado') {
              toast.warning('⚠️ Contrato Rejeitado', {
                description: `Contrato ${newData.numero || ''} foi rejeitado pelo cliente`,
                duration: 8000,
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[useContratosRealtime] Status da subscription:', status);
      });

    return () => {
      console.log('[useContratosRealtime] Removendo listener realtime');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
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
