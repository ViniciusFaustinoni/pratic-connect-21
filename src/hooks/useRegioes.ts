import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Regiao {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  cidades: string[];
  multiplicador_preco: number;
  ativa: boolean;
  ordem: number;
  exigir_titularidade_comprovante: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegiaoInput {
  codigo: string;
  nome: string;
  descricao?: string | null;
  cidades?: string[];
  multiplicador_preco?: number;
  ativa?: boolean;
  ordem?: number;
  exigir_titularidade_comprovante?: boolean;
}

export function useRegioes() {
  return useQuery({
    queryKey: ['regioes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regioes')
        .select('*')
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data as Regiao[];
    },
  });
}

export function useRegioesAtivas() {
  return useQuery({
    queryKey: ['regioes', 'ativas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regioes')
        .select('*')
        .eq('ativa', true)
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data as Regiao[];
    },
  });
}

export function useRegiaoById(id: string | undefined) {
  return useQuery({
    queryKey: ['regiao', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('regioes')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Regiao;
    },
    enabled: !!id,
  });
}

export function useCreateRegiao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: RegiaoInput) => {
      const { data, error } = await supabase
        .from('regioes')
        .insert({
          codigo: input.codigo,
          nome: input.nome,
          descricao: input.descricao || null,
          cidades: input.cidades || [],
          multiplicador_preco: input.multiplicador_preco ?? 1.00,
          ativa: input.ativa ?? true,
          ordem: input.ordem ?? 0,
          exigir_titularidade_comprovante: input.exigir_titularidade_comprovante ?? false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Regiao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regioes'] });
      toast.success('Região criada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar região:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Já existe uma região com este código');
      } else {
        toast.error('Erro ao criar região');
      }
    },
  });
}

export function useUpdateRegiao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: RegiaoInput & { id: string }) => {
      const { data, error } = await supabase
        .from('regioes')
        .update({
          codigo: input.codigo,
          nome: input.nome,
          descricao: input.descricao,
          cidades: input.cidades,
          multiplicador_preco: input.multiplicador_preco,
          ativa: input.ativa,
          ordem: input.ordem,
          exigir_titularidade_comprovante: input.exigir_titularidade_comprovante,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Regiao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regioes'] });
      toast.success('Região atualizada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar região:', error);
      toast.error('Erro ao atualizar região');
    },
  });
}

export function useDeleteRegiao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('regioes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regioes'] });
      toast.success('Região excluída com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir região:', error);
      toast.error('Erro ao excluir região');
    },
  });
}

export function useToggleRegiaoStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { data, error } = await supabase
        .from('regioes')
        .update({ ativa })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Regiao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['regioes'] });
      toast.success(`Região ${data.ativa ? 'ativada' : 'desativada'}`);
    },
    onError: (error: Error) => {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status da região');
    },
  });
}
