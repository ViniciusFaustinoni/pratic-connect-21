import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRegioesAtivas } from '@/hooks/useRegioes';
import { useConfigDecomposicao, useTaxaFallbackCarro, useTaxaFallbackMoto, useCotaParticipacaoDefault, useCotaMinimaDefault, useCotaDesagioDefault, useCotaMinimaDesagioDefault } from '@/hooks/useConteudosSistema';
import { 
  getCoberturasRemovidasDinamico, 
  gerarMensagemAlertaCategoria,
  type BenefitExclusionData
} from '@/data/restricoesCategorias';

// ============================================
// INTERFACES
// ============================================

export interface PlanoCotacao {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  linha: string | null;
  nivel: string | null;
  coberturas: string[];
  naoInclui: string[];
  coberturaFipe: number;
  cota: string;
  cotaPercentual: number;
  cotaMinima: number;
  valorMensal: number;
  valorDesagio: number | null;
  valorAdesao: number;
  destaque: boolean;
  tag?: string;
  alertaDesagio?: string;
  adicionalMensal: number;
  valorCota?: number;
  taxaAdministrativa?: number;
  valorRastreamento?: number;
  valorAssistencia?: number;
  coberturasRemovidas: string[];
  categoriaVeiculo?: string;
  cotaDesagio?: number;
  cotaMinimaDesagio?: number;
  anoMinimo?: number;
}

interface CalcularPlanosParams {
  valorFipe: number;
  valorAdicional?: number;
  regiao: string;
  combustivel?: string;
  categoria?: string;
  anoVeiculo?: number;
  tipoVeiculo?: 'carro' | 'moto';
  usoApp?: boolean;
}

// ============================================
// HOOK PRINCIPAL
// ============================================

export function usePlanosCotacao(params: CalcularPlanosParams) {
  // Buscar regiões do banco (ainda usada para validação)
  const { data: regioes } = useRegioesAtivas();
  
  // Buscar taxas fallback do banco
  const { data: taxaFallbackCarro = 0.025 } = useTaxaFallbackCarro();
  const { data: taxaFallbackMoto = 0.03 } = useTaxaFallbackMoto();
  
  // Buscar decomposição do banco
  const { data: decomposicao } = useConfigDecomposicao();

  // Defaults de cota do banco
  const { data: cotaParticipacaoDefault = 6 } = useCotaParticipacaoDefault();
  const { data: cotaMinimaDefault = 1200 } = useCotaMinimaDefault();
  const { data: cotaDesagioDefault = 8 } = useCotaDesagioDefault();
  const { data: cotaMinimaDesagioDefault = 2000 } = useCotaMinimaDesagioDefault();

  // Buscar planos reais do banco de dados com product_lines
  const { data: planosBanco, isLoading } = useQuery({
    queryKey: ['planos_cotacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select(`
          *,
          product_lines:product_line_id (slug, vehicle_type, sort_priority, requires_recent_year, gradient_class)
        `)
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar mapeamento plano → linha_slug (nova tabela)
  const { data: planoPrecoMap } = useQuery({
    queryKey: ['plano_preco_map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_preco_map')
        .select('*');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar tabelas de preço mensalidade (nova tabela)
  const { data: tabelasMensalidade } = useQuery({
    queryKey: ['tabelas_preco_mensalidade'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tabelas_preco_mensalidade')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar exclusões de benefícios por categoria
  const { data: benefitExclusions } = useQuery({
    queryKey: ['benefit_exclusions_cotacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefit_category_exclusions')
        .select(`
          id,
          benefit_id,
          categoria_veiculo,
          benefits:benefit_id (name)
        `);
      
      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: item.id,
        benefit_id: item.benefit_id,
        categoria_veiculo: item.categoria_veiculo,
        benefit_name: item.benefits?.name || '',
      })) as BenefitExclusionData[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const planos = useMemo<PlanoCotacao[]>(() => {
    const { valorFipe, regiao, combustivel = 'gasolina', categoria, anoVeiculo } = params;

    if (!valorFipe || valorFipe <= 0 || !planosBanco) {
      return [];
    }

    const regiaoLower = regiao.toLowerCase();
    const combustivelLower = combustivel?.toLowerCase() || 'gasolina';
    const tipoVeiculo = params.tipoVeiculo || 'carro';
    const anoAtual = new Date().getFullYear();
    const anoVeiculoNum = anoVeiculo || anoAtual;

    // Percentuais de decomposição
    const decCota = decomposicao?.cota || 0.60;
    const decAdmin = decomposicao?.admin || 0.25;
    const decRastreamento = decomposicao?.rastreamento || 0.10;
    const decAssistencia = decomposicao?.assistencia || 0.05;

    const planosCalculados: PlanoCotacao[] = [];

    for (const plano of planosBanco) {
      const linha = plano.linha?.toLowerCase() || null;
      const tipoUsoPlano = plano.tipo_uso?.toLowerCase() || '';
      const categoriaPlano = plano.categoria?.toLowerCase() || '';
      
      // Usar product_lines para regras dinâmicas
      const plProductLine = (plano as any).product_lines;
      const vehicleType = plProductLine?.vehicle_type || null;
      const requiresRecentYear = plProductLine?.requires_recent_year || false;
      const sortPriority = plProductLine?.sort_priority || 100;

      // Filtro por uso
      const isPlanoAplicativo = tipoUsoPlano === 'aplicativo' || categoriaPlano === 'aplicativo';
      
      if (params.usoApp === true && !isPlanoAplicativo) continue;
      if (params.usoApp === false && isPlanoAplicativo) continue;

      // Filtrar motos/carros usando vehicle_type do banco
      if (tipoVeiculo === 'moto' && vehicleType === 'car') continue;
      if (tipoVeiculo === 'carro' && vehicleType === 'motorcycle') continue;

      // Verificar ano mínimo
      const anoMinimo = plano.ano_minimo || plano.ano_minimo_veiculo || plano.ano_fabricacao_minimo || 0;
      if (anoMinimo > 0 && anoVeiculoNum < anoMinimo) continue;

      // Verificar FIPE
      if (plano.fipe_minima && valorFipe < Number(plano.fipe_minima)) continue;
      if (plano.fipe_maxima && valorFipe > Number(plano.fipe_maxima)) continue;

      // Regra de ano recente usando campo do banco
      if (requiresRecentYear && anoVeiculoNum < anoAtual - 1) continue;

      // === NOVA LÓGICA: Buscar valor_mensal de tabelas_preco_mensalidade ===
      const mapping = planoPrecoMap?.find(m => m.plano_id === plano.id);
      const linhaSlug = mapping?.linha_slug;
      const tipoUsoPricing = mapping?.tipo_uso || (params.usoApp ? 'aplicativo' : 'particular');

      let valorMensal = 0;
      let valorDesagio: number | null = null;

      if (linhaSlug && tabelasMensalidade) {
        const faixa = tabelasMensalidade.find(t =>
          t.linha_slug === linhaSlug &&
          t.regiao === regiaoLower &&
          t.tipo_uso === tipoUsoPricing &&
          (t.combustivel_tipo === combustivelLower || t.combustivel_tipo === null) &&
          valorFipe >= t.fipe_min &&
          valorFipe <= t.fipe_max
        );

        if (faixa) {
          valorMensal = faixa.valor_mensal;
          valorDesagio = faixa.valor_desagio;
        }
      }

      // Fallback: se não encontrou na nova tabela, usar taxa fallback
      if (valorMensal === 0) {
        const taxaFallback = tipoVeiculo === 'moto' ? taxaFallbackMoto : taxaFallbackCarro;
        valorMensal = Math.round(valorFipe * taxaFallback / 12);
      }

      // Adesão
      const valorAdesao = Number(plano.valor_adesao);

      // Cota
      const cotaBase = Number(plano.cota_participacao) || cotaParticipacaoDefault;
      const cotaMinima = Number(plano.cota_minima) || cotaMinimaDefault;
      let cotaPercentual = cotaBase;
      let cotaMinimaFinal = cotaMinima;

      if (categoria === 'aplicativo') {
        cotaPercentual = Number(plano.cota_desagio) || cotaDesagioDefault;
        cotaMinimaFinal = Number(plano.cota_minima_desagio) || cotaMinimaDesagioDefault;
      }

      const cotaString = `${cotaPercentual}% (mín R$ ${cotaMinimaFinal.toLocaleString('pt-BR')})`;

      const coberturas = Array.isArray(plano.coberturas) ? plano.coberturas : [];
      const naoInclui: string[] = [];

      const isDestaque = !!plano.destaque;
      const tag: string | undefined = plano.badge_text || undefined;

      const coberturasRemovidas = getCoberturasRemovidasDinamico(categoria, benefitExclusions || []);
      const alertaDesagio = gerarMensagemAlertaCategoria(categoria, benefitExclusions || []) || undefined;

      // Valores detalhados (decomposição dinâmica sobre valorMensal)
      const valorCota = Math.round(valorMensal * decCota * 100) / 100;
      const taxaAdministrativa = Math.round(valorMensal * decAdmin * 100) / 100;
      const valorRastreamento = Math.round(valorMensal * decRastreamento * 100) / 100;
      const valorAssistencia = Math.round(valorMensal * decAssistencia * 100) / 100;

      const nivel = plano.nivel || null;

      planosCalculados.push({
        id: plano.id,
        codigo: plano.codigo,
        nome: plano.nome,
        descricao: plano.descricao || '',
        linha,
        nivel,
        coberturas: coberturas as string[],
        naoInclui,
        coberturaFipe: plano.cobertura_fipe || 100,
        cota: cotaString,
        cotaPercentual,
        cotaMinima: cotaMinimaFinal,
        valorMensal: Math.round(valorMensal * 100) / 100,
        valorDesagio: valorDesagio != null ? Math.round(valorDesagio * 100) / 100 : null,
        valorAdesao: Math.round(valorAdesao * 100) / 100,
        destaque: isDestaque,
        tag,
        alertaDesagio,
        adicionalMensal: 0, // Já incluído no valor_mensal da nova tabela
        valorCota,
        taxaAdministrativa,
        valorRastreamento,
        valorAssistencia,
        coberturasRemovidas,
        categoriaVeiculo: categoria,
        cotaDesagio: Number(plano.cota_desagio) || undefined,
        cotaMinimaDesagio: Number(plano.cota_minima_desagio) || undefined,
        anoMinimo: anoMinimo || undefined,
      });
    }

    // Ordenar por sort_priority do product_lines (dinâmico do banco)
    return planosCalculados.sort((a, b) => {
      const aPriority = planosBanco.find(p => p.id === a.id);
      const bPriority = planosBanco.find(p => p.id === b.id);
      const aSortP = (aPriority as any)?.product_lines?.sort_priority || 100;
      const bSortP = (bPriority as any)?.product_lines?.sort_priority || 100;
      if (aSortP !== bSortP) return aSortP - bSortP;
      return a.valorMensal - b.valorMensal;
    });
  }, [params, planosBanco, planoPrecoMap, tabelasMensalidade, benefitExclusions, regioes, decomposicao, taxaFallbackCarro, taxaFallbackMoto, cotaParticipacaoDefault, cotaMinimaDefault, cotaDesagioDefault, cotaMinimaDesagioDefault]);

  return {
    planos,
    isLoading,
  };
}

export type { CalcularPlanosParams };
