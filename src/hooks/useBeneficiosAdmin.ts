import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type BeneficioAdicional = Tables<'beneficios_adicionais'>;

export interface BeneficioInput {
  codigo: string;
  nome: string;
  descricao?: string | null;
  categoria: string;
  preco: number;
  ativo?: boolean;
  ordem?: number;
  variacao_por_cota?: boolean;
  linhas_permitidas?: string[];
}

export interface BeneficioComRegioes extends BeneficioAdicional {
  beneficios_regioes?: { regiao_id: string; preco_regional: number | null }[];
}

export function useBeneficiosAdicionais() {
  return useQuery({
    queryKey: ['beneficios_adicionais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beneficios_adicionais')
        .select('*, beneficios_regioes(regiao_id, preco_regional)')
        .order('categoria', { ascending: true })
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data as BeneficioComRegioes[];
    },
  });
}

export function useBeneficiosAtivos() {
  return useQuery({
    queryKey: ['beneficios_adicionais', 'ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beneficios_adicionais')
        .select('*')
        .eq('ativo', true)
        .order('categoria', { ascending: true })
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data as BeneficioAdicional[];
    },
  });
}

export function useCreateBeneficio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ regioes, ...input }: BeneficioInput & { regioes?: { id: string; preco_regional?: number }[] }) => {
      const { data: beneficio, error } = await supabase
        .from('beneficios_adicionais')
        .insert({
          codigo: input.codigo,
          nome: input.nome,
          descricao: input.descricao || null,
          categoria: input.categoria,
          preco: input.preco,
          ativo: input.ativo ?? true,
          ordem: input.ordem ?? 0,
          variacao_por_cota: input.variacao_por_cota ?? true,
          linhas_permitidas: input.linhas_permitidas ?? [],
        })
        .select()
        .single();
      
      if (error) throw error;

      // Se houver regiões, criar os vínculos
      if (regioes && regioes.length > 0) {
        const { error: vinculoError } = await supabase
          .from('beneficios_regioes')
          .insert(regioes.map(r => ({
            beneficio_id: beneficio.id,
            regiao_id: r.id,
            preco_regional: r.preco_regional || null,
          })));
        
        if (vinculoError) throw vinculoError;
      }

      return beneficio as BeneficioAdicional;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficios_adicionais'] });
      toast.success('Benefício criado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar benefício:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Já existe um benefício com este código');
      } else {
        toast.error('Erro ao criar benefício');
      }
    },
  });
}

export function useUpdateBeneficio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, regioes, ...input }: BeneficioInput & { id: string; regioes?: { id: string; preco_regional?: number }[] }) => {
      const { data: beneficio, error } = await supabase
        .from('beneficios_adicionais')
        .update({
          codigo: input.codigo,
          nome: input.nome,
          descricao: input.descricao,
          categoria: input.categoria,
          preco: input.preco,
          ativo: input.ativo,
          ordem: input.ordem,
          variacao_por_cota: input.variacao_por_cota,
          linhas_permitidas: input.linhas_permitidas,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Atualizar vínculos de região
      if (regioes !== undefined) {
        await supabase
          .from('beneficios_regioes')
          .delete()
          .eq('beneficio_id', id);

        if (regioes.length > 0) {
          const { error: vinculoError } = await supabase
            .from('beneficios_regioes')
            .insert(regioes.map(r => ({
              beneficio_id: id,
              regiao_id: r.id,
              preco_regional: r.preco_regional || null,
            })));
          
          if (vinculoError) throw vinculoError;
        }
      }

      return beneficio as BeneficioAdicional;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficios_adicionais'] });
      toast.success('Benefício atualizado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar benefício:', error);
      toast.error('Erro ao atualizar benefício');
    },
  });
}

export function useDeleteBeneficio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('beneficios_adicionais')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficios_adicionais'] });
      toast.success('Benefício excluído com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir benefício:', error);
      toast.error('Erro ao excluir benefício');
    },
  });
}

export function useToggleBeneficioStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await supabase
        .from('beneficios_adicionais')
        .update({ ativo })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as BeneficioAdicional;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['beneficios_adicionais'] });
      toast.success(`Benefício ${data.ativo ? 'ativado' : 'desativado'}`);
    },
    onError: (error: Error) => {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do benefício');
    },
  });
}

// Categorias disponíveis para benefícios
export const CATEGORIAS_BENEFICIO = [
  { value: 'Reboque', label: 'Reboque' },
  { value: 'Terceiros', label: 'Terceiros' },
  { value: 'Vidros', label: 'Vidros' },
  { value: 'Kit', label: 'Kit' },
  { value: 'Combustivel', label: 'Combustível' },
  { value: 'Passageiros', label: 'Passageiros' },
  { value: 'Rastreador', label: 'Rastreador' },
  { value: 'Reserva', label: 'Carro Reserva' },
  { value: 'Combo', label: 'Combo' },
  { value: 'Outro', label: 'Outro' },
] as const;
