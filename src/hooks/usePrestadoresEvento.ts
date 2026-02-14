import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PrestadorEvento {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix_chave: string | null;
  pix_tipo: string | null;
  especialidades: string[];
  marcas_atendidas: string[];
  observacoes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PrestadorFilters {
  search?: string;
  especialidade?: string;
  marca?: string;
  status?: string;
}

export function usePrestadoresEvento(filters?: PrestadorFilters) {
  return useQuery({
    queryKey: ['prestadores-evento', filters],
    queryFn: async () => {
      let query = supabase
        .from('prestadores_evento')
        .select('*')
        .order('razao_social');

      if (filters?.search) {
        query = query.or(`razao_social.ilike.%${filters.search}%,nome_fantasia.ilike.%${filters.search}%,cnpj.ilike.%${filters.search}%`);
      }
      if (filters?.especialidade) {
        query = query.contains('especialidades', [filters.especialidade]);
      }
      if (filters?.marca) {
        query = query.or(`marcas_atendidas.cs.{${filters.marca}},marcas_atendidas.cs.{GLOBAL}`);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PrestadorEvento[];
    },
  });
}

export function useCreatePrestadorEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<PrestadorEvento, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('prestadores_evento').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prestadores-evento'] });
      toast.success('Prestador cadastrado com sucesso');
    },
    onError: (e: Error) => toast.error('Erro ao cadastrar: ' + e.message),
  });
}

export function useUpdatePrestadorEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<PrestadorEvento> & { id: string }) => {
      const { error } = await supabase.from('prestadores_evento').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prestadores-evento'] });
      toast.success('Prestador atualizado com sucesso');
    },
    onError: (e: Error) => toast.error('Erro ao atualizar: ' + e.message),
  });
}

export function useDeletePrestadorEvento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('prestadores_evento').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prestadores-evento'] });
      toast.success('Prestador excluído com sucesso');
    },
    onError: () => toast.error('Erro ao excluir prestador'),
  });
}
