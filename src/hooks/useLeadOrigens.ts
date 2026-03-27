import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadOrigem {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useLeadOrigens(apenasAtivas = false) {
  return useQuery({
    queryKey: ['lead-origens', apenasAtivas],
    queryFn: async () => {
      let query = supabase
        .from('lead_origens')
        .select('*')
        .order('categoria')
        .order('nome');

      if (apenasAtivas) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LeadOrigem[];
    },
  });
}

export function useLeadOrigensPorCategoria(categoria: string | undefined) {
  return useQuery({
    queryKey: ['lead-origens', 'categoria', categoria],
    queryFn: async () => {
      if (!categoria) return [];
      const { data, error } = await supabase
        .from('lead_origens')
        .select('*')
        .eq('categoria', categoria)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as LeadOrigem[];
    },
    enabled: !!categoria,
  });
}

interface CreateLeadOrigemData {
  nome: string;
  categoria: string;
  descricao?: string;
}

export function useCreateLeadOrigem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateLeadOrigemData) => {
      const { data: result, error } = await supabase
        .from('lead_origens')
        .insert({
          nome: data.nome,
          categoria: data.categoria,
          descricao: data.descricao || null,
        })
        .select()
        .single();
      if (error) throw error;
      return result as LeadOrigem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-origens'] });
    },
  });
}

interface UpdateLeadOrigemData {
  id: string;
  nome?: string;
  categoria?: string;
  descricao?: string | null;
  ativo?: boolean;
}

export function useUpdateLeadOrigem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateLeadOrigemData) => {
      const { data: result, error } = await supabase
        .from('lead_origens')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result as LeadOrigem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-origens'] });
    },
  });
}

export function useDeleteLeadOrigem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_origens')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-origens'] });
    },
  });
}
