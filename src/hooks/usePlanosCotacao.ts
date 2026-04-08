import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRegioesAtivas } from '@/hooks/useRegioes';
import { useConfigDecomposicao, useTaxaFallbackCarro, useTaxaFallbackMoto, useCotaParticipacaoDefault, useCotaMinimaDefault, useCotaDesagioDefault, useCotaMinimaDesagioDefault, useConfiguracaoNumero } from '@/hooks/useConteudosSistema';
import type { ConfigAdicionalApp } from '@/utils/precoApp';
import { normalizarCombustivelParaPricing } from '@/utils/regiaoMapping';


import { useAllEligibilityRules, checkAllRules, findModelEligibility, type VehicleContext, type EligibilityRule } from '@/hooks/useEntityEligibilityRules';

const CATEGORIAS_DESAGIO_FALLBACK = ['chassi_remarcado', 'placa_vermelha', 'ex_taxi', 'taxi', 'leilao', 'ressarcimento_integral'];
const LINHAS_COM_DESAGIO_FALLBACK = ['select', 'lancamento'];

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
  precoDesagioAplicado?: boolean;
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
  const { data: regioes, isLoading: regioesLoading } = useRegioesAtivas();
  
  // Buscar taxas fallback do banco
  const { data: taxaFallbackCarro = 0.025 } = useTaxaFallbackCarro();
  const { data: taxaFallbackMoto = 0.03 } = useTaxaFallbackMoto();
  
  // Buscar decomposição do banco
  const { data: decomposicao, isLoading: decomposicaoLoading } = useConfigDecomposicao();

  // Defaults de cota do banco
  const { data: cotaParticipacaoDefault = 6 } = useCotaParticipacaoDefault();
  const { data: cotaMinimaDefault = 1200 } = useCotaMinimaDefault();
  const { data: cotaDesagioDefault = 8 } = useCotaDesagioDefault();
  const { data: cotaMinimaDesagioDefault = 2000 } = useCotaMinimaDesagioDefault();

  // Adicional app do banco
  const { data: adicionalApp = 35.90, isLoading: adicionalAppLoading } = useConfiguracaoNumero('adicional_app', 35.90);

  // Buscar regiões com adicional app do banco
  const { data: regioesComAdicionalRaw, isLoading: regioesComAdicionalLoading } = useQuery({
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

  // Buscar categorias de deságio do banco
  const { data: categoriasDesagio = CATEGORIAS_DESAGIO_FALLBACK, isLoading: categoriasDesagioLoading } = useQuery({
    queryKey: ['configuracoes', 'categorias_desagio'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'categorias_desagio')
        .maybeSingle();
      try { return JSON.parse(data?.valor || '[]') as string[]; }
      catch { return CATEGORIAS_DESAGIO_FALLBACK; }
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar linhas com deságio do banco
  const { data: linhasComDesagio = LINHAS_COM_DESAGIO_FALLBACK, isLoading: linhasComDesagioLoading } = useQuery({
    queryKey: ['configuracoes', 'linhas_com_desagio'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'linhas_com_desagio')
        .maybeSingle();
      try { return JSON.parse(data?.valor || '[]') as string[]; }
      catch { return LINHAS_COM_DESAGIO_FALLBACK; }
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar categorias que sobrepõem APP (deságio anula adicional APP)
  const { data: categoriasQueSobrepoeApp = CATEGORIAS_DESAGIO_FALLBACK, isLoading: categoriasQueSobrepoeAppLoading } = useQuery({
    queryKey: ['configuracoes', 'categorias_que_sobrepoe_app'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'categorias_que_sobrepoe_app')
        .maybeSingle();
      try { return JSON.parse(data?.valor || '[]') as string[]; }
      catch { return CATEGORIAS_DESAGIO_FALLBACK; }
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar planos reais do banco de dados com product_lines
  const { data: planosBanco, isLoading: planosBancoLoading } = useQuery({
    queryKey: ['planos_cotacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select(`
          *,
          product_lines:product_line_id (slug, vehicle_type, sort_priority, requires_recent_year, gradient_class),
          planos_beneficios (id, plano_id, benefit_id, custom_text, display_order, benefits:benefit_id (id, name, category, preco_sugerido))
        `)
        .eq('ativo', true)
        .eq('visivel_gestao', true)
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar coberturas vinculadas aos planos (para cálculo de preço)
  const { data: planoCoberturasData, isLoading: planoCoberturasLoading } = useQuery({
    queryKey: ['planos_coberturas_pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_coberturas')
        .select('plano_id, cobertura_id, coberturas:cobertura_id (nome, valor)');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar overrides de cota por categoria (planos_cotas_categoria)
  const { data: cotasCategoriaData, isLoading: cotasCategoriaLoading } = useQuery({
    queryKey: ['planos_cotas_categoria'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_cotas_categoria')
        .select('plano_id, categoria_veiculo, cota_percentual, cota_minima_valor');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Buscar regras de elegibilidade unificadas
  const { data: allEligibilityRules = [], isLoading: eligibilityRulesLoading } = useAllEligibilityRules();




  const dependenciasCriticasLoading =
    planosBancoLoading ||
    planoCoberturasLoading ||
    cotasCategoriaLoading ||
    eligibilityRulesLoading ||
    decomposicaoLoading ||
    adicionalAppLoading ||
    regioesComAdicionalLoading ||
    categoriasDesagioLoading ||
    linhasComDesagioLoading ||
    categoriasQueSobrepoeAppLoading ||
    regioesLoading;

  // Helper: build vehicle context for unified rules
  const buildVehicleContext = (p: typeof params): VehicleContext => {
    // Resolve region slug (e.g. 'rj') to UUID for eligibility rule comparison
    const regiaoSlug = p.regiao?.toLowerCase();
    const regiaoMatch = (regioes || []).find(r => 
      r.codigo?.toLowerCase() === regiaoSlug ||
      r.nome?.toLowerCase().includes(regiaoSlug || '__none__')
    );
    return {
      valorFipe: p.valorFipe,
      anoVeiculo: p.anoVeiculo || new Date().getFullYear(),
      categoriaVeiculo: p.tipoVeiculo === 'moto' ? 'moto' : 'passeio',
      categoriaEspecial: p.categoria,
      regiao: p.regiao,
      regiaoId: regiaoMatch?.id,
      marca: p.marca,
      modelo: p.modelo,
      tipoUso: p.usoApp ? 'aplicativo' : 'particular',
      combustivel: p.combustivel,
      tipoPlaca: p.categoria,
    };
  };

  const { planos, planosNegados } = useMemo<{ planos: PlanoCotacao[]; planosNegados: PlanoNegadoInfo[] }>(() => {
    const { valorFipe, regiao, combustivel = 'gasolina', categoria, anoVeiculo } = params;

    if (!valorFipe || valorFipe <= 0 || !planosBanco || dependenciasCriticasLoading) {
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
    const vehicleCtx = buildVehicleContext(params);

    for (const plano of planosBanco) {
      const linha = plano.linha?.toLowerCase() || null;
      
      // Usar product_lines para sort_priority
      const plProductLine = (plano as any).product_lines;
      const sortPriority = plProductLine?.sort_priority || 100;
      const plSlug = plProductLine?.slug?.toLowerCase() || '';

      // ── Regras unificadas de elegibilidade (entity_eligibility_rules) ──
      // Lógica de sobrescrita: regras marca_modelo do PLANO sobrescrevem as da LINHA
      const productLineId = plano.product_line_id;
      const planoRules = allEligibilityRules.filter(r => r.entity_type === 'plano' && r.entity_id === plano.id);
      const planoHasMarcaModeloRules = planoRules.some(r => r.rule_type === 'marca_modelo');
      const planoHasAnoRangeRules = planoRules.some(r => r.rule_type === 'ano_range');

      // Per-model eligibility status from linha rules
      let linhaElegibilidadeStatus: 'aprovado' | 'limitado' | 'negado' | undefined;
      let coberturaFipeOverride: number | undefined;

      // Verificar regras da LINHA (excluindo marca_modelo/ano_range se o plano já define as suas)
      if (productLineId) {
        let linhaRules = allEligibilityRules.filter(r => r.entity_type === 'linha' && r.entity_id === productLineId);
        if (planoHasMarcaModeloRules) {
          linhaRules = linhaRules.filter(r => r.rule_type !== 'marca_modelo');
        }
        if (planoHasAnoRangeRules) {
          linhaRules = linhaRules.filter(r => r.rule_type !== 'ano_range');
        }
        if (linhaRules.length > 0 && !checkAllRules(linhaRules, vehicleCtx)) {
          negados.push({ planoId: plano.id, planoNome: plano.nome, linha: linha || '', motivo: 'Bloqueado por regra da linha' });
          continue;
        }

        // Check marca_modelo rule at linha level for per-model status
        if (!planoHasMarcaModeloRules) {
          const linhaMarcaModeloRule = allEligibilityRules.find(
            r => r.entity_type === 'linha' && r.entity_id === productLineId
              && r.rule_type === 'marca_modelo' && r.is_active
          );
          if (linhaMarcaModeloRule) {
            const modelMatch = findModelEligibility(linhaMarcaModeloRule, vehicleCtx);
            if (modelMatch) {
              if (modelMatch.status === 'negado') {
                negados.push({ planoId: plano.id, planoNome: plano.nome, linha: linha || '', motivo: 'Modelo negado na linha' });
                continue;
              }
              linhaElegibilidadeStatus = modelMatch.status === 'aceito' ? 'aprovado' : modelMatch.status;
              coberturaFipeOverride = modelMatch.coberturaFipe;
            }
          }
        }
      }
      // Planos NÃO têm restrições próprias — pulamos checkAllRules de plano

      // ── Filtrar coberturas e benefícios individualmente ──
      const coberturasDoPlanoRaw = (planoCoberturasData || []).filter(pc => pc.plano_id === plano.id);
      const beneficiosDoPlanoRaw = plano.planos_beneficios || [];
      const coberturasRemovidas: string[] = [];

      // Filtrar benefícios: remove os inelegíveis, mantém o plano
      const beneficiosDoPlano = beneficiosDoPlanoRaw.filter((pb: any) => {
        const benefitRules = allEligibilityRules
          .filter(r => r.entity_type === 'beneficio' && r.entity_id === pb.benefit_id)
          .filter(r => r.rule_type !== 'fipe_range');
        if (benefitRules.length > 0 && !checkAllRules(benefitRules, vehicleCtx)) {
          const benefitName = pb.benefits?.name || pb.custom_text || 'Benefício';
          coberturasRemovidas.push(benefitName);
          console.log(`[ELEGIBILIDADE] ${plano.nome}: benefício "${benefitName}" removido por regra`);
          return false;
        }
        return true;
      });

      // Filtrar coberturas: remove as inelegíveis, mantém o plano
      const coberturasDoPlano = coberturasDoPlanoRaw.filter((pc: any) => {
        const cobId = pc.cobertura_id;
        const cobRules = allEligibilityRules
          .filter(r => r.entity_type === 'cobertura' && r.entity_id === cobId)
          .filter(r => r.rule_type !== 'fipe_range');
        if (cobRules.length > 0 && !checkAllRules(cobRules, vehicleCtx)) {
          const cobNome = pc.coberturas?.nome || 'Cobertura';
          coberturasRemovidas.push(cobNome);
          console.log(`[ELEGIBILIDADE] ${plano.nome}: cobertura "${cobNome}" removida por regra`);
          return false;
        }
        return true;
      });

      // === NOVO MODELO: Preço = Σ coberturas + Σ benefícios + taxa administrativa ===
      const somaCoberturas = coberturasDoPlano.reduce((acc, pc) => {
        const cobId = (pc as any).cobertura_id;
        const fipeRangeRule = allEligibilityRules.find(
          r => r.entity_type === 'cobertura' && r.entity_id === cobId && r.rule_type === 'fipe_range' && r.is_active
        );
        if (fipeRangeRule) {
          const faixas = (fipeRangeRule.rule_config as any)?.faixas || [];
          const faixa = faixas.find((f: any) => valorFipe >= f.de && valorFipe < f.ate);
          return acc + (faixa ? Number(faixa.valor) : 0);
        }
        const valor = (pc as any).coberturas?.valor || 0;
        return acc + Number(valor);
      }, 0);

      // Soma dos valores dos benefícios vinculados
      const somaBeneficios = (plano.planos_beneficios || []).reduce((acc: number, pb: any) => {
        const fipeRule = allEligibilityRules.find(
          r => r.entity_type === 'beneficio' && r.entity_id === pb.benefit_id
            && r.rule_type === 'fipe_range' && r.is_active
        );
        if (fipeRule) {
          const faixas = (fipeRule.rule_config as any)?.faixas || [];
          const faixa = faixas.find((f: any) => valorFipe >= f.de && valorFipe < f.ate);
          return acc + (faixa ? Number(faixa.valor) : 0);
        }
        const preco = pb.benefits?.preco_sugerido || 0;
        return acc + Number(preco);
      }, 0);

      let valorMensal = somaCoberturas + somaBeneficios;
      let valorDesagio: number | null = null;

      // Deságio: derive flag from category
      const isDesagio = !!categoria && categoriasDesagio.includes(categoria);

      // Se o plano não tem itens configurados, ocultar
      if (valorMensal === 0) {
        continue;
      }

      // Aplicar adicional_mensal do plano
      const adicionalMensal = Number(plano.adicional_mensal || 0);
      const valorBase = valorMensal;
      valorMensal += adicionalMensal;

      // Aplicar desconto percentual do plano
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

      // Cota - Cascata: planos_cotas_categoria → plano defaults → configuracoes defaults
      const cotaBase = plano.cota_participacao != null ? Number(plano.cota_participacao) : cotaParticipacaoDefault;
      const cotaMinima = plano.cota_minima != null ? Number(plano.cota_minima) : cotaMinimaDefault;
      let cotaPercentual = cotaBase;
      let cotaMinimaFinal = cotaMinima;

      // Determinar categoria de lookup para planos_cotas_categoria
      let cotaCategoriaLookup = categoria || 'passeio';
      if (params.usoApp) cotaCategoriaLookup = 'aplicativo';
      if (isDesagio) cotaCategoriaLookup = 'desagio';

      // 1º: Tentar override da tabela planos_cotas_categoria
      const cotaCategoriaOverride = cotasCategoriaData?.find(
        cc => cc.plano_id === plano.id && cc.categoria_veiculo === cotaCategoriaLookup
      );

      if (cotaCategoriaOverride) {
        cotaPercentual = cotaCategoriaOverride.cota_percentual != null ? Number(cotaCategoriaOverride.cota_percentual) : cotaBase;
        cotaMinimaFinal = cotaCategoriaOverride.cota_minima_valor != null ? Number(cotaCategoriaOverride.cota_minima_valor) : cotaMinima;
        console.log(`[COTA] ${plano.nome}: override categoria '${cotaCategoriaLookup}' → ${cotaPercentual}% mín R$${cotaMinimaFinal}`);
      } else if (params.usoApp) {
        cotaPercentual = plano.cota_desagio != null ? Number(plano.cota_desagio) : cotaDesagioDefault;
        cotaMinimaFinal = plano.cota_minima_desagio != null ? Number(plano.cota_minima_desagio) : cotaMinimaDesagioDefault;
      } else if (isDesagio) {
        cotaPercentual = plano.cota_desagio != null ? Number(plano.cota_desagio) : cotaDesagioDefault;
        cotaMinimaFinal = plano.cota_minima_desagio != null ? Number(plano.cota_minima_desagio) : cotaMinimaDesagioDefault;
      }

      const cotaString = cotaMinimaFinal === 0
        ? `${cotaPercentual}% do FIPE (sem mínimo)`
        : `${cotaPercentual}% do FIPE (mín. R$ ${cotaMinimaFinal.toLocaleString('pt-BR')})`;


      // Montar lista de itens incluídos: coberturas + benefícios
      const coberturasNomes = coberturasDoPlano
        .map((pc: any) => (pc as any).coberturas?.nome)
        .filter(Boolean) as string[];
      const beneficiosNomes = (plano.planos_beneficios || [])
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
        .map((pb: any) => pb.custom_text || pb.benefits?.name || 'Benefício');
      const coberturas = [...coberturasNomes, ...beneficiosNomes];
      const naoInclui: string[] = [];

      const isDestaque = !!plano.destaque;
      const tag: string | undefined = plano.badge_text || undefined;

      // Valores detalhados (decomposição dinâmica sobre valorMensal)
      const valorCota = 0;
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
        coberturaFipe: coberturaFipeOverride ?? plano.cobertura_fipe ?? 100,
        cota: cotaString,
        cotaPercentual,
        cotaMinima: cotaMinimaFinal,
        valorMensal: Math.round(valorMensal * 100) / 100,
        valorDesagio: valorDesagio != null ? Math.round(valorDesagio * 100) / 100 : null,
        valorAdesao: Math.round(valorAdesao * 100) / 100,
        destaque: isDestaque,
        tag,
        alertaDesagio: undefined,
        adicionalMensal: 0,
        valorCota,
        taxaAdministrativa,
        valorRastreamento,
        valorAssistencia,
        coberturasRemovidas: [],
        categoriaVeiculo: categoria,
        cotaDesagio: Number(plano.cota_desagio) || undefined,
        cotaMinimaDesagio: Number(plano.cota_minima_desagio) || undefined,
        anoMinimo: undefined,
        elegibilidadeStatus: linhaElegibilidadeStatus || undefined,
        precoDesagioAplicado: false,
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
  }, [params, planosBanco, planoCoberturasData, regioes, decomposicao, taxaFallbackCarro, taxaFallbackMoto, cotaParticipacaoDefault, cotaMinimaDefault, cotaDesagioDefault, cotaMinimaDesagioDefault, adicionalApp, cotasCategoriaData, categoriasQueSobrepoeApp, dependenciasCriticasLoading, allEligibilityRules]);

  return {
    planos,
    planosNegados,
    isLoading: dependenciasCriticasLoading,
  };
}

export type { CalcularPlanosParams };
