import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { toast } from 'sonner';

export interface DadosServico {
  tipo?: string;
  data?: string;
  hora?: string;
  periodo?: string;
  endereco?: string;
  veiculo?: string;
}

export interface EncaixeUrgente {
  id: string;
  servico_id: string;
  status: 'disponivel' | 'reservado' | 'confirmado' | 'expirado' | 'cancelado';
  reservado_por: string | null;
  reservado_em: string | null;
  motivo: string;
  telefone_cliente: string;
  nome_cliente: string;
  dados_servico: DadosServico;
  expira_em: string | null;
  created_at: string;
  // Dados do profissional que reservou (join)
  reservado_por_nome?: string;
}

export function useEncaixesUrgentes() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['encaixes-urgentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('encaixes_urgentes')
        .select(`
          *,
          reservado_por_profile:profiles!encaixes_urgentes_reservado_por_fkey(nome)
        `)
        .in('status', ['disponivel', 'reservado'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((e: any) => ({
        ...e,
        reservado_por_nome: e.reservado_por_profile?.nome || null,
      })) as EncaixeUrgente[];
    },
    enabled: !!profile,
  });

  // Subscription Realtime para atualizações instantâneas
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('encaixes-urgentes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'encaixes_urgentes',
        },
        (payload) => {
          console.log('[useEncaixesUrgentes] Realtime event:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['encaixes-urgentes'] });
          
          // Notificar sobre novos encaixes
          if (payload.eventType === 'INSERT') {
            const newEncaixe = payload.new as any;
            toast.info(`⚡ Novo encaixe urgente: ${newEncaixe.nome_cliente}`, {
              description: 'Um cliente reagendou. Aceite a corrida!',
              duration: 8000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, queryClient]);

  return query;
}

// Hook para reservar encaixe com exclusividade
export function useReservarEncaixe() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (encaixeId: string) => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      // Chamar RPC com exclusividade atômica
      const { data, error } = await supabase.rpc('reservar_encaixe_urgente', {
        p_encaixe_id: encaixeId,
        p_profissional_id: profile.id,
      });

      if (error) throw error;

      if (!data) {
        throw new Error('Outro vistoriador já reservou este encaixe');
      }

      return data;
    },
    onSuccess: () => {
      toast.success('Encaixe reservado!', {
        description: 'Entre em contato com o cliente para confirmar.',
      });
      queryClient.invalidateQueries({ queryKey: ['encaixes-urgentes'] });
    },
    onError: (error: Error) => {
      toast.error('Não foi possível reservar', {
        description: error.message,
      });
    },
  });
}

// Hook para confirmar encaixe e iniciar rota
export function useConfirmarEncaixe() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (encaixeId: string) => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      // Chamar RPC que confirma e atribui a tarefa
      const { data, error } = await supabase.rpc('confirmar_encaixe_urgente', {
        p_encaixe_id: encaixeId,
        p_profissional_id: profile.id,
      });

      if (error) throw error;

      if (!data) {
        throw new Error('Não foi possível confirmar. Verifique se ainda está reservado por você.');
      }

      return data;
    },
    onSuccess: () => {
      toast.success('Encaixe confirmado!', {
        description: 'Tarefa atribuída. Você está em rota!',
      });
      queryClient.invalidateQueries({ queryKey: ['encaixes-urgentes'] });
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao confirmar', {
        description: error.message,
      });
    },
  });
}

// Hook para desistir de um encaixe reservado
export function useDesistirEncaixe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (encaixeId: string) => {
      const { error } = await supabase
        .from('encaixes_urgentes')
        .update({
          status: 'disponivel',
          reservado_por: null,
          reservado_em: null,
          expira_em: null,
        })
        .eq('id', encaixeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.info('Encaixe liberado para outros vistoriadores');
      queryClient.invalidateQueries({ queryKey: ['encaixes-urgentes'] });
    },
    onError: () => {
      toast.error('Erro ao liberar encaixe');
    },
  });
}
