import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LeadFonte, EtapaLead } from '@/types/database';

export function useLeadFontes() {
  return useQuery({
    queryKey: ['lead-fontes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_fontes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LeadFonte[];
    },
  });
}

export function useLeadFonte(id: string | undefined) {
  return useQuery({
    queryKey: ['lead-fontes', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('lead_fontes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as LeadFonte;
    },
    enabled: !!id,
  });
}

interface CreateLeadFonteData {
  codigo: string;
  nome: string;
  descricao?: string;
  vendedor_padrao_id?: string;
  etapa_inicial?: EtapaLead;
}

export function useCreateLeadFonte() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLeadFonteData) => {
      const { data: result, error } = await supabase
        .from('lead_fontes')
        .insert({
          codigo: data.codigo,
          nome: data.nome,
          descricao: data.descricao || null,
          vendedor_padrao_id: data.vendedor_padrao_id || null,
          etapa_inicial: (data.etapa_inicial || 'novo') as 'novo',
        })
        .select()
        .single();

      if (error) throw error;
      return result as LeadFonte;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-fontes'] });
    },
  });
}

interface UpdateLeadFonteData {
  id: string;
  codigo?: string;
  nome?: string;
  descricao?: string;
  vendedor_padrao_id?: string | null;
  etapa_inicial?: EtapaLead;
  ativa?: boolean;
}

export function useUpdateLeadFonte() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateLeadFonteData) => {
      // Cast etapa_inicial to the type expected by Supabase
      const updateData: Record<string, unknown> = { ...data };
      if (data.etapa_inicial) {
        updateData.etapa_inicial = data.etapa_inicial;
      }
      
      const { data: result, error } = await supabase
        .from('lead_fontes')
        .update(updateData as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as LeadFonte;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-fontes'] });
    },
  });
}

export function useDeleteLeadFonte() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_fontes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-fontes'] });
    },
  });
}