import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  TipoUsoVeiculo, 
  CategoriaPlano, 
  PlanoCalculado, 
  ResultadoCalculo,
  COBERTURAS_POR_PLANO 
} from '@/types/cotacaoPublica';

interface CalcularParams {
  valor_fipe: number;
  tipo_uso: TipoUsoVeiculo;
}

interface PrecoMensal {
  categoria: string;
  valor_mensal: number;
}

interface PrecoAdesao {
  categoria: string;
  valor_adesao: number;
}

export function useCalcularCotacao() {
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const calcular = useCallback(async (params: CalcularParams) => {
    setIsLoading(true);
    setError(null);

    try {
      // Buscar preços mensais
      const { data: precosMensais, error: errorMensais } = await (supabase as any)
        .from('tabelas_preco_mensalidade')
        .select('*')
        .eq('tipo_uso', params.tipo_uso)
        .eq('is_active', true)
        .lte('fipe_min', params.valor_fipe)
        .gte('fipe_max', params.valor_fipe);

      if (errorMensais) throw errorMensais;

      // Buscar taxas de adesão
      const { data: precosAdesao, error: errorAdesao } = await (supabase as any)
        .from('tabelas_preco_adesao')
        .select('*')
        .eq('tipo_uso', params.tipo_uso)
        .eq('is_active', true)
        .lte('fipe_min', params.valor_fipe)
        .gte('fipe_max', params.valor_fipe);

      if (errorAdesao) throw errorAdesao;

      // Mapear por categoria
      const planosPorCategoria: Record<CategoriaPlano, { mensal: number; adesao: number }> = {
        'Básico': { mensal: 99.90, adesao: 249 },
        'Completo': { mensal: 134.87, adesao: 349 },
        'Premium': { mensal: 169.83, adesao: 449 },
      };

      // Processar preços mensais
      (precosMensais as PrecoMensal[] || []).forEach((preco) => {
        const categoria = preco.categoria as CategoriaPlano;
        if (planosPorCategoria[categoria]) {
          planosPorCategoria[categoria].mensal = preco.valor_mensal;
        }
      });

      // Processar taxas de adesão
      (precosAdesao as PrecoAdesao[] || []).forEach((preco) => {
        const categoria = preco.categoria as CategoriaPlano;
        if (planosPorCategoria[categoria]) {
          planosPorCategoria[categoria].adesao = preco.valor_adesao;
        }
      });

      // Montar resultado
      const planos: PlanoCalculado[] = (['Básico', 'Completo', 'Premium'] as CategoriaPlano[]).map((categoria) => {
        const valores = planosPorCategoria[categoria];
        return {
          categoria,
          valor_mensal: valores.mensal,
          valor_adesao: valores.adesao,
          valor_primeira_parcela: valores.adesao,
          coberturas: COBERTURAS_POR_PLANO[categoria],
          tag: categoria === 'Completo' ? 'Mais Popular' : categoria === 'Premium' ? 'Mais Completo' : undefined,
          destaque: categoria === 'Completo',
        };
      });

      const novoResultado: ResultadoCalculo = {
        planos,
        valor_fipe: params.valor_fipe,
        tipo_uso: params.tipo_uso,
      };

      setResultado(novoResultado);
      return novoResultado;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Erro ao calcular cotação');
      setError(errorObj);
      throw errorObj;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { calcular, resultado, isLoading, error };
}
