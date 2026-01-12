import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PlanoInteresse {
  id: string;
  lead_id: string;
  plano_id: string;
  created_at: string;
  plano?: {
    id: string;
    nome: string;
    tipo_uso: string;
    ativo: boolean;
  };
}

export function useLeadInteressePlanos(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-interesse-planos', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('leads_interesse_planos')
        .select(`
          id,
          lead_id,
          plano_id,
          created_at,
          plano:planos (
            id,
            nome,
            tipo_uso,
            ativo
          )
        `)
        .eq('lead_id', leadId);

      if (error) throw error;
      return data as PlanoInteresse[];
    },
    enabled: !!leadId,
  });
}

export function useAddInteressePlano() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, planoId }: { leadId: string; planoId: string }) => {
      const { data, error } = await supabase
        .from('leads_interesse_planos')
        .insert({ lead_id: leadId, plano_id: planoId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-interesse-planos', leadId] });
    },
  });
}

export function useRemoveInteressePlano() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, planoId }: { leadId: string; planoId: string }) => {
      const { error } = await supabase
        .from('leads_interesse_planos')
        .delete()
        .eq('lead_id', leadId)
        .eq('plano_id', planoId);

      if (error) throw error;
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-interesse-planos', leadId] });
    },
  });
}

// Bulk fetch for Kanban - get all interesse planos for multiple leads
export function useLeadsInteressePlanosBulk(leadIds: string[]) {
  return useQuery({
    queryKey: ['leads-interesse-planos-bulk', leadIds],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('leads_interesse_planos')
        .select(`
          id,
          lead_id,
          plano_id,
          plano:planos (
            id,
            nome
          )
        `)
        .in('lead_id', leadIds);

      if (error) throw error;
      
      // Group by lead_id
      const grouped: Record<string, Array<{ id: string; nome: string }>> = {};
      for (const item of data || []) {
        if (!grouped[item.lead_id]) {
          grouped[item.lead_id] = [];
        }
        if (item.plano) {
          grouped[item.lead_id].push({
            id: (item.plano as any).id,
            nome: (item.plano as any).nome,
          });
        }
      }
      
      return grouped;
    },
    enabled: leadIds.length > 0,
    staleTime: 30000, // 30 seconds
  });
}
