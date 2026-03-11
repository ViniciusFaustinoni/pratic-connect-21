import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Plano = Tables<'planos'>;
type TabelaPrecoMensalidade = Tables<'tabelas_preco_mensalidade'>;

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
    queryKey: ['tabelas_preco_mensalidade', planoId, valorFipe],
    queryFn: async () => {
      // If planoId provided, look up its linha_slug first
      let linhaSlug: string | null = null;

      if (planoId) {
        const { data: mapping } = await supabase
          .from('plano_preco_map')
          .select('linha_slug')
          .eq('plano_id', planoId)
          .single();
        linhaSlug = mapping?.linha_slug || null;
      }

      let query = supabase
        .from('tabelas_preco_mensalidade')
        .select('*')
        .eq('is_active', true);
      
      if (linhaSlug) {
        query = query.eq('linha_slug', linhaSlug);
      }
      
      if (valorFipe) {
        query = query
          .lte('fipe_min', valorFipe)
          .gte('fipe_max', valorFipe);
      }
      
      const { data, error } = await query.order('fipe_min').limit(5000);
      
      if (error) throw error;
      return data as TabelaPrecoMensalidade[];
    },
  });
}

export function useTabelaPrecoByFipe(valorFipe: number | undefined) {
  return useQuery({
    queryKey: ['tabelas_preco_mensalidade', 'by_fipe', valorFipe],
    queryFn: async () => {
      if (!valorFipe) throw new Error('Valor FIPE é obrigatório');
      
      const { data, error } = await supabase
        .from('tabelas_preco_mensalidade')
        .select('*')
        .eq('is_active', true)
        .lte('fipe_min', valorFipe)
        .gte('fipe_max', valorFipe)
        .order('valor_mensal')
        .limit(5000);
      
      if (error) throw error;
      return data as TabelaPrecoMensalidade[];
    },
    enabled: !!valorFipe && valorFipe > 0,
  });
}
