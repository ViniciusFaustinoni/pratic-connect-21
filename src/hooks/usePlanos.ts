import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Plano = Tables<'planos'>;
type TabelaPreco = Tables<'tabelas_preco'>;

export function usePlanos() {
  return useQuery({
    queryKey: ['planos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data as Plano[];
    },
  });
}

export function usePlano(id: string | undefined) {
  return useQuery({
    queryKey: ['planos', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Plano;
    },
    enabled: !!id,
  });
}

export function useTabelasPreco(planoId?: string, valorFipe?: number) {
  return useQuery({
    queryKey: ['tabelas_preco', planoId, valorFipe],
    queryFn: async () => {
      let query = supabase
        .from('tabelas_preco')
        .select('*, planos(*)')
        .eq('ativo', true);
      
      if (planoId) {
        query = query.eq('plano_id', planoId);
      }
      
      if (valorFipe) {
        query = query
          .lte('fipe_de', valorFipe)
          .gte('fipe_ate', valorFipe);
      }
      
      const { data, error } = await query.order('fipe_de');
      
      if (error) throw error;
      return data as (TabelaPreco & { planos: Plano })[];
    },
  });
}

export function useTabelaPrecoByFipe(valorFipe: number | undefined) {
  return useQuery({
    queryKey: ['tabelas_preco', 'by_fipe', valorFipe],
    queryFn: async () => {
      if (!valorFipe) throw new Error('Valor FIPE é obrigatório');
      
      const { data, error } = await supabase
        .from('tabelas_preco')
        .select('*, planos(*)')
        .eq('ativo', true)
        .lte('fipe_de', valorFipe)
        .gte('fipe_ate', valorFipe)
        .order('valor_cota');
      
      if (error) throw error;
      return data as (TabelaPreco & { planos: Plano })[];
    },
    enabled: !!valorFipe && valorFipe > 0,
  });
}
