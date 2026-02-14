import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Oficina, StatusOficina } from '@/types/database';

export interface OficinaFilters {
  status?: StatusOficina;
  cidade?: string;
  estado?: string;
  search?: string;
  especialidade?: string;
  marca?: string;
}

export function useOficinas(filters?: OficinaFilters) {
  return useQuery({
    queryKey: ['oficinas', filters],
    queryFn: async () => {
      let query = supabase
        .from('oficinas')
        .select('*')
        .order('razao_social');

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.cidade) {
        query = query.eq('cidade', filters.cidade);
      }
      if (filters?.estado) {
        query = query.eq('estado', filters.estado);
      }
      if (filters?.search) {
        query = query.or(`razao_social.ilike.%${filters.search}%,nome_fantasia.ilike.%${filters.search}%,cnpj.ilike.%${filters.search}%`);
      }
      if (filters?.especialidade) {
        query = query.contains('especialidades', [filters.especialidade]);
      }
      if (filters?.marca) {
        query = query.or(`marcas_atendidas.cs.{${filters.marca}},marcas_atendidas.cs.{GLOBAL}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Oficina[];
    },
  });
}

export function useOficina(id: string | undefined) {
  return useQuery({
    queryKey: ['oficina', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('oficinas')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Oficina;
    },
    enabled: !!id,
  });
}

export function useCreateOficina() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (oficina: Omit<Oficina, 'id' | 'created_at' | 'updated_at' | 'nota_media' | 'total_avaliacoes'>) => {
      const { data, error } = await supabase
        .from('oficinas')
        .insert(oficina)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oficinas'] });
      toast.success('Oficina cadastrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar oficina: ' + error.message);
    },
  });
}

export function useUpdateOficina() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Oficina> & { id: string }) => {
      const { error } = await supabase
        .from('oficinas')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['oficinas'] });
      queryClient.invalidateQueries({ queryKey: ['oficina', variables.id] });
      toast.success('Oficina atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar oficina: ' + error.message);
    },
  });
}
