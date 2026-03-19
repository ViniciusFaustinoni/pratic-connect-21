import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Calculator, Check, Car, Briefcase, Search, Loader2, Bike, Fuel, ArrowRight, Shield, CalendarCheck, AlertTriangle } from 'lucide-react';
import { useTabelasPreco } from '@/hooks/usePlanos';
import { formatarMoeda } from '@/utils/format';
import { resolverTipoUsoQuery, resolverPrecoApp } from '@/utils/precoApp';
import type { ConfigAdicionalApp } from '@/utils/precoApp';
import { normalizarCombustivelParaPricing } from '@/utils/regiaoMapping';
import { detectarTipoVeiculo } from '@/data/vistoriaConfigCompleta';
import { useDetectarTipoVeiculo } from '@/hooks/useDetectarTipoVeiculo';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { maskPlaca } from '@/lib/validations';
import { calcularOpcoesVencimento } from '@/utils/vencimento';

const CATEGORIAS_DESAGIO_FALLBACK = ['chassi_remarcado', 'placa_vermelha', 'ex_taxi', 'taxi', 'leilao', 'ressarcimento_integral'];
const LINHAS_COM_DESAGIO_FALLBACK = ['select', 'lancamento'];

const CATEGORIAS_VEICULO_CALC = [
  { value: 'nenhuma', label: 'Nenhuma' },
  { value: 'leilao', label: 'Leilão' },
  { value: 'ex_taxi', label: 'Ex-táxi' },
  { value: 'taxi', label: 'Táxi' },
  { value: 'chassi_remarcado', label: 'Chassi Remarcado' },
  { value: 'placa_vermelha', label: 'Placa Vermelha' },
  { value: 'ressarcimento_integral', label: 'Ressarcimento Integral' },
] as const;

interface ResultadoPlano {
  key: string;
  planoNome: string;
  valorMensal: number;
  valorDesagio: number | null;
  adicionalMensal: number;
  descontoPercentual: number;
  sortPriority: number;
  // New fields
  valorAdesao: number;
  cotaPercentual: number;
  cotaMinima: number;
  coberturaFipe: number;
  coberturas: string[];
  precoDesagioAplicado?: boolean;
}

interface ResultadoCalc {
  planos: ResultadoPlano[];
  faixaFipe: string;
  valorFipeInformado: number;
  regiaoLabel: string;
  tipoUsoLabel: string;
  tipoVeiculoLabel: string;
}

interface VeiculoPlaca {
  marca: string;
  modelo: string;
  ano: string;
  cor: string;
  combustivel: string;
  placa: string;
}

export interface DadosParaCotacao {
  valorFipe: number;
  marca?: string;
  modelo?: string;
  ano?: number;
  placa?: string;
  regiao: string;
  planoId?: string;
}

type TipoUso = 'particular' | 'aplicativo';
type TipoVeiculo = 'carro' | 'moto';

const REGIOES = [
  { value: 'rj', label: 'Rio de Janeiro' },
  { value: 'lagos', label: 'Região dos Lagos' },
  { value: 'sp', label: 'São Paulo' },
] as const;

const TIPO_VEICULO_LABELS: Record<TipoVeiculo, string> = {
  carro: 'Carro',
  moto: 'Moto',
};

function useAdicionalApp() {
  return useQuery({
    queryKey: ['configuracoes', 'adicional_app'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'adicional_app')
        .single();
      return parseFloat(data?.valor || '35.90') || 35.90;
    },
  });
}

function useConfigAdicionalAppCalc(tabelas: any[] | undefined) {
  const { data: regioesRaw } = useQuery({
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

  const { data: productLinesData } = useQuery({
    queryKey: ['product_lines_supports_app'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_lines')
        .select('slug, supports_app');
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  return useMemo<ConfigAdicionalApp>(() => ({
    regioesComAdicional: (regioesRaw || []).map(r => r.toLowerCase()),
    linhasSupportsApp: (productLinesData || [])
      .filter(pl => pl.supports_app === true)
      .map(pl => (pl.slug || '').toLowerCase()),
    linhasComColunaApp: [...new Set(
      (tabelas || [])
        .filter((t: any) => t.tipo_uso === 'aplicativo')
        .map((t: any) => (t.linha_slug || '').toLowerCase())
        .filter(Boolean)
    )],
  }), [regioesRaw, productLinesData, tabelas]);
}

/** Fetch planos + plano_preco_map + product_lines for calculator — includes extra fields */
function usePlanosComPrecoMap() {
  return useQuery({
    queryKey: ['calculadora-planos-preco-map-v3'],
    queryFn: async () => {
      const [planosRes, mapRes, plRes] = await Promise.all([
        supabase
          .from('planos')
          .select(`id, nome, slug, adicional_mensal, desconto_percentual, visivel_gestao, ativo, categoria, fipe_minima, fipe_maxima, tipo_uso, ano_minimo, ano_minimo_veiculo, ano_fabricacao_minimo, valor_adesao, cota_participacao, cota_minima, cobertura_fipe, planos_beneficios (id, plano_id, benefit_id, custom_text, display_order, benefits:benefit_id (id, name))`)
          .eq('ativo', true)
          .eq('visivel_gestao', true)
          .order('ordem', { ascending: true }),
        supabase
          .from('plano_preco_map')
          .select('plano_id, linha_slug, tipo_uso'),
        supabase
          .from('product_lines')
          .select('slug, vehicle_type, requires_recent_year, blocked_categories, supports_app, sort_priority'),
      ]);
      return {
        planos: planosRes.data || [],
        mappings: mapRes.data || [],
        productLines: plRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Detect vehicle type from plate-lookup response (sync fallback only — hook is used in component) */
function detectarTipoFromPlaca(dados: VeiculoPlaca): TipoVeiculo {
  const tipoDetectado = detectarTipoVeiculo(undefined, dados.modelo, dados.marca);
  return tipoDetectado === 'moto' ? 'moto' : 'carro';
}

// Defaults for cota
function useCotaDefaults() {
  const { data: cotaDefault = 6 } = useQuery({
    queryKey: ['configuracoes', 'cota_participacao_default'],
    queryFn: async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'cota_participacao_default').maybeSingle();
      return parseFloat(data?.valor || '6') || 6;
    },
    staleTime: 1000 * 60 * 10,
  });
  const { data: cotaMinimaDefault = 1200 } = useQuery({
    queryKey: ['configuracoes', 'cota_minima_default'],
    queryFn: async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'cota_minima_default').maybeSingle();
      return parseFloat(data?.valor || '1200') || 1200;
    },
    staleTime: 1000 * 60 * 10,
  });
  return { cotaDefault, cotaMinimaDefault };
}

// Deságio config queries (reuse same queryKeys as cotador)
function useDesagioConfig() {
  const { data: categoriasDesagio = CATEGORIAS_DESAGIO_FALLBACK } = useQuery({
    queryKey: ['configuracoes', 'categorias_desagio'],
    queryFn: async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'categorias_desagio').maybeSingle();
      try { return JSON.parse(data?.valor || '[]') as string[]; } catch { return CATEGORIAS_DESAGIO_FALLBACK; }
    },
    staleTime: 1000 * 60 * 5,
  });
  const { data: linhasComDesagio = LINHAS_COM_DESAGIO_FALLBACK } = useQuery({
    queryKey: ['configuracoes', 'linhas_com_desagio'],
    queryFn: async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'linhas_com_desagio').maybeSingle();
      try { return JSON.parse(data?.valor || '[]') as string[]; } catch { return LINHAS_COM_DESAGIO_FALLBACK; }
    },
    staleTime: 1000 * 60 * 5,
  });
  const { data: categoriasQueSobrepoeApp = CATEGORIAS_DESAGIO_FALLBACK } = useQuery({
    queryKey: ['configuracoes', 'categorias_que_sobrepoe_app'],
    queryFn: async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'categorias_que_sobrepoe_app').maybeSingle();
      try { return JSON.parse(data?.valor || '[]') as string[]; } catch { return CATEGORIAS_DESAGIO_FALLBACK; }
    },
    staleTime: 1000 * 60 * 5,
  });
  const { data: cotaDesagioDefault = 8 } = useQuery({
    queryKey: ['configuracoes', 'cota_desagio_default'],
    queryFn: async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'cota_desagio_default').maybeSingle();
      return parseFloat(data?.valor || '8') || 8;
    },
    staleTime: 1000 * 60 * 10,
  });
  const { data: cotaMinimaDesagioDefault = 2000 } = useQuery({
    queryKey: ['configuracoes', 'cota_minima_desagio_default'],
    queryFn: async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'cota_minima_desagio_default').maybeSingle();
      return parseFloat(data?.valor || '2000') || 2000;
    },
    staleTime: 1000 * 60 * 10,
  });
  const { data: cotasCategoriaData } = useQuery({
    queryKey: ['planos_cotas_categoria'],
    queryFn: async () => {
      const { data, error } = await supabase.from('planos_cotas_categoria').select('plano_id, categoria_veiculo, cota_percentual, cota_minima_valor');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
  return { categoriasDesagio, linhasComDesagio, categoriasQueSobrepoeApp, cotaDesagioDefault, cotaMinimaDesagioDefault, cotasCategoriaData };
}

interface CalculadoraPrecoProps {
  onIrParaCotacao?: (dados: DadosParaCotacao) => void;
}

export function CalculadoraPreco({ onIrParaCotacao }: CalculadoraPrecoProps) {
  const [open, setOpen] = useState(false);
  const [valorFipe, setValorFipe] = useState<string>('');
  const [tipoUso, setTipoUso] = useState<TipoUso>('particular');
  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculo>('carro');
  const [regiao, setRegiao] = useState<string>('rj');
  const [combustivelManual, setCombustivelManual] = useState<'gasolina' | 'diesel'>('gasolina');
  const [anoVeiculo, setAnoVeiculo] = useState<string>('');
  const [categoria, setCategoria] = useState<string>('nenhuma');
  const [resultado, setResultado] = useState<ResultadoCalc | null>(null);
  const [semResultado, setSemResultado] = useState(false);

  // Placa lookup
  const [placa, setPlaca] = useState('');
  const [placaLoading, setPlacaLoading] = useState(false);
  const [veiculoPlaca, setVeiculoPlaca] = useState<VeiculoPlaca | null>(null);
  const [combustivelDetectado, setCombustivelDetectado] = useState<string | null>(null);

  const { data: tabelas } = useTabelasPreco();
  const { data: adicionalApp = 35.90 } = useAdicionalApp();
  const { data: planosData } = usePlanosComPrecoMap();
  const configApp = useConfigAdicionalAppCalc(tabelas);
  const { cotaDefault, cotaMinimaDefault } = useCotaDefaults();
  const desagioConfig = useDesagioConfig();

  // Vencimento
  const [opcao1, opcao2] = calcularOpcoesVencimento(new Date().getDate());

  // Build product_lines lookup maps
  const plMaps = useMemo(() => {
    const pls = planosData?.productLines || [];
    const vehicleType: Record<string, string | null> = {};
    const requiresRecent: Record<string, boolean> = {};
    const blockedCats: Record<string, string[]> = {};
    const supportsApp: Record<string, boolean> = {};
    const sortPriority: Record<string, number> = {};
    for (const pl of pls) {
      if (!pl.slug) continue;
      vehicleType[pl.slug] = pl.vehicle_type;
      requiresRecent[pl.slug] = pl.requires_recent_year === true;
      blockedCats[pl.slug] = Array.isArray(pl.blocked_categories) ? (pl.blocked_categories as string[]) : [];
      supportsApp[pl.slug] = pl.supports_app === true;
      sortPriority[pl.slug] = typeof pl.sort_priority === 'number' ? pl.sort_priority : 99;
    }
    return { vehicleType, requiresRecent, blockedCats, supportsApp, sortPriority };
  }, [planosData?.productLines]);

  /** Check if a linha_slug matches the selected vehicle type */
  const linhaMatchesTipo = (linhaSlug: string): boolean => {
    const vt = plMaps.vehicleType[linhaSlug];
    if (tipoVeiculo === 'moto') return vt === 'motorcycle';
    return vt !== 'motorcycle';
  };

  const consultarPlaca = async () => {
    const cleaned = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleaned.length < 7) return;

    setPlacaLoading(true);
    setVeiculoPlaca(null);
    try {
      const { data, error } = await supabase.functions.invoke('plate-lookup', {
        body: { placa: cleaned },
      });

      if (error || !data?.success || !data?.vehicleData) {
        throw new Error(data?.error || 'Veículo não encontrado');
      }

      const v = data.vehicleData;
      setVeiculoPlaca(v);

      if (data.fipeData?.valor) {
        const fipeVal = typeof data.fipeData.valor === 'string'
          ? parseFloat(data.fipeData.valor.replace(/[^\d.,]/g, '').replace(',', '.'))
          : data.fipeData.valor;
        if (fipeVal > 0) {
          setValorFipe(formatarMoeda(fipeVal));
        }
      }

      const tipo = detectarTipoFromPlaca(v);
      setTipoVeiculo(tipo);

      if (v.ano) {
        const anoNum = parseInt(String(v.ano).replace(/\D.*$/, ''), 10);
        if (anoNum > 1900 && anoNum < 2100) {
          setAnoVeiculo(String(anoNum));
        }
      }

      setCombustivelDetectado(v.combustivel || null);
    } catch (err: any) {
      console.error('[CalculadoraPreco] Erro placa:', err);
      setVeiculoPlaca(null);
    } finally {
      setPlacaLoading(false);
    }
  };

  const handlePlacaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') consultarPlaca();
  };

  const calcular = () => {
    const valor = parseFloat(valorFipe.replace(/\D/g, '')) / 100;

    if (!valor || !tabelas || tabelas.length === 0 || !planosData) {
      setResultado(null);
      setSemResultado(!!valor);
      return;
    }

    const { planos, mappings } = planosData;
    const anoAtual = new Date().getFullYear();
    const anoNum = anoVeiculo ? parseInt(anoVeiculo, 10) : null;

    const combustivelPricing = combustivelDetectado
      ? normalizarCombustivelParaPricing(combustivelDetectado)
      : combustivelManual;

    const resultadosPlano: ResultadoPlano[] = [];

    const { categoriasDesagio, linhasComDesagio, categoriasQueSobrepoeApp, cotaDesagioDefault, cotaMinimaDesagioDefault, cotasCategoriaData } = desagioConfig;
    const categoriaAtiva = tipoVeiculo === 'carro' && categoria !== 'nenhuma' ? categoria : null;
    const isDesagio = !!categoriaAtiva && categoriasDesagio.includes(categoriaAtiva);
    const isAppComDesagio = tipoUso === 'aplicativo' && isDesagio && categoriasQueSobrepoeApp.includes(categoriaAtiva || '');

    for (const plano of planos) {
      const catLower = (plano.categoria || '').toLowerCase();
      const tipoUsoPlano = (plano.tipo_uso || '').toLowerCase();
      if (catLower === 'aplicativo' || tipoUsoPlano === 'aplicativo') continue;

      const mapping = mappings.find(m => m.plano_id === plano.id);
      if (!mapping?.linha_slug) continue;

      const linhaSlug = mapping.linha_slug;
      const plSlug = linhaSlug.toLowerCase();

      if (!linhaMatchesTipo(linhaSlug)) continue;

      // Filtro tipo_uso: APP + deságio permite planos 'passeio' da linha Select
      if (tipoUso === 'aplicativo' && tipoUsoPlano !== 'aplicativo' && tipoUsoPlano !== 'ambos') {
        const isLinhaSelect = plSlug.startsWith('select');
        if (!(isAppComDesagio && tipoUsoPlano === 'passeio' && isLinhaSelect)) {
          continue;
        }
      }
      if (tipoUso !== 'aplicativo' && tipoUsoPlano === 'aplicativo') continue;

      if (tipoUso === 'aplicativo' && !plMaps.supportsApp[linhaSlug]) continue;
      if (plano.fipe_minima && valor < Number(plano.fipe_minima)) continue;
      if (plano.fipe_maxima && valor > Number(plano.fipe_maxima)) continue;

      if (anoNum) {
        const anoMinPlano = Number(plano.ano_minimo || plano.ano_minimo_veiculo || plano.ano_fabricacao_minimo || 0);
        if (anoMinPlano > 0 && anoNum < anoMinPlano) continue;
      }

      if (plMaps.requiresRecent[linhaSlug] && anoNum) {
        if (anoNum < anoAtual - 1) continue;
      }

      // Blocked categories (from product_line)
      const blocked = plMaps.blockedCats[linhaSlug] || [];
      if (blocked.length > 0 && categoriaAtiva && blocked.includes(categoriaAtiva)) continue;

      // Select Exclusive: ocultar quando APP + deságio combinam
      if (isAppComDesagio && (plSlug === 'select-exclusive' || (plano as any).codigo?.toLowerCase().includes('exclusive'))) {
        continue;
      }

      const isMotoLine = mapping.tipo_uso !== 'particular' && mapping.tipo_uso !== 'aplicativo';
      const tipoUsoPricing = isMotoLine
        ? mapping.tipo_uso
        : resolverTipoUsoQuery(linhaSlug, regiao, tipoUso, configApp);

      if (!isMotoLine) {
        const expectedTipoUso = resolverTipoUsoQuery(linhaSlug, regiao, tipoUso, configApp);
        if (tipoUsoPricing !== expectedTipoUso) continue;
      }

      const faixa = tabelas.find(t => {
        if (t.linha_slug !== linhaSlug) return false;
        if (t.regiao !== regiao) return false;
        if (t.tipo_uso !== tipoUsoPricing) return false;
        if (valor < Number(t.fipe_min) || valor > Number(t.fipe_max)) return false;
        if (combustivelPricing && t.combustivel_tipo && t.combustivel_tipo !== combustivelPricing) return false;
        return true;
      });

      if (!faixa || Number(faixa.valor_mensal) <= 0) continue;

      let valorMensal = Number(faixa.valor_mensal);
      const valorDesagioFaixa = faixa.valor_desagio != null ? Number(faixa.valor_desagio) : null;
      let precoDesagioAplicado = false;

      // Aplicar deságio: usar valor_desagio se a categoria é deságio e a linha suporta
      const temColunaAppDedicada = configApp.linhasComColunaApp.includes(linhaSlug);
      if (isDesagio && valorDesagioFaixa != null && linhasComDesagio.includes(linhaSlug) && !temColunaAppDedicada) {
        valorMensal = valorDesagioFaixa;
        precoDesagioAplicado = true;
      }

      // Adicional APP: NÃO aplicar se a categoria anula (deságio sobrepõe APP)
      const categoriaAnulaApp = isDesagio && categoriasQueSobrepoeApp.includes(categoriaAtiva || '');
      if (!isMotoLine && tipoUso === 'aplicativo' && !categoriaAnulaApp) {
        valorMensal = resolverPrecoApp(linhaSlug, regiao, tipoUso, valorMensal, adicionalApp, configApp);
      }

      const adicionalMensal = Number(plano.adicional_mensal || 0);
      valorMensal += adicionalMensal;

      const descontoPerc = Number(plano.desconto_percentual || 0);
      if (descontoPerc > 0) {
        valorMensal *= (1 - descontoPerc / 100);
      }

      // Cota — cascata: planos_cotas_categoria → plano fields → defaults
      const cotaBase = plano.cota_participacao != null ? Number(plano.cota_participacao) : cotaDefault;
      const cotaMinBase = plano.cota_minima != null ? Number(plano.cota_minima) : cotaMinimaDefault;
      let cotaPercentual = cotaBase;
      let cotaMinima = cotaMinBase;

      let cotaCategoriaLookup = categoriaAtiva || 'passeio';
      if (tipoUso === 'aplicativo') cotaCategoriaLookup = 'aplicativo';
      if (isDesagio) cotaCategoriaLookup = 'desagio';

      const cotaOverride = cotasCategoriaData?.find(
        cc => cc.plano_id === plano.id && cc.categoria_veiculo === cotaCategoriaLookup
      );

      if (cotaOverride) {
        cotaPercentual = cotaOverride.cota_percentual != null ? Number(cotaOverride.cota_percentual) : cotaBase;
        cotaMinima = cotaOverride.cota_minima_valor != null ? Number(cotaOverride.cota_minima_valor) : cotaMinBase;
      } else if (tipoUso === 'aplicativo' || isDesagio) {
        cotaPercentual = (plano as any).cota_desagio != null ? Number((plano as any).cota_desagio) : cotaDesagioDefault;
        cotaMinima = (plano as any).cota_minima_desagio != null ? Number((plano as any).cota_minima_desagio) : cotaMinimaDesagioDefault;
      }

      const valorAdesao = Number(plano.valor_adesao || 0);
      const coberturaFipe = Number(plano.cobertura_fipe || 100);

      // Extract coberturas from planos_beneficios
      const beneficios = (plano as any).planos_beneficios || [];
      const coberturas = beneficios
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
        .map((pb: any) => pb.custom_text || pb.benefits?.name || '')
        .filter(Boolean)
        .slice(0, 6);

      resultadosPlano.push({
        key: plano.id,
        planoNome: plano.nome,
        valorMensal: Math.round(valorMensal * 100) / 100,
        valorDesagio: valorDesagioFaixa,
        adicionalMensal,
        descontoPercentual: descontoPerc,
        sortPriority: plMaps.sortPriority[linhaSlug] ?? 99,
        valorAdesao: Math.round(valorAdesao * 100) / 100,
        cotaPercentual,
        cotaMinima,
        coberturaFipe,
        coberturas,
        precoDesagioAplicado,
      });
    }

    if (resultadosPlano.length === 0) {
      setResultado(null);
      setSemResultado(true);
      return;
    }

    resultadosPlano.sort((a, b) => {
      if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
      return a.valorMensal - b.valorMensal;
    });

    const primeiroMapping = mappings.find(m => m.plano_id === resultadosPlano[0].key);
    const primeiraFaixa = primeiroMapping ? tabelas.find(t =>
      t.linha_slug === primeiroMapping.linha_slug &&
      t.regiao === regiao &&
      valor >= Number(t.fipe_min) &&
      valor <= Number(t.fipe_max)
    ) : undefined;

    setResultado({
      planos: resultadosPlano,
      faixaFipe: primeiraFaixa
        ? `${formatarMoeda(Number(primeiraFaixa.fipe_min))} - ${formatarMoeda(Number(primeiraFaixa.fipe_max))}`
        : '',
      valorFipeInformado: valor,
      regiaoLabel: REGIOES.find(r => r.value === regiao)?.label || regiao,
      tipoUsoLabel: tipoUso === 'aplicativo' ? 'Aplicativo / Trabalho' : 'Particular',
      tipoVeiculoLabel: TIPO_VEICULO_LABELS[tipoVeiculo],
    });
    setSemResultado(false);
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const formatted = formatarMoeda(Number(raw) / 100);
    setValorFipe(formatted);
  };

  const limpar = () => {
    setValorFipe('');
    setTipoUso('particular');
    setTipoVeiculo('carro');
    setRegiao('rj');
    setCombustivelManual('gasolina');
    setAnoVeiculo('');
    setCategoria('nenhuma');
    setResultado(null);
    setSemResultado(false);
    setPlaca('');
    setVeiculoPlaca(null);
    setCombustivelDetectado(null);
  };

  const handleIrParaCotacao = (planoId: string) => {
    if (!resultado || !onIrParaCotacao) return;
    const anoNum = anoVeiculo ? parseInt(anoVeiculo, 10) : undefined;
    onIrParaCotacao({
      valorFipe: resultado.valorFipeInformado,
      marca: veiculoPlaca?.marca,
      modelo: veiculoPlaca?.modelo,
      ano: anoNum,
      placa: veiculoPlaca?.placa,
      regiao,
      planoId,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Calculator className="h-4 w-4 mr-2" />
          Calculadora
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calculadora de Preço</DialogTitle>
          <DialogDescription>
            Simule rapidamente a mensalidade, adesão e cota por plano
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Placa (optional) */}
          <div className="space-y-2">
            <Label htmlFor="placa" className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Placa <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="placa"
                placeholder="ABC1D23 ou ABC-1234"
                value={placa}
                onChange={(e) => setPlaca(maskPlaca(e.target.value))}
                onKeyDown={handlePlacaKeyDown}
                className="uppercase font-mono tracking-wider flex-1"
                maxLength={8}
                disabled={placaLoading}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={consultarPlaca}
                disabled={placaLoading || placa.replace(/[^A-Za-z0-9]/g, '').length < 7}
                className="shrink-0"
              >
                {placaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {veiculoPlaca && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="secondary" className="font-mono">
                  {veiculoPlaca.placa}
                </Badge>
                <span className="text-muted-foreground">
                  {veiculoPlaca.marca} {veiculoPlaca.modelo}
                </span>
                {veiculoPlaca.ano && (
                  <Badge variant="outline" className="text-xs">{veiculoPlaca.ano}</Badge>
                )}
                {veiculoPlaca.cor && (
                  <Badge variant="outline" className="text-xs">{veiculoPlaca.cor}</Badge>
                )}
                {veiculoPlaca.combustivel && (
                  <Badge variant="outline" className="text-xs">{veiculoPlaca.combustivel}</Badge>
                )}
              </div>
            )}
          </div>

          {/* Valor FIPE */}
          <div className="space-y-2">
            <Label htmlFor="valorFipe">Valor FIPE</Label>
            <Input
              id="valorFipe"
              placeholder="R$ 0,00"
              value={valorFipe}
              onChange={handleValorChange}
            />
          </div>

          {/* Ano do Veículo */}
          <div className="space-y-2">
            <Label htmlFor="anoVeiculo">
              Ano do Veículo <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="anoVeiculo"
              placeholder="Ex: 2020"
              value={anoVeiculo}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                setAnoVeiculo(v);
              }}
              maxLength={4}
              inputMode="numeric"
            />
          </div>

          {/* Tipo de Veículo */}
          <div className="space-y-2">
            <Label>Tipo de Veículo</Label>
            <ToggleGroup
              type="single"
              value={tipoVeiculo}
              onValueChange={(v) => v && setTipoVeiculo(v as TipoVeiculo)}
              className="justify-start"
            >
              <ToggleGroupItem value="carro" aria-label="Carro" className="flex-1 gap-1.5">
                <Car className="h-4 w-4" />
                Carro
              </ToggleGroupItem>
              <ToggleGroupItem value="moto" aria-label="Moto" className="flex-1 gap-1.5">
                <Bike className="h-4 w-4" />
                Moto
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Região */}
          <div className="space-y-2">
            <Label>Região</Label>
            <Select value={regiao} onValueChange={setRegiao}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a região" />
              </SelectTrigger>
              <SelectContent>
                {REGIOES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Combustível selector — only for cars without plate */}
          {tipoVeiculo === 'carro' && !combustivelDetectado && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Fuel className="h-3.5 w-3.5" />
                Combustível
              </Label>
              <ToggleGroup
                type="single"
                value={combustivelManual}
                onValueChange={(v) => v && setCombustivelManual(v as 'gasolina' | 'diesel')}
                className="justify-start"
              >
                <ToggleGroupItem value="gasolina" aria-label="Gasolina/Flex" className="flex-1">
                  Gasolina / Flex
                </ToggleGroupItem>
                <ToggleGroupItem value="diesel" aria-label="Diesel" className="flex-1">
                  Diesel
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}

          {/* Tipo de Uso */}
          <div className="space-y-2">
            <Label>Tipo de Uso</Label>
            <ToggleGroup
              type="single"
              value={tipoUso}
              onValueChange={(v) => v && setTipoUso(v as TipoUso)}
              className="justify-start"
            >
              <ToggleGroupItem value="particular" aria-label="Particular" className="flex-1 gap-1.5">
                <Car className="h-4 w-4" />
                Particular
              </ToggleGroupItem>
              <ToggleGroupItem value="aplicativo" aria-label="Aplicativo/Trabalho" className="flex-1 gap-1.5">
                <Briefcase className="h-4 w-4" />
                Aplicativo
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Categoria do Veículo (só carros) */}
          {tipoVeiculo === 'carro' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Categoria <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_VEICULO_CALC.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Botões */}
          <div className="flex gap-2">
            <Button onClick={calcular} className="flex-1">
              Calcular
            </Button>
            <Button variant="outline" onClick={limpar}>
              Limpar
            </Button>
          </div>

          {/* Resultado */}
          {resultado && (
            <div className="space-y-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                <p>Veículo {formatarMoeda(resultado.valorFipeInformado)}</p>
                <p className="text-xs">Faixa: {resultado.faixaFipe}</p>
              </div>

              {/* Critérios */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  {resultado.tipoVeiculoLabel}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  {resultado.regiaoLabel}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  {resultado.tipoUsoLabel}
                </span>
              </div>

              {/* Vencimento rápido */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarCheck className="h-3.5 w-3.5" />
                <span>Vencimento: <strong>dia {opcao1}</strong> ou <strong>dia {opcao2}</strong></span>
              </div>

              {/* Preços por plano */}
              <div className="space-y-3">
                {resultado.planos.map((plano) => (
                  <div
                    key={plano.key}
                    className="rounded-lg bg-primary/5 border border-primary/10 overflow-hidden"
                  >
                    {/* Header: nome + preço */}
                    <div className="flex items-center justify-between p-3">
                      <div>
                        <span className="text-sm font-semibold">{plano.planoNome}</span>
                        {(plano.adicionalMensal > 0 || plano.descontoPercentual > 0) && (
                          <div className="flex gap-1 mt-0.5">
                            {plano.adicionalMensal > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                +{formatarMoeda(plano.adicionalMensal)}
                              </Badge>
                            )}
                            {plano.descontoPercentual > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                -{plano.descontoPercentual}%
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-primary">
                          {formatarMoeda(plano.valorMensal)}
                        </span>
                        <span className="text-xs text-muted-foreground">/mês</span>
                      </div>
                    </div>

                    {/* Details grid */}
                    <div className="px-3 pb-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-background rounded p-1.5">
                        <span className="text-muted-foreground block">Adesão</span>
                        <span className="font-semibold">{formatarMoeda(plano.valorAdesao)}</span>
                      </div>
                      <div className="bg-background rounded p-1.5">
                        <span className="text-muted-foreground block">Cota</span>
                        <span className="font-semibold">
                          {plano.cotaPercentual}%
                          {plano.cotaMinima > 0 && (
                            <span className="text-muted-foreground font-normal"> mín {formatarMoeda(plano.cotaMinima)}</span>
                          )}
                        </span>
                      </div>
                      <div className="bg-background rounded p-1.5">
                        <span className="text-muted-foreground block">Cobertura</span>
                        <span className="font-semibold">{plano.coberturaFipe}% FIPE</span>
                      </div>
                    </div>

                    {/* Coberturas resumidas */}
                    {plano.coberturas.length > 0 && (
                      <div className="px-3 pb-2">
                        <div className="flex flex-wrap gap-1">
                          {plano.coberturas.map((cob, i) => (
                            <span key={i} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Shield className="h-2.5 w-2.5 text-emerald-500" />
                              {cob}
                              {i < plano.coberturas.length - 1 && <span className="mx-0.5">·</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deságio */}
                    {plano.valorDesagio != null && (
                      <div className="px-3 pb-2">
                        <p className="text-xs text-muted-foreground">
                          Deságio: {formatarMoeda(plano.valorDesagio)}
                        </p>
                      </div>
                    )}

                    {/* Botão Ir para Cotação */}
                    {onIrParaCotacao && (
                      <div className="px-3 pb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs gap-1.5 h-8"
                          onClick={() => handleIrParaCotacao(plano.key)}
                        >
                          Criar Cotação
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                * Valores da tabela vigente. Cotação final sujeita a análise.
              </p>
            </div>
          )}

          {semResultado && (
            <div className="text-center py-4">
              <p className="text-sm font-medium text-muted-foreground">
                Consulte um consultor
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Nenhuma faixa encontrada para este valor, tipo de veículo e região.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
