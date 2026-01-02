import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EtapaLead } from '@/types/database';

export interface LeadHistoricoItem {
  id: string;
  lead_id: string;
  usuario_id?: string;
  etapa_anterior?: string;
  etapa_nova?: string;
  acao: string;
  descricao?: string;
  created_at: string;
  usuario?: {
    nome: string;
  };
}

export function useLeadHistorico(leadId: string | undefined) {
  return useQuery({
    queryKey: ['leads', leadId, 'historico'],
    queryFn: async () => {
      if (!leadId) throw new Error('Lead ID é obrigatório');

      const { data, error } = await supabase
        .from('leads_historico')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LeadHistoricoItem[];
    },
    enabled: !!leadId,
  });
}

interface CreateHistoricoParams {
  lead_id: string;
  etapa_anterior?: EtapaLead;
  etapa_nova?: EtapaLead;
  acao: string;
  descricao?: string;
}

export function useCreateLeadHistorico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateHistoricoParams) => {
      // Pegar o usuário atual
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('leads_historico')
        .insert({
          lead_id: params.lead_id,
          usuario_id: user?.id,
          etapa_anterior: params.etapa_anterior,
          etapa_nova: params.etapa_nova,
          acao: params.acao,
          descricao: params.descricao,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['leads', params.lead_id, 'historico'] });
    },
  });
}

/**
 * Hook para registrar mudança de etapa com histórico
 */
export function useChangeLeadEtapa() {
  const queryClient = useQueryClient();
  const createHistorico = useCreateLeadHistorico();

  return useMutation({
    mutationFn: async ({
      leadId,
      etapaAnterior,
      etapaNova,
      motivoPerda,
      observacaoPerda,
    }: {
      leadId: string;
      etapaAnterior: EtapaLead;
      etapaNova: EtapaLead;
      motivoPerda?: string;
      observacaoPerda?: string;
    }) => {
      // Preparar dados de atualização
      const updateData: Record<string, unknown> = {
        etapa: etapaNova,
        updated_at: new Date().toISOString(),
      };

      // Se é primeiro contato, registrar data
      if (etapaNova === 'contato' || etapaNova === 'contato_inicial') {
        updateData.data_primeiro_contato = new Date().toISOString();
      }

      // Se está sendo perdido
      if (etapaNova === 'perdido') {
        updateData.motivo_perda = motivoPerda;
        updateData.observacao_perda = observacaoPerda;
        updateData.data_perda = new Date().toISOString();
      }

      // Se está sendo ganho
      if (etapaNova === 'ganho') {
        updateData.data_conversao = new Date().toISOString();
      }

      // Atualizar último contato
      updateData.data_ultimo_contato = new Date().toISOString();

      // Atualizar o lead
      const { data, error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId)
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico
      let descricao = `Etapa alterada de "${etapaAnterior}" para "${etapaNova}"`;
      if (motivoPerda) {
        descricao += `. Motivo: ${motivoPerda}`;
      }
      if (observacaoPerda) {
        descricao += `. Obs: ${observacaoPerda}`;
      }

      await createHistorico.mutateAsync({
        lead_id: leadId,
        etapa_anterior: etapaAnterior,
        etapa_nova: etapaNova,
        acao: 'mudou_etapa',
        descricao,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
