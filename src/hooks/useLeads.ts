import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { EtapaLead } from '@/types/vendas';

// Re-export types for backward compatibility
export type { LeadFilters, LeadWithVendedor } from '@/types/vendas';

type Lead = Tables<'leads'>;
type LeadInsert = TablesInsert<'leads'>;
type LeadUpdate = TablesUpdate<'leads'>;

// ============================================
// TIPOS DO HOOK
// ============================================

export interface UseLeadsOptions {
  filters?: {
    etapa?: string;
    origem?: string;
    vendedor_id?: string;
    data_de?: string;
    data_ate?: string;
    search?: string;
  };
  page?: number;
  perPage?: number;
  enabled?: boolean;
}

export interface LeadsResult {
  leads: Lead[];
  total: number;
  totalPages: number;
}

// ============================================
// HOOK PRINCIPAL — LISTAGEM PAGINADA
// ============================================

export function useLeads(options?: UseLeadsOptions) {
  const { filters, page = 1, perPage = 20, enabled = true } = options || {};

  return useQuery({
    queryKey: ['leads', filters, page, perPage],
    queryFn: async (): Promise<LeadsResult> => {
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' });

      // Filtro: etapa
      if (filters?.etapa && filters.etapa !== 'all') {
        query = query.eq('etapa', filters.etapa as Tables<'leads'>['etapa']);
      }

      // Filtro: origem
      if (filters?.origem && filters.origem !== 'all') {
        query = query.eq('origem', filters.origem as Tables<'leads'>['origem']);
      }

      // Filtro: vendedor
      if (filters?.vendedor_id && filters.vendedor_id !== 'all') {
        query = query.eq('vendedor_id', filters.vendedor_id);
      }

      // Filtro: período
      if (filters?.data_de) {
        query = query.gte('created_at', filters.data_de);
      }

      if (filters?.data_ate) {
        query = query.lte('created_at', filters.data_ate + 'T23:59:59');
      }

      // Filtro: busca (nome, telefone, placa, cpf)
      if (filters?.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(
          `nome.ilike.${searchTerm},telefone.ilike.${searchTerm},veiculo_placa.ilike.${searchTerm},cpf.ilike.${searchTerm}`
        );
      }

      // Paginação
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        leads: data || [],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / perPage),
      };
    },
    enabled,
  });
}

// ============================================
// HOOK — TODOS OS LEADS (KANBAN)
// ============================================

export function useAllLeads(filters?: UseLeadsOptions['filters']) {
  return useQuery({
    queryKey: ['leads', 'all', filters],
    queryFn: async () => {
      let query = supabase.from('leads').select('*');

      if (filters?.vendedor_id && filters.vendedor_id !== 'all') {
        query = query.eq('vendedor_id', filters.vendedor_id);
      }

      if (filters?.origem && filters.origem !== 'all') {
        query = query.eq('origem', filters.origem as Tables<'leads'>['origem']);
      }

      if (filters?.data_de) {
        query = query.gte('created_at', filters.data_de);
      }

      if (filters?.data_ate) {
        query = query.lte('created_at', filters.data_ate + 'T23:59:59');
      }

      if (filters?.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(
          `nome.ilike.${searchTerm},telefone.ilike.${searchTerm},veiculo_placa.ilike.${searchTerm},cpf.ilike.${searchTerm}`
        );
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
  });
}

// ============================================
// HOOK — LEAD INDIVIDUAL
// ============================================

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Lead;
    },
    enabled: !!id,
  });
}

// ============================================
// HOOK — LEADS POR ETAPA (KANBAN)
// ============================================

export function useLeadsByEtapa(etapas: EtapaLead[]) {
  return useQuery({
    queryKey: ['leads-by-etapa', etapas],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('etapa', etapas)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Agrupar por etapa
      const grouped: Record<EtapaLead, Lead[]> = {} as Record<EtapaLead, Lead[]>;
      etapas.forEach(etapa => {
        grouped[etapa] = [];
      });

      data.forEach(lead => {
        const etapa = lead.etapa as EtapaLead;
        if (grouped[etapa]) {
          grouped[etapa].push(lead);
        }
      });

      return grouped;
    },
    enabled: etapas.length > 0,
  });
}

// ============================================
// HOOK — CONTAGEM POR ETAPA
// ============================================

export function useLeadsContagem() {
  return useQuery({
    queryKey: ['leads-contagem'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('etapa');

      if (error) throw error;

      // Contar por etapa
      const contagem: Record<string, number> = {};
      data.forEach(lead => {
        contagem[lead.etapa] = (contagem[lead.etapa] || 0) + 1;
      });

      return contagem as Record<EtapaLead, number>;
    },
  });
}

// ============================================
// MUTATIONS
// ============================================

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: LeadInsert) => {
      // Pegar o usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
      // Criar o lead
      const { data, error } = await supabase
        .from('leads')
        .insert(lead)
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico
      await supabase.from('leads_historico').insert({
        lead_id: data.id,
        usuario_id: user?.id,
        acao: 'criou_lead',
        descricao: `Lead "${data.nome}" criado via formulário`,
      });

      return data as Lead;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-contagem'] });
      queryClient.invalidateQueries({ queryKey: ['leads', data.id, 'historico'] });
      toast.success('Lead criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar lead: ' + error.message);
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Lead;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', data.id] });
      queryClient.invalidateQueries({ queryKey: ['leads-contagem'] });
      toast.success('Lead atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar lead: ' + error.message);
    },
  });
}
