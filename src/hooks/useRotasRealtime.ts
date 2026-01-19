import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type RotaPayload = {
  id: string;
  codigo?: string;
  status?: string;
  data?: string;
};

type InstalacaoPayload = {
  id: string;
  rota_id?: string;
  status?: string;
};

type VistoriaPayload = {
  id: string;
  rota_id?: string;
  status?: string;
};

type CotacaoPayload = {
  id: string;
  vistoria_rota_id?: string;
  vistoria_concluida_em?: string;
};

/**
 * Hook para escutar mudanças em tempo real nas tabelas relacionadas a rotas.
 * Invalida automaticamente as queries e exibe toasts informativos.
 */
export function useRotasRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Função para invalidar todas as queries de rotas
    const invalidateRotasQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['rota'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-semana'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-do-dia'] });
    };

    // Função para invalidar queries de serviços pendentes
    const invalidateServicosQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['bairros-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['bairros-servicos'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-por-bairros'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-por-bairros'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-por-bairros'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-bairros'] });
    };

    // Handler para mudanças na tabela rotas
    const handleRotasChange = (payload: RealtimePostgresChangesPayload<RotaPayload>) => {
      console.log('[Realtime] Mudança em rotas:', payload);
      invalidateRotasQueries();

      if (payload.eventType === 'INSERT') {
        toast.info('📋 Nova rota criada', {
          description: `Rota ${payload.new?.codigo || ''} foi criada`,
        });
      } else if (payload.eventType === 'UPDATE') {
        const newStatus = payload.new?.status;
        const oldStatus = (payload.old as RotaPayload)?.status;

        if (newStatus !== oldStatus) {
          if (newStatus === 'em_andamento') {
            toast.info('🚗 Rota iniciada!', {
              description: `Rota ${payload.new?.codigo || ''} está em andamento`,
            });
          } else if (newStatus === 'concluida') {
            toast.success('✅ Rota concluída!', {
              description: `Rota ${payload.new?.codigo || ''} foi finalizada`,
            });
          } else if (newStatus === 'cancelada') {
            toast.warning('⚠️ Rota cancelada', {
              description: `Rota ${payload.new?.codigo || ''} foi cancelada`,
            });
          }
        }
      }
    };

    // Handler para mudanças na tabela rota_instaladores
    const handleRotaInstaladoresChange = (payload: RealtimePostgresChangesPayload<{ rota_id: string }>) => {
      console.log('[Realtime] Mudança em rota_instaladores:', payload);
      invalidateRotasQueries();
      queryClient.invalidateQueries({ queryKey: ['instaladores'] });
      queryClient.invalidateQueries({ queryKey: ['profissionais-sem-rota'] });
    };

    // Handler para mudanças na tabela instalacoes
    const handleInstalacoesChange = (payload: RealtimePostgresChangesPayload<InstalacaoPayload>) => {
      console.log('[Realtime] Mudança em instalacoes:', payload);
      invalidateRotasQueries();
      invalidateServicosQueries();

      if (payload.eventType === 'UPDATE') {
        const newStatus = payload.new?.status;
        const oldStatus = (payload.old as InstalacaoPayload)?.status;

        if (newStatus !== oldStatus && newStatus === 'concluida') {
          toast.success('🔧 Instalação concluída!', {
            description: 'Um instalador finalizou uma instalação',
          });
        }

        // Se instalação foi atribuída a uma rota
        const newRotaId = payload.new?.rota_id;
        const oldRotaId = (payload.old as InstalacaoPayload)?.rota_id;
        if (newRotaId && newRotaId !== oldRotaId) {
          invalidateServicosQueries();
        }
      }
    };

    // Handler para mudanças na tabela vistorias
    const handleVistoriasChange = (payload: RealtimePostgresChangesPayload<VistoriaPayload>) => {
      console.log('[Realtime] Mudança em vistorias:', payload);
      invalidateRotasQueries();
      invalidateServicosQueries();

      if (payload.eventType === 'UPDATE') {
        const newStatus = payload.new?.status;
        const oldStatus = (payload.old as VistoriaPayload)?.status;

        if (newStatus !== oldStatus && newStatus === 'concluida') {
          toast.success('📋 Vistoria concluída!', {
            description: 'Um vistoriador finalizou uma vistoria',
          });
        }

        // Se vistoria foi atribuída a uma rota
        const newRotaId = payload.new?.rota_id;
        const oldRotaId = (payload.old as VistoriaPayload)?.rota_id;
        if (newRotaId && newRotaId !== oldRotaId) {
          invalidateServicosQueries();
        }
      }
    };

    // Handler para mudanças na tabela cotacoes (vistorias agendadas)
    const handleCotacoesChange = (payload: RealtimePostgresChangesPayload<CotacaoPayload>) => {
      console.log('[Realtime] Mudança em cotacoes:', payload);
      
      const newData = payload.new as CotacaoPayload | undefined;
      const oldData = payload.old as CotacaoPayload | undefined;
      
      // Se vistoria de cotação foi atribuída a rota ou concluída
      const newRotaId = newData?.vistoria_rota_id;
      const oldRotaId = oldData?.vistoria_rota_id;
      const newConcluida = newData?.vistoria_concluida_em;
      const oldConcluida = oldData?.vistoria_concluida_em;

      if (newRotaId !== oldRotaId || newConcluida !== oldConcluida) {
        invalidateRotasQueries();
        invalidateServicosQueries();
        queryClient.invalidateQueries({ queryKey: ['cotacoes'] });

        if (newConcluida && !oldConcluida) {
          toast.success('📋 Vistoria de cotação concluída!', {
            description: 'A vistoria agendada foi finalizada',
          });
        }
      }
    };

    // Criar canal com múltiplos listeners
    const channel = supabase
      .channel('rotas-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rotas' },
        handleRotasChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rota_instaladores' },
        handleRotaInstaladoresChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instalacoes' },
        handleInstalacoesChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vistorias' },
        handleVistoriasChange
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cotacoes' },
        handleCotacoesChange
      )
      .subscribe((status) => {
        console.log('[Realtime] Status do canal rotas:', status);
      });

    // Cleanup ao desmontar
    return () => {
      console.log('[Realtime] Removendo canal rotas');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Hook para escutar mudanças em uma rota específica.
 * Útil para o drawer de detalhes da rota.
 */
export function useRotaRealtime(rotaId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!rotaId) return;

    const channel = supabase
      .channel(`rota-${rotaId}-changes`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'rotas',
          filter: `id=eq.${rotaId}`
        },
        (payload) => {
          console.log('[Realtime] Mudança na rota específica:', payload);
          queryClient.invalidateQueries({ queryKey: ['rota', rotaId] });
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'rota_instaladores',
          filter: `rota_id=eq.${rotaId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['rota', rotaId] });
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'instalacoes',
          filter: `rota_id=eq.${rotaId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['rota', rotaId] });
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'vistorias',
          filter: `rota_id=eq.${rotaId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['rota', rotaId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rotaId, queryClient]);
}
