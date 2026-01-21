import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_MENSAGENS: Record<string, string> = {
  em_analise: '🔍 Seu sinistro está sendo analisado!',
  documentacao_pendente: '📄 Documentos pendentes - verifique a lista',
  aprovado: '✅ Sinistro aprovado! Parabéns!',
  negado: '❌ Sinistro negado - veja o parecer',
  em_regulacao: '📋 Vistoria agendada',
  em_reparo: '🔧 Veículo em reparo',
  aguardando_pagamento: '💳 Aguardando processamento do pagamento',
  pago: '💰 Pagamento realizado!',
  encerrado: '✔️ Sinistro encerrado',
};

/**
 * Hook para subscription realtime de um sinistro específico
 * Atualiza queries automaticamente e mostra toasts para mudanças importantes
 */
export function useSinistroRealtime(sinistroId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sinistroId) return;

    const channel = supabase
      .channel(`sinistro-detalhe-${sinistroId}`)
      
      // Mudanças no sinistro principal
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sinistros',
          filter: `id=eq.${sinistroId}`,
        },
        (payload) => {
          // Invalidar queries
          queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
          queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
          queryClient.invalidateQueries({ queryKey: ['meus-sinistros'] });

          const newData = payload.new as { status?: string };
          const oldData = payload.old as { status?: string };

          // Toast de mudança de status
          if (newData.status && newData.status !== oldData.status) {
            const mensagem = STATUS_MENSAGENS[newData.status];
            if (mensagem) {
              toast(mensagem, {
                description: 'Status do seu sinistro foi atualizado',
                duration: 8000,
              });
            }
          }
        }
      )
      
      // Mudanças nos documentos
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sinistro_documentos',
          filter: `sinistro_id=eq.${sinistroId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['sinistro-documentos', sinistroId] });

          if (payload.eventType === 'UPDATE') {
            const newDoc = payload.new as { status?: string; tipo?: string };
            if (newDoc.status === 'aprovado') {
              toast.success(`Documento ${newDoc.tipo} aprovado!`);
            } else if (newDoc.status === 'reprovado') {
              toast.error(`Documento ${newDoc.tipo} reprovado - envie novamente`);
            }
          }
        }
      )
      
      // Novas mensagens
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sinistro_mensagens',
          filter: `sinistro_id=eq.${sinistroId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['sinistro-mensagens', sinistroId] });

          const msg = payload.new as { remetente_tipo?: string };
          if (msg.remetente_tipo !== 'associado') {
            toast('💬 Nova mensagem do analista', {
              description: 'Abra o chat para ver',
              duration: 6000,
            });
          }
        }
      )
      
      // Novas fotos adicionadas
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sinistro_fotos',
          filter: `sinistro_id=eq.${sinistroId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sinistro-fotos', sinistroId] });
          queryClient.invalidateQueries({ queryKey: ['sinistro-fotos-urls', sinistroId] });
        }
      )
      
      // Fotos excluídas
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'sinistro_fotos',
          filter: `sinistro_id=eq.${sinistroId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sinistro-fotos', sinistroId] });
          queryClient.invalidateQueries({ queryKey: ['sinistro-fotos-urls', sinistroId] });
        }
      )
      
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[SinistroRealtime] Conectado ao sinistro ${sinistroId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[SinistroRealtime] Erro no canal ${sinistroId}`);
        }
      });

    return () => {
      console.log(`[SinistroRealtime] Desconectando do sinistro ${sinistroId}`);
      supabase.removeChannel(channel);
    };
  }, [sinistroId, queryClient]);
}

/**
 * Hook para listar sinistros do associado com realtime
 */
export function useMeusSinistrosRealtime(associadoId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!associadoId) return;

    const channel = supabase
      .channel(`meus-sinistros-${associadoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sinistros',
          filter: `associado_id=eq.${associadoId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['meus-sinistros'] });
          queryClient.invalidateQueries({ queryKey: ['sinistros'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [associadoId, queryClient]);
}
