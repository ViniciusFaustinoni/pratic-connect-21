import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// TIPOS
// ============================================

export interface PlanoCalculado {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  valor_mensal: number;
  valor_desagio: number | null;
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
  regiao?: string;
  combustivel?: string;
}

/**
 * Hook para calcular cotação pública buscando planos e preços do banco de dados.
 * Usa tabelas_preco_mensalidade + plano_preco_map como fonte de preços.
 */
export function useCalcularCotacao() {
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const calcular = useCallback(async (params: CalcularParams) => {
    setIsLoading(true);
    setError(null);

    try {
      // Buscar planos ativos, mapeamento e preços em paralelo
      const [planosRes, mapRes, mensalidadeRes, configRes] = await Promise.all([
        supabase
          .from('planos')
          .select('*')
          .eq('ativo', true)
          .order('ordem', { ascending: true }),
        supabase
          .from('plano_preco_map')
          .select('*'),
        supabase
          .from('tabelas_preco_mensalidade')
          .select('*')
          .eq('is_active', true),
        supabase
          .from('configuracoes')
          .select('chave, valor')
          .in('chave', ['taxa_fallback_carro']),
      ]);

      if (planosRes.error) throw planosRes.error;
      const planosBanco = planosRes.data;

      if (!planosBanco || planosBanco.length === 0) {
        throw new Error('Nenhum plano ativo encontrado no banco de dados');
      }

      const planoPrecoMap = mapRes.data || [];
      const tabelasMensalidade = mensalidadeRes.data || [];
      
      // Taxa fallback dinâmica
      const configMap = Object.fromEntries((configRes.data || []).map(c => [c.chave, c.valor]));
      const taxaFallback = parseFloat(configMap.taxa_fallback_carro || '0.025');

      const regiaoLower = (params.regiao || 'rj').toLowerCase();
      const combustivelLower = (params.combustivel || 'gasolina').toLowerCase();

      const planos: PlanoCalculado[] = [];

      for (const plano of planosBanco) {
        const tipoUsoPlano = plano.tipo_uso?.toLowerCase() || '';
        const categoriaPlano = plano.categoria?.toLowerCase() || '';
        const isPlanoAplicativo = tipoUsoPlano === 'aplicativo' || categoriaPlano === 'aplicativo';

        if (params.tipo_uso === 'aplicativo' && !isPlanoAplicativo) continue;
        if (params.tipo_uso === 'particular' && isPlanoAplicativo) continue;

        if (plano.fipe_minima && params.valor_fipe < Number(plano.fipe_minima)) continue;
        if (plano.fipe_maxima && params.valor_fipe > Number(plano.fipe_maxima)) continue;

        // Buscar valor_mensal da nova tabela via plano_preco_map
        const mapping = planoPrecoMap.find(m => m.plano_id === plano.id);
        const linhaSlug = mapping?.linha_slug;
        const tipoUsoPricing = mapping?.tipo_uso || params.tipo_uso;

        let valorMensal = 0;
        let valorDesagio: number | null = null;

        if (linhaSlug) {
          const faixa = tabelasMensalidade.find(t =>
            t.linha_slug === linhaSlug &&
            t.regiao === regiaoLower &&
            t.tipo_uso === tipoUsoPricing &&
            (t.combustivel_tipo === combustivelLower || t.combustivel_tipo === null) &&
            params.valor_fipe >= Number(t.fipe_min) &&
            params.valor_fipe <= Number(t.fipe_max)
          );

          if (faixa) {
            valorMensal = Number(faixa.valor_mensal);
            valorDesagio = faixa.valor_desagio != null ? Number(faixa.valor_desagio) : null;
          }
        }

        // Fallback
        if (valorMensal === 0) {
          valorMensal = Math.round(params.valor_fipe * taxaFallback / 12);
        }

        const valorAdesao = Number(plano.valor_adesao);
        const coberturas = Array.isArray(plano.coberturas) ? plano.coberturas as string[] : [];

        planos.push({
          id: plano.id,
          codigo: plano.codigo,
          nome: plano.nome,
          categoria: plano.categoria || plano.nome,
          valor_mensal: Math.round(valorMensal * 100) / 100,
          valor_desagio: valorDesagio != null ? Math.round(valorDesagio * 100) / 100 : null,
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
