import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type Contrato = Tables<'contratos'>;
type ContratoInsert = TablesInsert<'contratos'>;
type ContratoUpdate = TablesUpdate<'contratos'>;

export interface ContratoWithRelations extends Contrato {
  planos?: Tables<'planos'> | null;
  cotacoes?: Tables<'cotacoes'> | null;
  associados?: Tables<'associados'> | null;
}

export function useContratos() {
  return useQuery({
    queryKey: ['contratos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          planos (*),
          cotacoes (*),
          associados (*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ContratoWithRelations[];
    },
  });
}

export function useContrato(id: string | undefined) {
  return useQuery({
    queryKey: ['contratos', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          planos (*),
          cotacoes (*),
          associados (*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as ContratoWithRelations;
    },
    enabled: !!id,
  });
}

export function useCreateContrato() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contrato: Omit<ContratoInsert, 'numero'>) => {
      const { data, error } = await supabase
        .from('contratos')
        .insert({
          ...contrato,
          numero: 'TEMP', // Trigger will generate
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Contrato;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
  });
}

export function useUpdateContrato() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: ContratoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('contratos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Contrato;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['contratos', data.id] });
    },
  });
}

// Hook para buscar contrato de um lead específico
export function useContratoByLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ['contratos', 'lead', leadId],
    queryFn: async () => {
      if (!leadId) return null;

      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          planos (*)
        `)
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error) throw error;
      return data as ContratoWithRelations | null;
    },
    enabled: !!leadId,
  });
}
