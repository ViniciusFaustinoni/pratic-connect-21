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
 * - cotacoes_historico (atualiza timeline em tempo real)
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
          console.log('[useCotacoesRealtime] Cotação alterada:', payload.eventType, payload.new);
          
          // Forçar refetch imediato de todas as cotações
          queryClient.refetchQueries({ queryKey: ['cotacoes'] });
          
          // Se for update de uma cotação específica
          if (payload.eventType === 'UPDATE' && payload.new) {
            const newData = payload.new as { id?: string; status?: string; status_contratacao?: string; cliente_nome?: string };
            const oldData = payload.old as { status_contratacao?: string; status?: string };
            
            if (newData.id) {
              queryClient.refetchQueries({ queryKey: ['cotacoes', newData.id] });
            }
            
            // Labels específicos para cada etapa do status_contratacao
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
            
            // Toast para mudança de status_contratacao (cliente avançou no fluxo)
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
            
            // Toast para mudança de status importante
            if (newData.status === 'aceita' && oldData?.status !== 'aceita') {
              const clienteNome = newData.cliente_nome ? ` - ${newData.cliente_nome}` : '';
              toast.success(`🎉 Cotação aceita pelo cliente${clienteNome}!`, { duration: 5000 });
            }
          }
        }
      )
      // Escutar mudanças em contratos (afeta etapa da venda na cotação)
      // NOTA: Toasts de contrato são gerenciados pelo useContratosRealtime (apenas para vendedor responsável)
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
      // Escutar mudanças no histórico de cotações (atualiza timeline em tempo real)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cotacoes_historico',
        },
        (payload) => {
          console.log('[useCotacoesRealtime] Novo evento no histórico:', payload.new);
          
          const evento = payload.new as { cotacao_id?: string; acao?: string; autor_nome?: string };
          
          // Invalidar histórico da cotação específica
          if (evento.cotacao_id) {
            queryClient.invalidateQueries({ queryKey: ['cotacao-historico', evento.cotacao_id] });
          }
          
          // Notificação especial para visualização do cliente
          if (evento.acao === 'visualizada_cliente') {
            toast.info('👀 Cliente visualizou a cotação!', {
              description: 'O link público foi acessado agora',
              duration: 6000,
            });
          }
          
          // Notificação para plano escolhido pelo cliente
          if (evento.acao === 'plano_escolhido') {
            toast.info('📋 Cliente escolheu um plano!', {
              description: 'O cliente selecionou um plano na cotação pública',
              duration: 5000,
            });
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
