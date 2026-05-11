import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const isDev = import.meta.env.DEV;
const dlog = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

// Throttle por chave para reduzir tempestade de invalidações via realtime.
function makeThrottledInvalidator(qc: QueryClient, windowMs = 3000) {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  return (keys: (string | string[])[]) => {
    for (const k of keys) {
      const arr = Array.isArray(k) ? k : [k];
      const id = arr.join('|');
      if (pending.has(id)) continue;
      const t = setTimeout(() => {
        pending.delete(id);
        qc.invalidateQueries({ queryKey: arr });
      }, windowMs);
      pending.set(id, t);
    }
  };
}

export interface UseCotacoesRealtimeOptions {
  enabled?: boolean;
  /** Quando informado, filtra eventos de `cotacoes` por este vendedor (reduz volume). */
  vendedorId?: string;
  /** Escopo de visão; 'all'/'team' não aplicam filtro server-side. */
  viewScope?: 'own' | 'team' | 'all';
}

/**
 * Hook para escutar atualizações em tempo real relacionadas a cotações.
 * - Subscribe principal em `cotacoes` (com filtro por vendedor quando aplicável).
 * - Subscribe leve em `cotacoes_historico` para timeline.
 * Demais entidades (contratos, instalacoes, vistorias, associados) são
 * atualizadas via seus próprios hooks dedicados ou no detalhe da cotação.
 */
export function useCotacoesRealtime(options?: UseCotacoesRealtimeOptions) {
  const enabled = options?.enabled ?? true;
  const vendedorId = options?.vendedorId;
  const viewScope = options?.viewScope ?? 'own';
  const queryClient = useQueryClient();
  const throttledInvalidate = useRef(makeThrottledInvalidator(queryClient)).current;

  useEffect(() => {
    if (!enabled) return;
    // Evita ciclo "subscribe → unsubscribe" enquanto permissões carregam (vendedorId chega depois).
    if (viewScope === 'own' && !vendedorId) return;
    dlog('[useCotacoesRealtime] Iniciando listeners realtime');

    const useVendorFilter = viewScope === 'own' && !!vendedorId;
    const channelName = useVendorFilter
      ? `cotacoes-realtime-v-${vendedorId}`
      : 'cotacoes-realtime-all';

    let channel = supabase.channel(channelName);

    // Cotações (filtro por vendedor quando possível)
    channel = channel.on(
      'postgres_changes',
      useVendorFilter
        ? { event: '*', schema: 'public', table: 'cotacoes', filter: `vendedor_id=eq.${vendedorId}` }
        : { event: '*', schema: 'public', table: 'cotacoes' },
      (payload) => {
        dlog('[useCotacoesRealtime] Cotação alterada:', payload.eventType);
        throttledInvalidate([['cotacoes']]);

        if (payload.eventType === 'UPDATE' && payload.new) {
          const newData = payload.new as { id?: string; status?: string; status_contratacao?: string; cliente_nome?: string };
          const oldData = payload.old as { status_contratacao?: string; status?: string };

          if (newData.id) {
            throttledInvalidate([['cotacoes', newData.id]]);
          }

          const STATUS_CONTRATACAO_LABELS: Record<string, { emoji: string; label: string; type: 'success' | 'info' }> = {
            'plano_escolhido': { emoji: '📋', label: 'Cliente escolheu o plano', type: 'info' },
            'dados_preenchidos': { emoji: '📝', label: 'Cliente preencheu os dados', type: 'info' },
            'documentos_ok': { emoji: '📎', label: 'Documentos enviados', type: 'info' },
            'autovistoria_ok': { emoji: '📷', label: 'Autovistoria enviada', type: 'info' },
            'vistoria_agendada': { emoji: '🗓️', label: 'Vistoria agendada', type: 'info' },
            'vistoria_ok': { emoji: '✅', label: 'Vistoria concluída', type: 'success' },
            'instalacao_agendada': { emoji: '🔧', label: 'Instalação agendada', type: 'info' },
            'instalacao_ok': { emoji: '✅', label: 'Instalação concluída', type: 'success' },
            'pagamento_ok': { emoji: '💰', label: 'Pagamento confirmado', type: 'success' },
            'contrato_assinado': { emoji: '✍️', label: 'Contrato assinado', type: 'success' },
            'ativo': { emoji: '🎉', label: 'Associado ativado', type: 'success' },
          };

          if (newData.status_contratacao &&
              newData.status_contratacao !== 'aguardando' &&
              newData.status_contratacao !== oldData?.status_contratacao) {
            const statusInfo = STATUS_CONTRATACAO_LABELS[newData.status_contratacao];
            const clienteNome = newData.cliente_nome ? ` - ${newData.cliente_nome}` : '';
            if (statusInfo) {
              if (statusInfo.type === 'success') {
                toast.success(`${statusInfo.emoji} ${statusInfo.label}${clienteNome}`, { duration: 6000 });
              } else {
                toast.info(`${statusInfo.emoji} ${statusInfo.label}${clienteNome}`, { duration: 5000 });
              }
            } else {
              toast.info(`📋 Cliente avançou na contratação${clienteNome}`, { duration: 4000 });
            }
          }

          if (newData.status === 'aceita' && oldData?.status !== 'aceita') {
            const clienteNome = newData.cliente_nome ? ` - ${newData.cliente_nome}` : '';
            toast.success(`🎉 Cotação aceita pelo cliente${clienteNome}!`, { duration: 5000 });
          }
        }
      }
    );

    // Histórico de cotações: leve, para atualizar timeline em tempo real
    channel = channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'cotacoes_historico' },
      (payload) => {
        const evento = payload.new as { cotacao_id?: string; acao?: string };
        if (evento.cotacao_id) {
          throttledInvalidate([['cotacao-historico', evento.cotacao_id]]);
        }
        if (evento.acao === 'visualizada_cliente') {
          toast.info('👀 Cliente visualizou a cotação!', {
            description: 'O link público foi acessado agora',
            duration: 6000,
          });
        }
        if (evento.acao === 'plano_escolhido') {
          toast.info('📋 Cliente escolheu um plano!', {
            description: 'O cliente selecionou um plano na cotação pública',
            duration: 5000,
          });
        }
      }
    );

    channel.subscribe((status) => {
      dlog('[useCotacoesRealtime] Status da subscription:', status);
    });

    return () => {
      dlog('[useCotacoesRealtime] Removendo listeners realtime');
      supabase.removeChannel(channel);
    };
  }, [queryClient, enabled, vendedorId, viewScope, throttledInvalidate]);
}
