import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type Associado = Tables<'associados'>;
type AssociadoInsert = TablesInsert<'associados'>;
type AssociadoUpdate = TablesUpdate<'associados'>;

export interface AssociadoWithRelations extends Associado {
  planos?: Tables<'planos'> | null;
  contratos?: Tables<'contratos'> | null;
  veiculos?: Tables<'veiculos'>[];
}

export function useAssociados() {
  return useQuery({
    queryKey: ['associados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select(`
          *,
          planos (*),
          contratos (*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AssociadoWithRelations[];
    },
  });
}

export function useAssociado(id: string | undefined) {
  return useQuery({
    queryKey: ['associados', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('associados')
        .select(`
          *,
          planos (*),
          contratos (*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;

      // Fetch vehicles separately
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('*')
        .eq('associado_id', id);
      
      return { ...data, veiculos: veiculos || [] } as AssociadoWithRelations;
    },
    enabled: !!id,
  });
}

export function useCreateAssociado() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (associado: AssociadoInsert) => {
      const { data, error } = await supabase
        .from('associados')
        .insert(associado)
        .select()
        .single();
      
      if (error) throw error;
      return data as Associado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associados'] });
    },
  });
}

export function useUpdateAssociado() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: AssociadoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('associados')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Associado;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['associados', data.id] });
    },
  });
}
