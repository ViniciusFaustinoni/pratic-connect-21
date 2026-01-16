import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Plano = Tables<'planos'>;

export interface PlanoInput {
  codigo: string;
  nome: string;
  descricao?: string | null;
  linha?: string | null;
  cobertura_fipe?: number | null;
  ano_minimo?: number | null;
  coberturas?: string[] | null;
  valor_adesao?: number;
  destaque?: boolean;
  ativo?: boolean;
  ordem?: number | null;
}

export interface PlanoComRegioes extends Plano {
  planos_regioes?: { regiao_id: string }[];
}

export function usePlanosAdmin() {
  return useQuery({
    queryKey: ['planos_admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('*, planos_regioes(regiao_id)')
        .order('linha', { ascending: true })
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data as PlanoComRegioes[];
    },
  });
}

export function useCreatePlano() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ regioes, ...input }: PlanoInput & { regioes?: string[] }) => {
      // Criar o plano
      const { data: plano, error } = await supabase
        .from('planos')
        .insert({
          codigo: input.codigo,
          nome: input.nome,
          descricao: input.descricao || null,
          linha: input.linha || null,
          cobertura_fipe: input.cobertura_fipe ?? 100,
          ano_minimo: input.ano_minimo ?? 2005,
          coberturas: input.coberturas || null,
          valor_adesao: input.valor_adesao ?? 0,
          destaque: input.destaque ?? false,
          ativo: input.ativo ?? true,
          ordem: input.ordem ?? 100,
          tipo_uso: 'particular',
        })
        .select()
        .single();
      
      if (error) throw error;

      // Se houver regiões, criar os vínculos
      if (regioes && regioes.length > 0) {
        const { error: vinculoError } = await supabase
          .from('planos_regioes')
          .insert(regioes.map(regiaoId => ({
            plano_id: plano.id,
            regiao_id: regiaoId,
          })));
        
        if (vinculoError) throw vinculoError;
      }

      return plano as Plano;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      queryClient.invalidateQueries({ queryKey: ['planos_admin'] });
      toast.success('Plano criado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar plano:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Já existe um plano com este código');
      } else {
        toast.error('Erro ao criar plano');
      }
    },
  });
}

export function useUpdatePlano() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, regioes, ...input }: PlanoInput & { id: string; regioes?: string[] }) => {
      // Atualizar o plano
      const { data: plano, error } = await supabase
        .from('planos')
        .update({
          codigo: input.codigo,
          nome: input.nome,
          descricao: input.descricao,
          linha: input.linha,
          cobertura_fipe: input.cobertura_fipe,
          ano_minimo: input.ano_minimo,
          coberturas: input.coberturas,
          valor_adesao: input.valor_adesao,
          destaque: input.destaque,
          ativo: input.ativo,
          ordem: input.ordem,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Atualizar vínculos de região (deletar existentes e inserir novos)
      if (regioes !== undefined) {
        // Deletar vínculos existentes
        await supabase
          .from('planos_regioes')
          .delete()
          .eq('plano_id', id);

        // Inserir novos vínculos
        if (regioes.length > 0) {
          const { error: vinculoError } = await supabase
            .from('planos_regioes')
            .insert(regioes.map(regiaoId => ({
              plano_id: id,
              regiao_id: regiaoId,
            })));
          
          if (vinculoError) throw vinculoError;
        }
      }

      return plano as Plano;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      queryClient.invalidateQueries({ queryKey: ['planos_admin'] });
      toast.success('Plano atualizado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar plano:', error);
      toast.error('Erro ao atualizar plano');
    },
  });
}

export function useDeletePlano() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('planos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      queryClient.invalidateQueries({ queryKey: ['planos_admin'] });
      toast.success('Plano excluído com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir plano:', error);
      toast.error('Erro ao excluir plano');
    },
  });
}

export function useTogglePlanoStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await supabase
        .from('planos')
        .update({ ativo })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Plano;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      queryClient.invalidateQueries({ queryKey: ['planos_admin'] });
      toast.success(`Plano ${data.ativo ? 'ativado' : 'desativado'}`);
    },
    onError: (error: Error) => {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do plano');
    },
  });
}
