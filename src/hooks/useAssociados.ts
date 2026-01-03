import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { StatusAssociado } from '@/types/database';

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
          contratos (*),
          veiculos (id, placa, marca, modelo)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AssociadoWithRelations[];
    },
  });
}

export function useAssociadosMetricas() {
  return useQuery({
    queryKey: ['associados', 'metricas'],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [ativos, emAnalise, inadimplentes, canceladosMes] = await Promise.all([
        supabase.from('associados').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('associados').select('*', { count: 'exact', head: true }).eq('status', 'em_analise'),
        supabase.from('associados').select('*', { count: 'exact', head: true }).eq('status', 'inadimplente'),
        supabase.from('associados')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'cancelado')
          .gte('updated_at', inicioMes.toISOString())
      ]);

      return {
        ativos: ativos.count || 0,
        emAnalise: emAnalise.count || 0,
        inadimplentes: inadimplentes.count || 0,
        canceladosMes: canceladosMes.count || 0
      };
    }
  });
}

export function useAssociadosCidades() {
  return useQuery({
    queryKey: ['associados', 'cidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select('cidade')
        .not('cidade', 'is', null);
      
      if (error) throw error;
      
      const cidades = [...new Set(data.map(a => a.cidade).filter(Boolean))] as string[];
      return cidades.sort();
    }
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

export function useUpdateAssociadoStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      motivo 
    }: { 
      id: string; 
      status: StatusAssociado; 
      motivo?: string;
    }) => {
      const updates: Partial<Associado> = {
        status,
        updated_at: new Date().toISOString(),
      };
      
      if (status === 'bloqueado' || status === 'suspenso' || status === 'cancelado') {
        updates.motivo_bloqueio = motivo;
        updates.data_bloqueio = new Date().toISOString();
      }
      
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
