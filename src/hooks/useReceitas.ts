import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const sb = supabase as any;

export interface CategoriaReceita {
  codigo: string;
  nome: string;
}

export interface Receita {
  id: string;
  data: string;
  categoria_codigo: string | null;
  categoria_nome: string | null;
  descricao: string | null;
  valor: number;
  empresa_id: string | null;
  origem: string;
  observacao: string | null;
}

export interface NovaReceitaInput {
  data: string;
  categoria_codigo: string;
  categoria_nome: string;
  descricao?: string;
  valor: number;
  empresa_id?: string | null;
  observacao?: string;
}

function ultimoDia(ano: number, mes: number): string {
  const d = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function useCategoriasReceita() {
  return useQuery({
    queryKey: ['categorias-receita'],
    queryFn: async (): Promise<CategoriaReceita[]> => {
      const { data, error } = await sb
        .from('categorias_financeiras')
        .select('codigo, nome')
        .eq('tipo', 'receita')
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return (data ?? []) as CategoriaReceita[];
    },
  });
}

export function useReceitas(ano: number, mes: number) {
  return useQuery({
    queryKey: ['receitas', ano, mes],
    queryFn: async (): Promise<Receita[]> => {
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const fim = ultimoDia(ano, mes);
      const { data, error } = await sb
        .from('receitas')
        .select('*')
        .gte('data', inicio).lte('data', fim)
        .order('data', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Receita[];
    },
  });
}

export function useCriarReceita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovaReceitaInput) => {
      const { error } = await sb.from('receitas').insert({
        data: input.data,
        categoria_codigo: input.categoria_codigo,
        categoria_nome: input.categoria_nome,
        descricao: input.descricao || null,
        valor: input.valor,
        empresa_id: input.empresa_id || null,
        observacao: input.observacao || null,
        origem: 'manual',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Receita lançada!');
      qc.invalidateQueries({ queryKey: ['receitas'] });
    },
    onError: () => toast.error('Erro ao lançar receita'),
  });
}

export function useExcluirReceita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('receitas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Receita excluída');
      qc.invalidateQueries({ queryKey: ['receitas'] });
    },
    onError: () => toast.error('Erro ao excluir'),
  });
}
