import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook para escutar atualizações em tempo real relacionadas a cotações.
 * Invalida queries automaticamente quando há mudanças em:
 * - cotacoes
 * - contratos (afeta status_contratacao/etapa da venda)
 * - instalacoes (afeta etapa vistoria_agendada/instalacao_agendada)
 * - vistorias (afeta etapa de vistoria realizada)
 */
export function useCotacoesRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('[useCotacoesRealtime] Iniciando listeners realtime');
    
    const channel = supabase
      .channel('cotacoes-realtime-all')
      // Escutar mudanças em cotações
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cotacoes',
        },
        (payload) => {
          console.log('[useCotacoesRealtime] Cotação alterada:', payload.eventType);
          
          // Invalidar queries de cotações
          queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
          
          // Se for update de uma cotação específica
          if (payload.eventType === 'UPDATE' && payload.new) {
            const newData = payload.new as { id?: string; status?: string; status_contratacao?: string };
            if (newData.id) {
              queryClient.invalidateQueries({ queryKey: ['cotacoes', newData.id] });
            }
            
            // Toast para mudança de status importante
            if (newData.status === 'aceita') {
              toast.success('🎉 Cotação aceita pelo cliente!', { duration: 5000 });
            }
          }
        }
      )
      // Escutar mudanças em contratos (afeta etapa da venda na cotação)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contratos',
        },
        (payload) => {
          console.log('[useCotacoesRealtime] Contrato alterado:', payload.eventType);
          
          // Invalidar cotações porque a etapa de venda depende do contrato
          queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
          queryClient.invalidateQueries({ queryKey: ['contratos'] });
          queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
          
          // Toast para contrato assinado
          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as { status?: string; numero?: string };
            const oldData = payload.old as { status?: string };
            
            if (newData.status === 'assinado' && oldData?.status !== 'assinado') {
              toast.success('🎉 Contrato assinado!', {
                description: `Contrato ${newData.numero || ''} foi assinado`,
                duration: 8000,
              });
            }
          }
        }
      )
      // Escutar mudanças em instalações (afeta etapa instalacao_agendada/vistoria_agendada)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instalacoes',
        },
        (payload) => {
          console.log('[useCotacoesRealtime] Instalação alterada:', payload.eventType);
          
          // Invalidar cotações e instalações
          queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
          queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
          queryClient.invalidateQueries({ queryKey: ['instalacoes-disponiveis'] });
          
          // Toast para instalação concluída
          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as { status?: string };
            const oldData = payload.old as { status?: string };
            
            if (newData.status === 'concluida' && oldData?.status !== 'concluida') {
              toast.success('✅ Instalação concluída!', { duration: 5000 });
            }
          }
        }
      )
      // Escutar mudanças em vistorias (afeta etapa vistoria_realizada)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vistorias',
        },
        (payload) => {
          console.log('[useCotacoesRealtime] Vistoria alterada:', payload.eventType);
          
          // Invalidar cotações e vistorias
          queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
          queryClient.invalidateQueries({ queryKey: ['vistorias'] });
          queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
          queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
          
          // Toast para vistoria concluída
          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as { status?: string };
            const oldData = payload.old as { status?: string };
            
            if (newData.status === 'concluida' && oldData?.status !== 'concluida') {
              toast.success('✅ Vistoria concluída!', { duration: 5000 });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[useCotacoesRealtime] Status da subscription:', status);
      });

    return () => {
      console.log('[useCotacoesRealtime] Removendo listeners realtime');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
