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
          product_lines:product_line_id (slug, vehicle_type, sort_priority, requires_recent_year, gradient_class, blocked_categories, supports_app),
          planos_beneficios (id, plano_id, benefit_id, custom_text, display_order, benefits:benefit_id (id, name, category)),
          planos_regioes (regiao_id)
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
  const { data: planoPrecoMap, isLoading: planoPrecoMapLoading } = useQuery({
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
  const { data: tabelasMensalidade, isLoading: tabelasMensalidadeLoading } = useQuery({
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

  // Buscar elegibilidade de modelos por plano
  const { data: elegibilidadeData, isLoading: elegibilidadeLoading, isError: elegibilidadeError } = useQuery({
    queryKey: ['plano_elegibilidade_modelos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_elegibilidade_modelos')
        .select('plano_id, marca, modelo, ano_min, ano_max, combustivel, status, observacao, cobertura_fipe')
        .eq('is_active', true);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar exclusões de benefícios por categoria
  const { data: benefitExclusions, isLoading: benefitExclusionsLoading } = useQuery({
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
  ): { status: 'aprovado' | 'limitado' | 'negado'; coberturaFipe: number } {
    // Buscar regras por linha (família) — variantes compartilham elegibilidade
    const planosNaLinha = linha
      ? (planosBanco || []).filter(p => (p.linha || '').toLowerCase() === linha).map(p => p.id)
      : [planoId];
    const regrasDoPlano = elegibilidadeData?.filter(e => planosNaLinha.includes(e.plano_id)) ?? [];
    // Sem configuração = aceita tudo
    if (regrasDoPlano.length === 0) return { status: 'aprovado', coberturaFipe: 100 };

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
        const palavrasBanco = modeloBanco.split(' ');
        const baseBanco = palavrasBanco[0];
        const baseMatch = palavrasBanco.length === 1 && baseBanco.length >= 2 && (
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
    if (!regra) return { status: 'negado', coberturaFipe: 0 };
    if (regra.status === 'negado') return { status: 'negado', coberturaFipe: 0 };
    
    const cobFipe = (regra as any).cobertura_fipe ?? 100;
    if (regra.status === 'limitado') return { status: 'limitado', coberturaFipe: cobFipe };
    return { status: 'aprovado', coberturaFipe: cobFipe };
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

  const dependenciasCriticasLoading =
    planosBancoLoading ||
    planoPrecoMapLoading ||
    tabelasMensalidadeLoading ||
    elegibilidadeLoading ||
    cotasCategoriaLoading ||
    benefitExclusionsLoading ||
    decomposicaoLoading ||
    adicionalAppLoading ||
    regioesComAdicionalLoading ||
    categoriasDesagioLoading ||
    linhasComDesagioLoading ||
    categoriasQueSobrepoeAppLoading ||
    regioesLoading;

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

    for (const plano of planosBanco) {
      const linha = plano.linha?.toLowerCase() || null;
      const tipoUsoPlano = plano.tipo_uso?.toLowerCase() || '';
      const categoriaPlano = plano.categoria?.toLowerCase() || '';
      
      // Usar product_lines para regras dinâmicas
      const plProductLine = (plano as any).product_lines;
      const vehicleType = plProductLine?.vehicle_type || null;
      const requiresRecentYear = plProductLine?.requires_recent_year || false;
      const sortPriority = plProductLine?.sort_priority || 100;

      // Filtrar por tipo de uso: passeio vs aplicativo
      if (params.usoApp && tipoUsoPlano !== 'aplicativo' && tipoUsoPlano !== 'ambos') {
        // APP + deságio: planos 'passeio' da linha select passam (preço será de deságio, não APP)
        const appComDesagioAtivo = !!categoria && categoria !== 'nenhuma'
          && categoriasQueSobrepoeApp.includes(categoria);
        const isLinhaSelect = plProductLine?.slug?.toLowerCase()?.startsWith('select');
        if (!(appComDesagioAtivo && tipoUsoPlano === 'passeio' && isLinhaSelect)) {
          continue;
        }
      }
      if (!params.usoApp && tipoUsoPlano === 'aplicativo') continue;

      // Filtrar por regiões disponíveis (planos_regioes)
      const planoRegioes: { regiao_id: string }[] = (plano as any).planos_regioes || [];
      if (planoRegioes.length > 0 && regioes && regioes.length > 0) {
        // Encontrar o ID da região do cliente pelo código
        const regiaoCliente = regioes.find(r => r.codigo.toLowerCase() === regiaoLower);
        if (regiaoCliente) {
          const planoTemRegiao = planoRegioes.some(pr => pr.regiao_id === regiaoCliente.id);
          if (!planoTemRegiao) {
            negados.push({ planoId: plano.id, planoNome: plano.nome, linha: linha || '', motivo: 'Plano não disponível nesta região' });
            continue;
          }
        }
      }

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

      // SELECT EXCLUSIVE: ocultar quando APP + categoria de deságio combinam
      const isAppComDesagio = params.usoApp && !!categoria && categoria !== 'nenhuma'
        && categoriasQueSobrepoeApp.includes(categoria);
      if (isAppComDesagio && (plano.codigo?.toLowerCase().includes('exclusive') || plSlug === 'select-exclusive')) {
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

      // Filtrar por elegibilidade de modelo (whitelist restritiva)
      const combustivelOriginal = (combustivel || 'flex').toLowerCase();
      let elegibilidadeStatus: 'aprovado' | 'limitado' | 'negado' | undefined = undefined;
      let elegibilidadeCoberturaFipe = 100;

      // Verificar se existem regras de elegibilidade para esta linha
      const planosNaLinhaIds = linha
        ? (planosBanco || []).filter(p => (p.linha || '').toLowerCase() === linha).map(p => p.id)
        : [plano.id];
      // Fail-safe: se dados de elegibilidade não carregaram (undefined/erro), assumir que há regras → negar
      const temRegrasElegibilidade = (elegibilidadeData === undefined || elegibilidadeError)
        ? true
        : elegibilidadeData.some(e => planosNaLinhaIds.includes(e.plano_id));
      
      if (elegibilidadeData === undefined && !elegibilidadeLoading) {
        console.warn('[usePlanosCotacao] elegibilidadeData undefined — fail-safe ativado, planos com regras serão negados');
      }

      if (temRegrasElegibilidade) {
        if (params.marca && params.modelo && anoVeiculoNum) {
          const resultado = verificarElegibilidadeModelo(
            plano.id,
            linha,
            {
              marca: params.marca,
              modelo: params.modelo,
              ano: anoVeiculoNum,
              combustivel: combustivelOriginal,
            },
          );
          elegibilidadeStatus = resultado.status;
          elegibilidadeCoberturaFipe = resultado.coberturaFipe;
          console.log(`[ELEGIBILIDADE] ${plano.nome} (linha=${linha}, região=${regiaoLower}): status=${resultado.status}, cobFipe=${resultado.coberturaFipe}, veículo=${params.marca} ${params.modelo} ${anoVeiculoNum} ${combustivelOriginal}`);
        } else {
          // Regras existem mas não temos dados do veículo para validar → negar
          elegibilidadeStatus = 'negado';
          console.log(`[ELEGIBILIDADE] ${plano.nome} (linha=${linha}, região=${regiaoLower}): NEGADO (sem dados veículo)`);
        }

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
      const mappingTipoUso = mapping?.tipo_uso || 'particular';
      const isLinhaTipoUsoProprio = mappingTipoUso !== 'particular' && mappingTipoUso !== 'aplicativo' && mappingTipoUso !== 'passeio';
      const tipoUsoOriginal = isLinhaTipoUsoProprio ? mappingTipoUso : (params.usoApp ? 'aplicativo' : 'particular');
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

      // Deságio: derive flag from category
      const isDesagio = !!categoria && categoriasDesagio.includes(categoria);

      // SELECT ONE (coluna dedicada APP): ignorar deságio, usar preço APP direto
      const temColunaAppDedicada = configApp.linhasComColunaApp.includes(linhaSlug || '');

      // Aplicar valor_desagio apenas para linhas sem coluna APP dedicada
      if (isDesagio && valorDesagio != null && linhasComDesagio.includes(linhaSlug || '') && !temColunaAppDedicada) {
        valorMensal = valorDesagio;
      }

      // Adicional APP: NÃO aplicar se a categoria está em categorias_que_sobrepoe_app
      const categoriaAnulaApp = isDesagio && categoriasQueSobrepoeApp.includes(categoria || '');
      if (linhaSlug && tipoUsoOriginal === 'aplicativo' && !categoriaAnulaApp) {
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

      // Cota - Cascata: planos_cotas_categoria → plano defaults → configuracoes defaults
      const cotaBase = plano.cota_participacao != null ? Number(plano.cota_participacao) : cotaParticipacaoDefault;
      const cotaMinima = plano.cota_minima != null ? Number(plano.cota_minima) : cotaMinimaDefault;
      let cotaPercentual = cotaBase;
      let cotaMinimaFinal = cotaMinima;

      // Determinar categoria de lookup para planos_cotas_categoria
      let cotaCategoriaLookup = categoria || 'passeio';
      if (params.usoApp) cotaCategoriaLookup = 'aplicativo';
      if (elegibilidadeStatus === 'limitado' || isDesagio) cotaCategoriaLookup = 'desagio';

      // 1º: Tentar override da tabela planos_cotas_categoria
      const cotaCategoriaOverride = cotasCategoriaData?.find(
        cc => cc.plano_id === plano.id && cc.categoria_veiculo === cotaCategoriaLookup
      );

      if (cotaCategoriaOverride) {
        cotaPercentual = cotaCategoriaOverride.cota_percentual != null ? Number(cotaCategoriaOverride.cota_percentual) : cotaBase;
        cotaMinimaFinal = cotaCategoriaOverride.cota_minima_valor != null ? Number(cotaCategoriaOverride.cota_minima_valor) : cotaMinima;
        console.log(`[COTA] ${plano.nome}: override categoria '${cotaCategoriaLookup}' → ${cotaPercentual}% mín R$${cotaMinimaFinal}`);
      } else if (params.usoApp) {
        // 2º: Fallback para campos do plano (app)
        cotaPercentual = plano.cota_desagio != null ? Number(plano.cota_desagio) : cotaDesagioDefault;
        cotaMinimaFinal = plano.cota_minima_desagio != null ? Number(plano.cota_minima_desagio) : cotaMinimaDesagioDefault;
      } else if (elegibilidadeStatus === 'limitado' || isDesagio) {
        // 2º: Fallback para campos do plano (deságio)
        cotaPercentual = plano.cota_desagio != null ? Number(plano.cota_desagio) : cotaDesagioDefault;
        cotaMinimaFinal = plano.cota_minima_desagio != null ? Number(plano.cota_minima_desagio) : cotaMinimaDesagioDefault;
      }

      const cotaString = cotaMinimaFinal === 0
        ? `${cotaPercentual}% (sem mínimo)`
        : `${cotaPercentual}% (mín R$ ${cotaMinimaFinal.toLocaleString('pt-BR')})`;

      const coberturas = (plano.planos_beneficios || [])
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
        .map((pb: any) => pb.custom_text || pb.benefits?.name || 'Benefício');
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
        coberturaFipe: elegibilidadeStatus === 'limitado' && elegibilidadeCoberturaFipe < 100
          ? elegibilidadeCoberturaFipe
          : (plano.cobertura_fipe || 100),
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
        precoDesagioAplicado: isDesagio && valorDesagio != null && linhasComDesagio.includes(linhaSlug || '') && !temColunaAppDedicada,
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
  }, [params, planosBanco, planoPrecoMap, tabelasMensalidade, benefitExclusions, regioes, decomposicao, taxaFallbackCarro, taxaFallbackMoto, cotaParticipacaoDefault, cotaMinimaDefault, cotaDesagioDefault, cotaMinimaDesagioDefault, adicionalApp, elegibilidadeData, elegibilidadeError, elegibilidadeLoading, configApp, cotasCategoriaData, categoriasQueSobrepoeApp, dependenciasCriticasLoading]);

  return {
    planos,
    planosNegados,
    isLoading: dependenciasCriticasLoading,
  };
}

export type { CalcularPlanosParams };
