import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RegraAditivo {
  tipo: 'veiculo_0km' | 'veiculo_blindado' | 'fipe_acima_de';
  ativo: boolean;
  valor_config?: string;
}

export interface TermoAditivo {
  id: string;
  nome: string;
  descricao: string | null;
  conteudo_html: string | null;
  ativo: boolean;
  regras: RegraAditivo[];
  ordem: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TermoAditivoInsert {
  nome: string;
  descricao?: string | null;
  conteudo_html?: string | null;
  ativo?: boolean;
  regras?: RegraAditivo[];
  ordem?: number;
}

export function useAditivos(filtroAtivo?: boolean | null) {
  return useQuery({
    queryKey: ['termos-aditivos', filtroAtivo],
    queryFn: async () => {
      let query = supabase
        .from('termos_aditivos')
        .select('*')
        .order('ordem', { ascending: true });

      if (filtroAtivo === true) query = query.eq('ativo', true);
      if (filtroAtivo === false) query = query.eq('ativo', false);

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as TermoAditivo[]) || [];
    },
  });
}

export function useAditivo(id: string | undefined) {
  return useQuery({
    queryKey: ['termos-aditivos', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('termos_aditivos')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as TermoAditivo;
    },
    enabled: !!id,
  });
}

export function useCreateAditivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (aditivo: TermoAditivoInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('termos_aditivos')
        .insert({ ...aditivo, created_by: user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['termos-aditivos'] });
      toast.success('Aditivo criado com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar aditivo: ' + error.message);
    },
  });
}

export function useUpdateAditivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...aditivo }: TermoAditivoInsert & { id: string }) => {
      const { data, error } = await supabase
        .from('termos_aditivos')
        .update(aditivo as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['termos-aditivos'] });
      toast.success('Aditivo atualizado com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar aditivo: ' + error.message);
    },
  });
}

export function useDeleteAditivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('termos_aditivos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['termos-aditivos'] });
      toast.success('Aditivo excluído com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir aditivo: ' + error.message);
    },
  });
}
