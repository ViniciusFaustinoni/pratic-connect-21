import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface BlacklistVeiculo {
  id: string;
  placa: string;
  chassi: string | null;
  motivo: string;
  justificativa: string | null;
  tipo_reprovacao: 'vistoria_reprovada' | 'proposta_reprovada';
  veiculo_id: string | null;
  associado_id: string | null;
  contrato_id: string | null;
  cotacao_id: string | null;
  adicionado_por: string | null;
  created_at: string;
  removido_em: string | null;
  removido_por: string | null;
  ativo: boolean;
  // Relações
  associado?: { nome: string; cpf: string } | null;
  adicionado_por_profile?: { nome: string } | null;
  removido_por_profile?: { nome: string } | null;
}

// Hook para listar veículos na blacklist
export function useBlacklistVeiculos(apenasAtivos = true) {
  return useQuery({
    queryKey: ['blacklist-veiculos', apenasAtivos],
    queryFn: async (): Promise<BlacklistVeiculo[]> => {
      let query = supabase
        .from('blacklist_veiculos')
        .select(`
          *,
          associado:associados(nome, cpf),
          adicionado_por_profile:profiles!blacklist_veiculos_adicionado_por_fkey(nome),
          removido_por_profile:profiles!blacklist_veiculos_removido_por_fkey(nome)
        `)
        .order('created_at', { ascending: false });

      if (apenasAtivos) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as BlacklistVeiculo[];
    },
  });
}

// Hook para verificar se uma placa está na blacklist
export function useVerificarBlacklist(placa: string | undefined) {
  return useQuery({
    queryKey: ['blacklist-check', placa],
    queryFn: async () => {
      if (!placa) return null;

      const { data, error } = await supabase
        .from('blacklist_veiculos')
        .select('id, motivo, tipo_reprovacao, created_at')
        .eq('placa', placa.toUpperCase().replace(/[^A-Z0-9]/g, ''))
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!placa,
  });
}

// Hook para adicionar veículo à blacklist
export function useAdicionarBlacklist() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      placa: string;
      chassi?: string;
      motivo: string;
      justificativa?: string;
      tipo_reprovacao: 'vistoria_reprovada' | 'proposta_reprovada';
      veiculo_id?: string;
      associado_id?: string;
      contrato_id?: string;
      cotacao_id?: string;
    }) => {
      const { error } = await supabase
        .from('blacklist_veiculos')
        .insert({
          placa: data.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
          chassi: data.chassi,
          motivo: data.motivo,
          justificativa: data.justificativa,
          tipo_reprovacao: data.tipo_reprovacao,
          veiculo_id: data.veiculo_id,
          associado_id: data.associado_id,
          contrato_id: data.contrato_id,
          cotacao_id: data.cotacao_id,
          adicionado_por: profile?.id,
          ativo: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist-veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['blacklist-check'] });
      toast.success('Veículo adicionado à blacklist');
    },
    onError: (error) => {
      console.error('Erro ao adicionar à blacklist:', error);
      toast.error('Erro ao adicionar veículo à blacklist');
    },
  });
}

// Hook para remover veículo da blacklist (marcar como inativo)
export function useRemoverBlacklist() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blacklist_veiculos')
        .update({
          ativo: false,
          removido_em: new Date().toISOString(),
          removido_por: profile?.id,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist-veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['blacklist-check'] });
      toast.success('Veículo removido da blacklist');
    },
    onError: (error) => {
      console.error('Erro ao remover da blacklist:', error);
      toast.error('Erro ao remover veículo da blacklist');
    },
  });
}
