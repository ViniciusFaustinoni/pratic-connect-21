import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Chaves exatas que dependem de instalacoes/vistorias.
// Substitui o predicate amplo (que disparava dezenas de refetches por evento).
const INSTALACOES_KEYS = [
  ['instalacoes'],
  ['instalacoes-contagem'],
  ['instalacoes-metricas'],
  ['instalador-instalacoes'],
  ['instalacoes-disponiveis'],
] as const;

const VISTORIAS_KEYS = [
  ['vistorias'],
  ['vistorias-contagem'],
  ['vistorias-metricas'],
] as const;

export function useFilasRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    // Não monta canal sem usuário (evita canais órfãos durante boot do AuthContext)
    if (!user) return;

    const isRelevantUpdate = (payload: any) => {
      if (payload.eventType !== 'UPDATE') return true;
      const oldRow = payload.old || {};
      const newRow = payload.new || {};
      // Só invalida em UPDATE se status, data_agendada ou rota_id mudaram
      return (
        oldRow.status !== newRow.status ||
        oldRow.data_agendada !== newRow.data_agendada ||
        oldRow.rota_id !== newRow.rota_id
      );
    };

    const invalidateExact = (keys: readonly (readonly string[])[]) => {
      keys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key as unknown as string[] });
      });
    };

    const handleInstalacoesChange = (payload: any) => {
      if (!isRelevantUpdate(payload)) return;
      invalidateExact(INSTALACOES_KEYS);

      if (payload.eventType === 'INSERT') {
        toast.info('📅 Nova instalação agendada', {
          description: 'A fila de instalações foi atualizada',
        });
      }
    };

    const handleVistoriasChange = (payload: any) => {
      if (!isRelevantUpdate(payload)) return;
      invalidateExact(VISTORIAS_KEYS);

      if (payload.eventType === 'INSERT') {
        toast.info('📋 Nova vistoria agendada', {
          description: 'A fila de vistorias foi atualizada',
        });
      }
    };

    const channel = supabase
      .channel('filas-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'instalacoes' },
        handleInstalacoesChange
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'vistorias' },
        handleVistoriasChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);
}
