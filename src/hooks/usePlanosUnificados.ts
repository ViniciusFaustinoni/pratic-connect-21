/** @deprecated Use usePlans() from '@/hooks/usePlans' instead */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlanoUnificado {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  coberturas: string[] | null;
  cobertura_fipe: number | null;
  ano_minimo: number | null;
  destaque: boolean | null;
  linha: string | null;
  ordem: number | null;
  valor_adesao: number;
  ativo: boolean;
  gradient_class?: string | null;
}

export function usePlanosUnificados() {
  return useQuery({
    queryKey: ['planos_unificados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('id, codigo, nome, descricao, coberturas, cobertura_fipe, ano_minimo, destaque, linha, ordem, valor_adesao, ativo, product_lines:product_line_id (gradient_class)')
        .eq('ativo', true)
        .order('ordem', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      // Flatten gradient_class from joined product_lines
      return (data || []).map((p: any) => ({
        ...p,
        gradient_class: p.product_lines?.gradient_class || null,
        product_lines: undefined,
      })) as PlanoUnificado[];
    },
  });
}

export function usePlanoById(id: string | undefined) {
  return useQuery({
    queryKey: ['plano', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('planos')
        .select('id, codigo, nome, descricao, coberturas, cobertura_fipe, ano_minimo, destaque, linha, ordem, valor_adesao, ativo')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as PlanoUnificado;
    },
    enabled: !!id,
  });
}

export function usePlanoByCodigo(codigo: string | undefined) {
  return useQuery({
    queryKey: ['plano_codigo', codigo],
    queryFn: async () => {
      if (!codigo) throw new Error('Código é obrigatório');
      
      const { data, error } = await supabase
        .from('planos')
        .select('id, codigo, nome, descricao, coberturas, cobertura_fipe, ano_minimo, destaque, linha, ordem, valor_adesao, ativo')
        .eq('codigo', codigo)
        .single();
      
      if (error) throw error;
      return data as PlanoUnificado;
    },
    enabled: !!codigo,
  });
}
