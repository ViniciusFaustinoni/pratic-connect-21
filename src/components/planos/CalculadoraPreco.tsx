import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Calculator, Check, Car, Briefcase, Search, Loader2, Bike, Fuel } from 'lucide-react';
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

interface ResultadoPlano {
  key: string;
  planoNome: string;
  valorMensal: number;
  valorDesagio: number | null;
  adicionalMensal: number;
  descontoPercentual: number;
  sortPriority: number;
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

/** Fetch planos + plano_preco_map + product_lines for calculator */
function usePlanosComPrecoMap() {
  return useQuery({
    queryKey: ['calculadora-planos-preco-map-v2'],
    queryFn: async () => {
      const [planosRes, mapRes, plRes] = await Promise.all([
        supabase
          .from('planos')
          .select('id, nome, slug, adicional_mensal, desconto_percentual, visivel_gestao, ativo, categoria, fipe_minima, fipe_maxima, tipo_uso, ano_minimo, ano_minimo_veiculo, ano_fabricacao_minimo')
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

/** Detect vehicle type from plate-lookup response */
function detectarTipoFromPlaca(dados: VeiculoPlaca): TipoVeiculo {
  const tipoDetectado = detectarTipoVeiculo(undefined, dados.modelo, dados.marca);
  return tipoDetectado === 'moto' ? 'moto' : 'carro';
}

export function CalculadoraPreco() {
  const [valorFipe, setValorFipe] = useState<string>('');
  const [tipoUso, setTipoUso] = useState<TipoUso>('particular');
  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculo>('carro');
  const [regiao, setRegiao] = useState<string>('rj');
  const [combustivelManual, setCombustivelManual] = useState<'gasolina' | 'diesel'>('gasolina');
  const [anoVeiculo, setAnoVeiculo] = useState<string>('');
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
    // carro: anything that's not motorcycle
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

      // Auto-fill FIPE value
      if (data.fipeData?.valor) {
        const fipeVal = typeof data.fipeData.valor === 'string'
          ? parseFloat(data.fipeData.valor.replace(/[^\d.,]/g, '').replace(',', '.'))
          : data.fipeData.valor;
        if (fipeVal > 0) {
          setValorFipe(formatarMoeda(fipeVal));
        }
      }

      // Auto-detect vehicle type
      const tipo = detectarTipoFromPlaca(v);
      setTipoVeiculo(tipo);

      // Auto-fill ano
      if (v.ano) {
        const anoNum = parseInt(String(v.ano).replace(/\D.*$/, ''), 10);
        if (anoNum > 1900 && anoNum < 2100) {
          setAnoVeiculo(String(anoNum));
        }
      }

      // Store combustivel for filtering
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

    // Determine combustivel for pricing
    const combustivelPricing = combustivelDetectado
      ? normalizarCombustivelParaPricing(combustivelDetectado)
      : combustivelManual;

    const resultadosPlano: ResultadoPlano[] = [];

    for (const plano of planos) {
      // --- FILTER: exclude internal "aplicativo" variants ---
      const catLower = (plano.categoria || '').toLowerCase();
      const tipoUsoPlano = (plano.tipo_uso || '').toLowerCase();
      if (catLower === 'aplicativo' || tipoUsoPlano === 'aplicativo') continue;

      // Find mapping for this plan
      const mapping = mappings.find(m => m.plano_id === plano.id);
      if (!mapping?.linha_slug) continue;

      const linhaSlug = mapping.linha_slug;

      // --- FILTER: vehicle type ---
      if (!linhaMatchesTipo(linhaSlug)) continue;

      // --- FILTER: supports_app (when user selected aplicativo) ---
      if (tipoUso === 'aplicativo' && !plMaps.supportsApp[linhaSlug]) continue;

      // --- FILTER: FIPE limits on the plan itself ---
      if (plano.fipe_minima && valor < Number(plano.fipe_minima)) continue;
      if (plano.fipe_maxima && valor > Number(plano.fipe_maxima)) continue;

      // --- FILTER: ano mínimo do plano ---
      if (anoNum) {
        const anoMinPlano = Number(plano.ano_minimo || plano.ano_minimo_veiculo || plano.ano_fabricacao_minimo || 0);
        if (anoMinPlano > 0 && anoNum < anoMinPlano) continue;
      }

      // --- FILTER: requires_recent_year da product_line ---
      if (plMaps.requiresRecent[linhaSlug] && anoNum) {
        if (anoNum < anoAtual - 1) continue;
      }

      // --- FILTER: blocked_categories ---
      const blocked = plMaps.blockedCats[linhaSlug] || [];
      if (blocked.length > 0 && catLower && blocked.some(b => b.toLowerCase() === catLower)) continue;

      // Determine tipo_uso for table lookup
      const isMotoLine = mapping.tipo_uso !== 'particular' && mapping.tipo_uso !== 'aplicativo';
      const tipoUsoPricing = isMotoLine
        ? mapping.tipo_uso
        : resolverTipoUsoQuery(linhaSlug, regiao, tipoUso, configApp);

      // Skip car lines that don't match user's selected tipo_uso
      if (!isMotoLine) {
        const expectedTipoUso = resolverTipoUsoQuery(linhaSlug, regiao, tipoUso, configApp);
        if (tipoUsoPricing !== expectedTipoUso) continue;
      }

      // Find matching price row
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

      // Apply app surcharge if needed
      if (!isMotoLine && tipoUso === 'aplicativo') {
        valorMensal = resolverPrecoApp(linhaSlug, regiao, tipoUso, valorMensal, adicionalApp, configApp);
      }

      // Apply adicional_mensal (Premium +30, Exclusive +60, etc.)
      const adicionalMensal = Number(plano.adicional_mensal || 0);
      valorMensal += adicionalMensal;

      // Apply desconto_percentual (ex: 5% OFF)
      const descontoPerc = Number(plano.desconto_percentual || 0);
      if (descontoPerc > 0) {
        valorMensal *= (1 - descontoPerc / 100);
      }

      resultadosPlano.push({
        key: plano.id,
        planoNome: plano.nome,
        valorMensal: Math.round(valorMensal * 100) / 100,
        valorDesagio: faixa.valor_desagio != null ? Number(faixa.valor_desagio) : null,
        adicionalMensal,
        descontoPercentual: descontoPerc,
        sortPriority: plMaps.sortPriority[linhaSlug] ?? 99,
      });
    }

    if (resultadosPlano.length === 0) {
      setResultado(null);
      setSemResultado(true);
      return;
    }

    // Sort by product_line sort_priority, then by price
    resultadosPlano.sort((a, b) => {
      if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
      return a.valorMensal - b.valorMensal;
    });

    // Faixa description from first result
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
    setResultado(null);
    setSemResultado(false);
    setPlaca('');
    setVeiculoPlaca(null);
    setCombustivelDetectado(null);
  };

  return (
    <Dialog>
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
            Simule rapidamente a mensalidade por plano
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

            {/* Vehicle info chip */}
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

              {/* Preços por plano */}
              <div className="space-y-2">
                {resultado.planos.map((plano) => (
                  <div
                    key={plano.key}
                    className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10"
                  >
                    <div>
                      <span className="text-sm font-medium">{plano.planoNome}</span>
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
                      {plano.valorDesagio != null && (
                        <p className="text-xs text-muted-foreground">
                          Deságio: {formatarMoeda(plano.valorDesagio)}
                        </p>
                      )}
                    </div>
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
