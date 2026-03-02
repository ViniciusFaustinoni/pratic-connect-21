import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook para ativar Realtime no App do Associado
 * Escuta mudanças em: associados, cobrancas
 * Invalida queries automaticamente e mostra toasts de notificação
 */
export function useAppAssociadoRealtime() {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const associadoIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const setupChannel = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        // Buscar o associado_id do usuário logado
        const { data: associado } = await supabase
          .from('associados')
          .select('id, status')
          .eq('user_id', user.id)
          .single();

        if (!associado || !isMounted) return;

        associadoIdRef.current = associado.id;

        // Criar canal único
        const channel = supabase
          .channel(`app-associado-realtime-${associado.id}`)
          // Escutar mudanças no status do associado
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'associados',
              filter: `id=eq.${associado.id}`,
            },
            (payload) => {
              console.log('[AppAssociadoRealtime] Associado atualizado:', payload);
              
              // Invalidar queries do app
              queryClient.invalidateQueries({ queryKey: ['app-associado-logado'] });
              queryClient.invalidateQueries({ queryKey: ['app-veiculos'] });
              queryClient.invalidateQueries({ queryKey: ['app-boletos'] });
              
              const newData = payload.new as { status?: string };
              const oldData = payload.old as { status?: string };
              
              // Toasts de mudança de status
              if (newData.status !== oldData.status) {
                if (newData.status === 'ativo' && oldData.status !== 'ativo') {
                  toast.success('🎉 Parabéns! Seu cadastro foi aprovado!', {
                    description: 'Bem-vindo à PRATIC! Sua proteção está ativa.',
                    duration: 10000,
                  });
                }
                
                if (newData.status === 'suspenso') {
                  toast.warning('⚠️ Sua proteção foi suspensa', {
                    description: 'Entre em contato para regularizar sua situação.',
                    duration: 10000,
                  });
                }
                
                if (newData.status === 'inadimplente') {
                  toast.error('⚠️ Atenção: Existe pendência em sua conta', {
                    description: 'Regularize para manter sua proteção ativa.',
                    duration: 10000,
                  });
                }

                if (newData.status === 'cancelado') {
                  toast.error('Sua proteção foi cancelada', {
                    description: 'Entre em contato com nosso suporte.',
                    duration: 10000,
                  });
                }
              }
            }
          )
          // Escutar mudanças em boletos/cobranças
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'cobrancas',
              filter: `associado_id=eq.${associado.id}`,
            },
            (payload) => {
              console.log('[AppAssociadoRealtime] Cobrança atualizada:', payload);
              
              // Invalidar queries de boletos
              queryClient.invalidateQueries({ queryKey: ['app-boletos'] });
              queryClient.invalidateQueries({ queryKey: ['app-boleto-atual'] });
              
              if (payload.eventType === 'UPDATE') {
                const newData = payload.new as { status?: string };
                const oldData = payload.old as { status?: string };
                
                if (newData.status === 'pago' && oldData.status !== 'pago') {
                  toast.success('✅ Pagamento confirmado!', {
                    description: 'Obrigado! Seu boleto foi compensado.',
                    duration: 8000,
                  });
                }
              }
              
              if (payload.eventType === 'INSERT') {
                toast.info('📄 Novo boleto disponível', {
                  description: 'Um novo boleto foi gerado para você.',
                  duration: 6000,
                });
              }
            }
          )
          // Escutar mudanças em veículos (cobertura_total)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'veiculos',
              filter: `associado_id=eq.${associado.id}`,
            },
            (payload) => {
              console.log('[AppAssociadoRealtime] Veículo atualizado:', payload);
              
              const newData = payload.new as { cobertura_total?: boolean };
              const oldData = payload.old as { cobertura_total?: boolean };
              
              // Invalidar queries de veículos
              queryClient.invalidateQueries({ queryKey: ['app-veiculos'] });
              
              // Toast quando cobertura total for ativada
              if (newData.cobertura_total && !oldData.cobertura_total) {
                toast.success('🚗 Proteção 360º Ativada!', {
                  description: 'Seu rastreador está ativo! Acesse todas as funcionalidades do app.',
                  duration: 10000,
                });
              }
            }
          )
          .subscribe((status) => {
            console.log('[AppAssociadoRealtime] Subscription status:', status);
          });

        channelRef.current = channel;
      } catch (error) {
        console.error('[AppAssociadoRealtime] Erro ao configurar canal:', error);
      }
    };

    setupChannel();

    // Cleanup
    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);
}
