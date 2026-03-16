import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRegioesAtivas } from '@/hooks/useRegioes';
import { useConfigDecomposicao, useTaxaFallbackCarro, useTaxaFallbackMoto, useCotaParticipacaoDefault, useCotaMinimaDefault, useCotaDesagioDefault, useCotaMinimaDesagioDefault, useConfiguracaoNumero } from '@/hooks/useConteudosSistema';
import { resolverTipoUsoQuery, resolverPrecoApp } from '@/utils/precoApp';
import type { ConfigAdicionalApp } from '@/utils/precoApp';
import { normalizarCombustivelParaPricing } from '@/utils/regiaoMapping';
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
  elegibilidadeStatus?: 'aprovado' | 'limitado' | 'negado';
}

export interface PlanoNegadoInfo {
  planoId: string;
  planoNome: string;
  linha: string | null;
  motivo: string;
  observacao?: string;
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
  marca?: string;
  modelo?: string;
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

  // Adicional app do banco
  const { data: adicionalApp = 35.90 } = useConfiguracaoNumero('adicional_app', 35.90);

  // Buscar regiões com adicional app do banco
  const { data: regioesComAdicionalRaw } = useQuery({
    queryKey: ['configuracoes', 'regioes_com_adicional_app'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'regioes_com_adicional_app')
        .maybeSingle();
      try { return JSON.parse(data?.valor || '[]') as string[]; }
      catch { return [] as string[]; }
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar planos reais do banco de dados com product_lines
  const { data: planosBanco, isLoading } = useQuery({
    queryKey: ['planos_cotacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select(`
          *,

          product_lines:product_line_id (slug, vehicle_type, sort_priority, requires_recent_year, gradient_class, blocked_categories, supports_app)
        `)
        .eq('ativo', true)
        .eq('visivel_gestao', true)
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
        .eq('is_active', true)
        .limit(5000);
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar elegibilidade de modelos por plano
  const { data: elegibilidadeData, isLoading: elegibilidadeLoading } = useQuery({
    queryKey: ['plano_elegibilidade_modelos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_elegibilidade_modelos')
        .select('plano_id, marca, modelo, ano_min, ano_max, combustivel, status, observacao')
        .eq('is_active', true);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
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

  // ── Aliases de marca para double-check ──
  const MARCA_ALIASES: Record<string, string> = {
    'VW': 'VOLKSWAGEN',
    'GM': 'CHEVROLET',
    'MERCEDES': 'MERCEDES-BENZ',
    'CHERY': 'CAOA CHERY',
    'CITROËN': 'CITROEN',
  };

  function normalizarMarcaElegibilidade(marca: string): string {
    const upper = marca.trim().toUpperCase();
    return MARCA_ALIASES[upper] || upper;
  }

  // Função de verificação de elegibilidade por modelo
  function verificarElegibilidadeModelo(
    planoId: string,
    linha: string | null,
    veiculo: { marca: string; modelo: string; ano: number; combustivel: string },
  ): 'aprovado' | 'limitado' | 'negado' {
    // Buscar regras por linha (família) — variantes compartilham elegibilidade
    const planosNaLinha = linha
      ? (planosBanco || []).filter(p => (p.linha || '').toLowerCase() === linha).map(p => p.id)
      : [planoId];
    const regrasDoPlano = elegibilidadeData?.filter(e => planosNaLinha.includes(e.plano_id)) ?? [];
    // Sem configuração = aceita tudo
    if (regrasDoPlano.length === 0) return 'aprovado';

    const marcaNormAPI = normalizarMarcaElegibilidade(veiculo.marca);
    const modeloAPI = veiculo.modelo.trim().toUpperCase();
    const combustivelNorm = veiculo.combustivel.trim().toLowerCase();

    // Ordenar por comprimento de modelo desc → regra mais específica primeiro
    const regrasOrdenadas = [...regrasDoPlano].sort(
      (a, b) => b.modelo.length - a.modelo.length
    );

    const regra = regrasOrdenadas.find(r => {
      // Double-check de marca: normaliza ambos os lados via aliases
      const marcaNormBanco = normalizarMarcaElegibilidade(r.marca);
      const marcaMatch = marcaNormBanco === marcaNormAPI
        || r.marca.trim().toUpperCase() === veiculo.marca.trim().toUpperCase();
      
      // Normalizar modelo: remover qualificadores entre parênteses
      const modeloBanco = r.modelo.trim().toUpperCase()
        .replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      const modeloAPIClean = modeloAPI
        .replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

      // Wildcard: TODOS OS MODELOS aceita qualquer modelo
      let modeloMatch = false;
      if (modeloBanco.startsWith('TODOS')) {
        modeloMatch = true;
      } else {
        // 3 níveis de matching
        const prefixMatch = modeloAPIClean.startsWith(modeloBanco)
          || modeloBanco.startsWith(modeloAPIClean);
        const containsMatch = modeloAPIClean.includes(modeloBanco)
          || modeloBanco.includes(modeloAPIClean);
        const baseBanco = modeloBanco.split(' ')[0];
        const baseMatch = baseBanco.length >= 2 && (
          modeloAPIClean.startsWith(baseBanco + ' ') || modeloAPIClean === baseBanco
        );
        modeloMatch = prefixMatch || containsMatch || baseMatch;
      }
      
      const anoMatch = veiculo.ano >= r.ano_min &&
                       (r.ano_max === null || veiculo.ano <= r.ano_max);
      const combustivelMatch = r.combustivel === 'qualquer' ||
                               r.combustivel === combustivelNorm;
      return marcaMatch && modeloMatch && anoMatch && combustivelMatch;
    });

    // Whitelist: modelo não encontrado na lista = negado
    if (!regra) return 'negado';
    if (regra.status === 'negado') return 'negado';
    if (regra.status === 'limitado') return 'limitado';
    return 'aprovado';
  }

  // Montar ConfigAdicionalApp dinamicamente
  const configApp = useMemo<ConfigAdicionalApp>(() => {
    const linhasSupportsApp = (planosBanco || [])
      .map((p: any) => p.product_lines?.slug?.toLowerCase())
      .filter((slug: string | undefined): slug is string => !!slug && (planosBanco || []).some((p2: any) => p2.product_lines?.slug?.toLowerCase() === slug && p2.product_lines?.supports_app === true));
    
    const linhasComColunaApp = [...new Set(
      (tabelasMensalidade || [])
        .filter(t => t.tipo_uso === 'aplicativo')
        .map(t => (t.linha_slug || '').toLowerCase())
        .filter(Boolean)
    )];

    return {
      regioesComAdicional: (regioesComAdicionalRaw || []).map(r => r.toLowerCase()),
      linhasComColunaApp,
      linhasSupportsApp: [...new Set(linhasSupportsApp)],
    };
  }, [planosBanco, tabelasMensalidade, regioesComAdicionalRaw]);

  const { planos, planosNegados } = useMemo<{ planos: PlanoCotacao[]; planosNegados: PlanoNegadoInfo[] }>(() => {
    const { valorFipe, regiao, combustivel = 'gasolina', categoria, anoVeiculo } = params;

    if (!valorFipe || valorFipe <= 0 || !planosBanco) {
      return { planos: [], planosNegados: [] };
    }

    const regiaoLower = regiao.toLowerCase();
    const combustivelLower = normalizarCombustivelParaPricing(combustivel);
    const tipoVeiculo = params.tipoVeiculo || 'carro';
    const anoAtual = new Date().getFullYear();
    const anoVeiculoNum = anoVeiculo || anoAtual;

    // Percentuais de decomposição
    const decCota = decomposicao?.cota || 0.60;
    const decAdmin = decomposicao?.admin || 0.25;
    const decRastreamento = decomposicao?.rastreamento || 0.10;
    const decAssistencia = decomposicao?.assistencia || 0.05;

    const planosCalculados: PlanoCotacao[] = [];
    const negados: PlanoNegadoInfo[] = [];

    for (const plano of planosBanco) {
      const linha = plano.linha?.toLowerCase() || null;
      const tipoUsoPlano = plano.tipo_uso?.toLowerCase() || '';
      const categoriaPlano = plano.categoria?.toLowerCase() || '';
      
      // Usar product_lines para regras dinâmicas
      const plProductLine = (plano as any).product_lines;
      const vehicleType = plProductLine?.vehicle_type || null;
      const requiresRecentYear = plProductLine?.requires_recent_year || false;
      const sortPriority = plProductLine?.sort_priority || 100;

      // Excluir variantes internas "aplicativo" — o preço app é resolvido pelo motor de pricing nos planos principais
      const isPlanoAplicativo = tipoUsoPlano === 'aplicativo' || categoriaPlano === 'aplicativo';
      if (isPlanoAplicativo) continue;

      // Filtrar motos/carros/elétricos usando vehicle_type e linha_slug do banco
      const plSlug = plProductLine?.slug?.toLowerCase() || '';
      if (tipoVeiculo === 'moto' && vehicleType !== 'motorcycle') continue;
      if (tipoVeiculo === 'carro' && (vehicleType === 'motorcycle' || plSlug === 'eletrico')) continue;

      // Verificar ano mínimo
      const anoMinimo = plano.ano_minimo || plano.ano_minimo_veiculo || plano.ano_fabricacao_minimo || 0;
      if (anoMinimo > 0 && anoVeiculoNum < anoMinimo) continue;

      // Verificar FIPE
      if (plano.fipe_minima && valorFipe < Number(plano.fipe_minima)) continue;
      if (plano.fipe_maxima && valorFipe > Number(plano.fipe_maxima)) continue;

      // Regra de ano recente usando campo do banco
      if (requiresRecentYear && anoVeiculoNum < anoAtual - 1) continue;

      // Filtrar linhas que não suportam uso de aplicativo (dinâmico via product_lines)
      if (params.usoApp && plProductLine?.supports_app === false) {
        continue;
      }

      // Filtrar por categorias bloqueadas no product_line
      // Nota: 'aplicativo' NÃO é exceção — o bloqueio por categoria é independente do uso (app/passeio)
      const blockedCategories: string[] = plProductLine?.blocked_categories || [];
      if (categoria && categoria !== 'nenhuma' 
          && blockedCategories.length > 0 && blockedCategories.includes(categoria)) {
        continue;
      }

      // Filtrar por categorias aceitas no plano (campo categoria do plano)
      const categoriasAceitasPlano = categoriaPlano
        ? categoriaPlano.split(',').map((c: string) => c.trim().toLowerCase()).filter(Boolean)
        : [];
      if (categoriasAceitasPlano.length > 0 && categoria && categoria !== 'nenhuma') {
        const categoriaLower = categoria.toLowerCase();
        // Se o plano define categorias aceitas e a categoria do veículo não está entre elas, excluir
        if (!categoriasAceitasPlano.includes(categoriaLower) && !categoriasAceitasPlano.includes('todos')) {
          continue;
        }
      }

      // Filtrar por elegibilidade de modelo (aditivo — só aplica se dados carregados e veículo informado)
      // Usa o combustível original (não o normalizado para pricing) para compatibilidade com regras de elegibilidade
      const combustivelOriginal = (combustivel || 'flex').toLowerCase();
      let elegibilidadeStatus: 'aprovado' | 'limitado' | 'negado' | undefined = undefined;

      if (params.marca && params.modelo && anoVeiculoNum && elegibilidadeData && !elegibilidadeLoading) {
        elegibilidadeStatus = verificarElegibilidadeModelo(
          plano.id,
          {
            marca: params.marca,
            modelo: params.modelo,
            ano: anoVeiculoNum,
            combustivel: combustivelOriginal,
          },
        );

        // Planos negados são excluídos da cotação
        if (elegibilidadeStatus === 'negado') {
          negados.push({
            planoId: plano.id,
            planoNome: plano.nome,
            linha,
            motivo: 'Modelo não elegível para este plano',
          });
          continue;
        }
      }

      // === NOVA LÓGICA: Buscar valor_mensal de tabelas_preco_mensalidade ===
      const mapping = planoPrecoMap?.find(m => m.plano_id === plano.id);
      const linhaSlug = mapping?.linha_slug;
      const tipoUsoOriginal = params.usoApp ? 'aplicativo' : (mapping?.tipo_uso || 'particular');
      // Resolver tipo_uso para query (regras de adicional app)
      const tipoUsoPricing = linhaSlug
        ? resolverTipoUsoQuery(linhaSlug, regiaoLower, tipoUsoOriginal, configApp)
        : tipoUsoOriginal;

      let valorMensal = 0;
      let valorDesagio: number | null = null;

      if (linhaSlug && tabelasMensalidade) {
        // For eletrico line: ignore region (national pricing) and combustivel
        const isEletrico = linhaSlug === 'eletrico';
        const faixa = tabelasMensalidade.find(t =>
          t.linha_slug === linhaSlug &&
          (isEletrico || t.regiao === regiaoLower) &&
          t.tipo_uso === tipoUsoPricing &&
          (isEletrico || t.combustivel_tipo === combustivelLower || t.combustivel_tipo === null) &&
          valorFipe >= t.fipe_min &&
          valorFipe <= t.fipe_max
        );

        if (faixa) {
          valorMensal = faixa.valor_mensal;
          valorDesagio = faixa.valor_desagio;
        }
      }

      // Aplicar adicional app se necessário
      if (linhaSlug && tipoUsoOriginal === 'aplicativo') {
        valorMensal = resolverPrecoApp(linhaSlug, regiaoLower, tipoUsoOriginal, valorMensal, adicionalApp, configApp);
      }

      // Se não encontrou faixa de preço válida, ocultar o plano
      if (valorMensal === 0) {
        continue;
      }

      // Aplicar adicional_mensal do plano (ex: Premium +30, Exclusive +60)
      const adicionalMensal = Number(plano.adicional_mensal || 0);
      const valorBase = valorMensal;
      valorMensal += adicionalMensal;

      // Aplicar desconto percentual do plano (ex: 5% OFF)
      const descontoPerc = Number(plano.desconto_percentual || 0);
      if (descontoPerc > 0) {
        valorMensal *= (1 - descontoPerc / 100);
        if (valorDesagio != null) {
          valorDesagio *= (1 - descontoPerc / 100);
        }
      }

      console.log(`[AJUSTE] ${plano.nome}: base=${valorBase} + adicional=${adicionalMensal} - desconto=${descontoPerc}% = final=${Math.round(valorMensal * 100) / 100}`);

      // Adesão
      const valorAdesao = Number(plano.valor_adesao);

      // Cota
      const cotaBase = Number(plano.cota_participacao) || cotaParticipacaoDefault;
      const cotaMinima = Number(plano.cota_minima) || cotaMinimaDefault;
      let cotaPercentual = cotaBase;
      let cotaMinimaFinal = cotaMinima;

      // Usar cota de desagio para uso aplicativo (baseado no parâmetro usoApp, não na categoria)
      if (params.usoApp) {
        cotaPercentual = Number(plano.cota_desagio) || cotaDesagioDefault;
        cotaMinimaFinal = Number(plano.cota_minima_desagio) || cotaMinimaDesagioDefault;
      }

      // Deságio para elegibilidade limitada (mesma lógica de app — cota maior)
      if (elegibilidadeStatus === 'limitado') {
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
        elegibilidadeStatus,
      });
    }

    // Ordenar por sort_priority do product_lines (dinâmico do banco)
    const sorted = planosCalculados.sort((a, b) => {
      const aPriority = planosBanco.find(p => p.id === a.id);
      const bPriority = planosBanco.find(p => p.id === b.id);
      const aSortP = (aPriority as any)?.product_lines?.sort_priority || 100;
      const bSortP = (bPriority as any)?.product_lines?.sort_priority || 100;
      if (aSortP !== bSortP) return aSortP - bSortP;
      return a.valorMensal - b.valorMensal;
    });

    return { planos: sorted, planosNegados: negados };
  }, [params, planosBanco, planoPrecoMap, tabelasMensalidade, benefitExclusions, regioes, decomposicao, taxaFallbackCarro, taxaFallbackMoto, cotaParticipacaoDefault, cotaMinimaDefault, cotaDesagioDefault, cotaMinimaDesagioDefault, adicionalApp, elegibilidadeData, elegibilidadeLoading, configApp]);

  return {
    planos,
    planosNegados,
    isLoading: isLoading || elegibilidadeLoading,
  };
}

export type { CalcularPlanosParams };
