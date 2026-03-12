import { useState, useCallback } from 'react';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { resolverTipoUsoQuery, resolverPrecoApp } from '@/utils/precoApp';
import { normalizarCombustivelParaPricing } from '@/utils/regiaoMapping';

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
        publicSupabase
          .from('planos')
          .select('*')
          .eq('ativo', true)
          .order('ordem', { ascending: true }),
        publicSupabase
          .from('plano_preco_map')
          .select('*'),
        publicSupabase
          .from('tabelas_preco_mensalidade')
          .select('*')
          .eq('is_active', true)
          .limit(5000),
        publicSupabase
          .from('configuracoes')
          .select('chave, valor')
          .in('chave', ['taxa_fallback_carro', 'adicional_app', 'adesao_minima']),
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
      const adicionalApp = parseFloat(configMap.adicional_app || '35.90') || 35.90;
      const minimoAdesao = parseFloat(configMap.adesao_minima || '100');

      const regiaoLower = (params.regiao || 'rj').toLowerCase();
      const combustivelLower = normalizarCombustivelParaPricing(params.combustivel);

      const planos: PlanoCalculado[] = [];

      for (const plano of planosBanco) {
        const tipoUsoPlano = plano.tipo_uso?.toLowerCase() || '';
        const categoriaPlano = plano.categoria?.toLowerCase() || '';
        const linhaPlano = plano.linha?.toLowerCase() || '';
        const isPlanoAplicativo = tipoUsoPlano === 'aplicativo' || categoriaPlano === 'aplicativo';
        const isMotoLine = linhaPlano === 'advanced' || categoriaPlano === 'advanced';

        // Excluir variantes internas "aplicativo" — o preço app é resolvido pelo motor de pricing nos planos principais
        if (isPlanoAplicativo && !isMotoLine) continue;

        if (plano.fipe_minima && params.valor_fipe < Number(plano.fipe_minima)) continue;
        if (plano.fipe_maxima && params.valor_fipe > Number(plano.fipe_maxima)) continue;

        // Buscar valor_mensal da nova tabela via plano_preco_map
        const mapping = planoPrecoMap.find(m => m.plano_id === plano.id);
        const linhaSlug = mapping?.linha_slug;
        const tipoUsoOriginal = params.tipo_uso === 'aplicativo' ? 'aplicativo' : (mapping?.tipo_uso || params.tipo_uso);
        // Resolver tipo_uso para query (regras de adicional app)
        const tipoUsoPricing = linhaSlug
          ? resolverTipoUsoQuery(linhaSlug, regiaoLower, tipoUsoOriginal)
          : tipoUsoOriginal;

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

          // Aplicar adicional_mensal do plano (ex: Premium +30, Exclusive +60)
          valorMensal += Number(plano.adicional_mensal || 0);
        }

        // Aplicar desconto percentual dinâmico (ex: 5% OFF)
        const descontoPerc = Number((plano as any).desconto_percentual || 0);
        if (descontoPerc > 0) {
          valorMensal *= (1 - descontoPerc / 100);
          if (valorDesagio != null) {
            valorDesagio *= (1 - descontoPerc / 100);
          }
        }

        // Aplicar adicional app se necessário
        if (linhaSlug && tipoUsoOriginal === 'aplicativo') {
          valorMensal = resolverPrecoApp(linhaSlug, regiaoLower, tipoUsoOriginal, valorMensal, adicionalApp);
        }

        // Se não encontrou faixa de preço válida, ocultar o plano
        if (valorMensal === 0) {
          continue;
        }

        // Calcular adesão como 1% FIPE (mínimo configurável) em vez do valor fixo do plano
        const valorAdesao = Math.max(params.valor_fipe * 0.01, minimoAdesao);
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
