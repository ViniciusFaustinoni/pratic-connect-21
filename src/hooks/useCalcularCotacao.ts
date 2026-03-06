import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// TIPOS - Agora dinâmicos, sem categorias fixas
// ============================================

export interface PlanoCalculado {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  valor_mensal: number;
  valor_adesao: number;
  valor_primeira_parcela: number;
  coberturas: string[];
  tag?: string;
  destaque?: boolean;
}

export interface ResultadoCalculo {
  planos: PlanoCalculado[];
  valor_fipe: number;
  tipo_uso: string;
}

interface CalcularParams {
  valor_fipe: number;
  tipo_uso: 'particular' | 'aplicativo';
}

/**
 * Hook para calcular cotação pública buscando planos e preços do banco de dados.
 * Não usa categorias fixas (Básico/Completo/Premium) — retorna os planos ativos do banco.
 */
export function useCalcularCotacao() {
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const calcular = useCallback(async (params: CalcularParams) => {
    setIsLoading(true);
    setError(null);

    try {
      // Buscar planos ativos do banco
      const { data: planosBanco, error: errorPlanos } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (errorPlanos) throw errorPlanos;

      if (!planosBanco || planosBanco.length === 0) {
        throw new Error('Nenhum plano ativo encontrado no banco de dados');
      }

      // Buscar tabelas de preço aplicáveis ao valor FIPE
      const { data: tabelasPreco } = await supabase
        .from('tabelas_preco')
        .select('*')
        .eq('ativo', true);

      const faixaPreco = tabelasPreco?.find(
        f => params.valor_fipe >= Number(f.fipe_de) && params.valor_fipe <= Number(f.fipe_ate)
      );

      // Filtrar e calcular planos
      const planos: PlanoCalculado[] = [];

      for (const plano of planosBanco) {
        const tipoUsoPlano = plano.tipo_uso?.toLowerCase() || '';
        const categoriaPlano = plano.categoria?.toLowerCase() || '';
        const isPlanoAplicativo = tipoUsoPlano === 'aplicativo' || categoriaPlano === 'aplicativo';

        // Filtrar por tipo de uso
        if (params.tipo_uso === 'aplicativo' && !isPlanoAplicativo) continue;
        if (params.tipo_uso === 'particular' && isPlanoAplicativo) continue;

        // Verificar FIPE dentro da faixa
        if (plano.fipe_minima && params.valor_fipe < Number(plano.fipe_minima)) continue;
        if (plano.fipe_maxima && params.valor_fipe > Number(plano.fipe_maxima)) continue;

        // Calcular valor mensal
        let valorBase = 0;
        if (faixaPreco) {
          valorBase = Number(faixaPreco.taxa_comercial) || 0;
        }
        if (valorBase === 0) {
          valorBase = Math.round(params.valor_fipe * 0.025 / 12);
        }

        const adicionalMensal = Number(plano.adicional_mensal) || 0;
        const valorMensal = valorBase + adicionalMensal;
        const valorAdesao = Number(plano.valor_adesao);

        // Coberturas do banco
        const coberturas = Array.isArray(plano.coberturas) ? plano.coberturas as string[] : [];

        planos.push({
          id: plano.id,
          codigo: plano.codigo,
          nome: plano.nome,
          categoria: plano.categoria || plano.nome,
          valor_mensal: Math.round(valorMensal * 100) / 100,
          valor_adesao: valorAdesao,
          valor_primeira_parcela: valorAdesao,
          coberturas,
          tag: plano.badge_text || undefined,
          destaque: !!plano.destaque,
        });
      }

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
