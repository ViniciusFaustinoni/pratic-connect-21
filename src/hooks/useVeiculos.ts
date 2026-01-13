import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type Veiculo = Tables<'veiculos'>;
type VeiculoInsert = TablesInsert<'veiculos'>;
type VeiculoUpdate = TablesUpdate<'veiculos'>;

// ============================================
// FUNÇÃO STANDALONE: BUSCAR VEÍCULO POR PLACA
// ============================================
export async function buscarVeiculoPorPlaca(placa: string): Promise<Veiculo | null> {
  // Normalizar placa (remover caracteres especiais e uppercase)
  const placaNormalizada = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  if (placaNormalizada.length < 7) return null;
  
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .or(`placa.ilike.${placaNormalizada},placa.ilike.${placa}`)
    .maybeSingle();
    
  if (error) {
    console.error('[buscarVeiculoPorPlaca] Erro:', error);
    throw error;
  }
  
  return data as Veiculo | null;
}

export function useVeiculos(associadoId?: string) {
  return useQuery({
    queryKey: ['veiculos', associadoId],
    queryFn: async () => {
      let query = supabase
        .from('veiculos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (associadoId) {
        query = query.eq('associado_id', associadoId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Veiculo[];
    },
  });
}

export function useVeiculo(id: string | undefined) {
  return useQuery({
    queryKey: ['veiculos', 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('veiculos')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Veiculo;
    },
    enabled: !!id,
  });
}

export function useCreateVeiculo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (veiculo: VeiculoInsert) => {
      const { data, error } = await supabase
        .from('veiculos')
        .insert(veiculo)
        .select()
        .single();
      
      if (error) throw error;
      return data as Veiculo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados', data.associado_id] });
    },
  });
}

export function useUpdateVeiculo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: VeiculoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('veiculos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Veiculo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos', 'detail', data.id] });
    },
  });
}
