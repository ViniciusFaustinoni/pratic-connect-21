import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AutoCenter {
  id: string;
  nome: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  tipo: string;
  status: string | null;
  endereco: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  whatsapp: string | null;
  telefone2: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix_chave: string | null;
  pix_tipo: string | null;
  especialidades: string[] | null;
  marcas_atendidas: string[] | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutoCenterPeca {
  id: string;
  auto_center_id: string;
  nome: string;
  valor: number | null;
  condicao: string;
  created_at: string;
}

interface UseAutoCentersParams {
  search?: string;
  tipo?: string;
  especialidade?: string;
  marca?: string;
}

export function useAutoCenters(params: UseAutoCentersParams = {}) {
  return useQuery({
    queryKey: ['auto-centers', params],
    queryFn: async () => {
      let query = supabase
        .from('auto_centers')
        .select('*')
        .order('nome');

      if (params.search) {
        query = query.ilike('nome', `%${params.search}%`);
      }
      if (params.tipo) {
        query = query.eq('tipo', params.tipo);
      }
      if (params.especialidade) {
        query = query.contains('especialidades', [params.especialidade]);
      }
      if (params.marca) {
        query = query.or(`marcas_atendidas.cs.{${params.marca}},marcas_atendidas.cs.{GLOBAL}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AutoCenter[];
    },
  });
}

export function useCreateAutoCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<AutoCenter, 'id' | 'created_at' | 'updated_at'>> & { nome: string; tipo: string }) => {
      const { error } = await supabase.from('auto_centers').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-centers'] });
      toast.success('Auto Center cadastrado com sucesso');
    },
    onError: () => toast.error('Erro ao cadastrar Auto Center'),
  });
}

export function useUpdateAutoCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<AutoCenter> & { id: string }) => {
      const { error } = await supabase.from('auto_centers').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-centers'] });
      toast.success('Auto Center atualizado com sucesso');
    },
    onError: () => toast.error('Erro ao atualizar Auto Center'),
  });
}

export function useDeleteAutoCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('auto_centers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-centers'] });
      toast.success('Auto Center excluído com sucesso');
    },
    onError: () => toast.error('Erro ao excluir Auto Center'),
  });
}

export function useAutoCenterPecas(autoCenterId: string | undefined) {
  return useQuery({
    queryKey: ['auto-center-pecas', autoCenterId],
    queryFn: async () => {
      if (!autoCenterId) return [];
      const { data, error } = await supabase
        .from('auto_center_pecas')
        .select('*')
        .eq('auto_center_id', autoCenterId)
        .order('nome');
      if (error) throw error;
      return data as AutoCenterPeca[];
    },
    enabled: !!autoCenterId,
  });
}

export function useCreatePeca() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<AutoCenterPeca, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('auto_center_pecas').insert(data);
      if (error) throw error;
    },
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['auto-center-pecas', variables.auto_center_id] });
      toast.success('Peça adicionada com sucesso');
    },
    onError: () => toast.error('Erro ao adicionar peça'),
  });
}

export function useDeletePeca() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, autoCenterId }: { id: string; autoCenterId: string }) => {
      const { error } = await supabase.from('auto_center_pecas').delete().eq('id', id);
      if (error) throw error;
      return autoCenterId;
    },
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['auto-center-pecas', variables.autoCenterId] });
      toast.success('Peça removida com sucesso');
    },
    onError: () => toast.error('Erro ao remover peça'),
  });
}
