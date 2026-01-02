import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { EtapaLead, OrigemLead } from '@/types/database';

type Lead = Tables<'leads'>;
type LeadInsert = TablesInsert<'leads'>;
type LeadUpdate = TablesUpdate<'leads'>;

export interface LeadFilters {
  etapa?: EtapaLead | 'all';
  origem?: OrigemLead | 'all';
  vendedor_id?: string | 'all';
  data_de?: string;
  data_ate?: string;
  search?: string;
}

export interface UseLeadsOptions {
  filters?: LeadFilters;
  page?: number;
  perPage?: number;
}

export interface LeadsResult {
  leads: Lead[];
  total: number;
  totalPages: number;
}

export function useLeads(options?: UseLeadsOptions) {
  const { filters, page = 1, perPage = 20 } = options || {};

  return useQuery({
    queryKey: ['leads', filters, page, perPage],
    queryFn: async (): Promise<LeadsResult> => {
      let query = supabase.from('leads').select('*', { count: 'exact' });

      // Apply filters
      if (filters?.etapa && filters.etapa !== 'all') {
        query = query.eq('etapa', filters.etapa);
      }

      if (filters?.origem && filters.origem !== 'all') {
        query = query.eq('origem', filters.origem);
      }

      if (filters?.vendedor_id && filters.vendedor_id !== 'all') {
        query = query.eq('vendedor_id', filters.vendedor_id);
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

      // Apply pagination
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        leads: data as Lead[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / perPage),
      };
    },
  });
}

// Hook simples para buscar todos os leads (usado no Kanban)
export function useAllLeads(filters?: LeadFilters) {
  return useQuery({
    queryKey: ['leads', 'all', filters],
    queryFn: async () => {
      let query = supabase.from('leads').select('*');

      if (filters?.vendedor_id && filters.vendedor_id !== 'all') {
        query = query.eq('vendedor_id', filters.vendedor_id);
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

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: LeadInsert) => {
      const { data, error } = await supabase
        .from('leads')
        .insert(lead)
        .select()
        .single();

      if (error) throw error;
      return data as Lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
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
    },
  });
}
