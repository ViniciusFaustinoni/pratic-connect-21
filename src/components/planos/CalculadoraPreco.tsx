import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Calculator, Check, Car, Briefcase, Search, Loader2, Bike, Fuel, ArrowRight, Shield, CalendarCheck, AlertTriangle, Ban } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatarMoeda } from '@/utils/format';
import { normalizarCombustivelParaPricing } from '@/utils/regiaoMapping';
import { detectarTipoVeiculo } from '@/data/vistoriaConfigCompleta';
import { useConfigLimitesVeiculo } from '@/hooks/useConfigLimitesVeiculo';
import { supabase } from '@/integrations/supabase/client';
import { useRegioesAtivas } from '@/hooks/useRegioes';
import { maskPlaca } from '@/lib/validations';
import { calcularOpcoesVencimento } from '@/utils/vencimento';
import { usePlanosCotacao, type PlanoCotacao } from '@/hooks/usePlanosCotacao';

const CATEGORIAS_VEICULO_CALC = [
  { value: 'nenhuma', label: 'Nenhuma' },
  { value: 'leilao', label: 'Leilão' },
  { value: 'ex_taxi', label: 'Ex-táxi' },
  { value: 'taxi', label: 'Táxi' },
  { value: 'chassi_remarcado', label: 'Chassi Remarcado' },
  { value: 'placa_vermelha', label: 'Placa Vermelha' },
  { value: 'ressarcimento_integral', label: 'Ressarcimento Integral' },
] as const;

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

const TIPO_VEICULO_LABELS: Record<TipoVeiculo, string> = {
  carro: 'Carro',
  moto: 'Moto',
};

interface VeiculoPlaca {
  marca: string;
  modelo: string;
  ano: string;
  cor: string;
  combustivel: string;
  placa: string;
}

function detectarTipoFromPlaca(dados: VeiculoPlaca): TipoVeiculo {
  const tipoDetectado = detectarTipoVeiculo(undefined, dados.modelo, dados.marca);
  return tipoDetectado === 'moto' ? 'moto' : 'carro';
}

interface CalculadoraPrecoProps {
  onIrParaCotacao?: (dados: DadosParaCotacao) => void;
}

export function CalculadoraPreco({ onIrParaCotacao }: CalculadoraPrecoProps) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState<'placa' | 'manual' | null>(null);
  const [valorFipe, setValorFipe] = useState<string>('');
  const [tipoUso, setTipoUso] = useState<TipoUso>('particular');
  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculo>('carro');
  const [regiao, setRegiao] = useState<string>('rj');
  const [combustivelManual, setCombustivelManual] = useState<'gasolina' | 'diesel'>('gasolina');
  const [anoVeiculo, setAnoVeiculo] = useState<string>('');
  const [categoria, setCategoria] = useState<string>('nenhuma');
  const [semResultado, setSemResultado] = useState(false);
  const [jaCalculou, setJaCalculou] = useState(false);

  // Placa lookup
  const [placa, setPlaca] = useState('');
  const [placaLoading, setPlacaLoading] = useState(false);
  const [veiculoPlaca, setVeiculoPlaca] = useState<VeiculoPlaca | null>(null);
  const [combustivelDetectado, setCombustivelDetectado] = useState<string | null>(null);

  const { data: limites } = useConfigLimitesVeiculo();
  const { data: regioesDb } = useRegioesAtivas();
  const REGIOES = useMemo(() => (regioesDb || []).map(r => ({ value: r.codigo.toLowerCase(), label: r.nome })), [regioesDb]);

  // FIPE-below-minimum alert
  const [fipeBloqueado, setFipeBloqueado] = useState(false);
  // Vencimento
  const [opcao1, opcao2] = calcularOpcoesVencimento(new Date().getDate());

  // Derived values
  const fipeNumerico = parseFloat(valorFipe.replace(/\D/g, '')) / 100;
  const temFipe = fipeNumerico > 0;
  const temPlacaConsultada = modo === 'placa' && veiculoPlaca !== null;
  const temDadosVeiculo = temPlacaConsultada || (modo === 'manual' && temFipe);

  const combustivelPricing = combustivelDetectado
    ? normalizarCombustivelParaPricing(combustivelDetectado)
    : combustivelManual;

  const anoNum = anoVeiculo ? parseInt(anoVeiculo, 10) : undefined;
  const categoriaAtiva = tipoVeiculo === 'carro' && categoria !== 'nenhuma' ? categoria : undefined;

  // ── Motor Unificado: usePlanosCotacao ──
  const { planos: planosCalculados, isLoading: planosLoading } = usePlanosCotacao({
    valorFipe: temFipe && jaCalculou ? fipeNumerico : 0,
    regiao,
    combustivel: combustivelPricing,
    categoria: categoriaAtiva,
    anoVeiculo: anoNum,
    tipoVeiculo,
    usoApp: tipoUso === 'aplicativo',
    marca: veiculoPlaca?.marca,
    modelo: veiculoPlaca?.modelo,
  });

  // Check FIPE mínimo
  useEffect(() => {
    if (jaCalculou && temFipe) {
      const fipeMinimo = limites?.fipeMinimo ?? 15000;
      setFipeBloqueado(fipeNumerico < fipeMinimo);
      setSemResultado(!fipeBloqueado && planosCalculados.length === 0);
    }
  }, [planosCalculados, fipeNumerico, temFipe, limites, fipeBloqueado]);

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
        const anoNumParsed = parseInt(String(v.ano).replace(/\D.*$/, ''), 10);
        if (anoNumParsed > 1900 && anoNumParsed < 2100) {
          setAnoVeiculo(String(anoNumParsed));
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

  const handleCalcular = () => {
    setJaCalculou(true);
    const fipeMinimo = limites?.fipeMinimo ?? 15000;
    if (fipeNumerico < fipeMinimo) {
      setFipeBloqueado(true);
      setSemResultado(false);
      return;
    }
    setFipeBloqueado(false);
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const formatted = formatarMoeda(Number(raw) / 100);
    setValorFipe(formatted);
  };

  const limpar = () => {
    setModo(null);
    setValorFipe('');
    setTipoUso('particular');
    setTipoVeiculo('carro');
    setRegiao('rj');
    setCombustivelManual('gasolina');
    setAnoVeiculo('');
    setCategoria('nenhuma');
    setSemResultado(false);
    setFipeBloqueado(false);
    setPlaca('');
    setVeiculoPlaca(null);
    setCombustivelDetectado(null);
    setJaCalculou(false);
  };

  const handleIrParaCotacao = (planoId: string) => {
    if (!onIrParaCotacao) return;
    onIrParaCotacao({
      valorFipe: fipeNumerico,
      marca: veiculoPlaca?.marca,
      modelo: veiculoPlaca?.modelo,
      ano: anoNum,
      placa: veiculoPlaca?.placa,
      regiao,
      planoId,
    });
    setOpen(false);
  };

  const showResults = jaCalculou && temFipe && !fipeBloqueado && planosCalculados.length > 0;

  const catLabel = categoriaAtiva
    ? CATEGORIAS_VEICULO_CALC.find(c => c.value === categoriaAtiva)?.label || null
    : null;

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
          {/* ═══ STEP 1: Modo de busca ═══ */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Como deseja buscar?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setModo('placa'); setValorFipe(''); setVeiculoPlaca(null); setCombustivelDetectado(null); setPlaca(''); }}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 transition-all ${
                  modo === 'placa'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                }`}
              >
                <Search className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Pela Placa</span>
                <span className="text-[10px] text-muted-foreground">Preenche tudo automático</span>
              </button>
              <button
                type="button"
                onClick={() => { setModo('manual'); setVeiculoPlaca(null); setCombustivelDetectado(null); setPlaca(''); }}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 transition-all ${
                  modo === 'manual'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                }`}
              >
                <Calculator className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Digitar FIPE</span>
                <span className="text-[10px] text-muted-foreground">Informar dados manualmente</span>
              </button>
            </div>
          </div>

          {/* ═══ STEP 2a: Placa ═══ */}
          {modo === 'placa' && (
            <div className="space-y-2 animate-fade-in">
              <Label htmlFor="placa" className="flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Placa do veículo
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
                  autoFocus
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
                <div className="animate-fade-in rounded-lg border bg-muted/30 p-3 space-y-2">
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
                  {temFipe && (
                    <p className="text-sm font-semibold text-primary">{valorFipe}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP 2b: Valor FIPE manual ═══ */}
          {modo === 'manual' && (
            <div className="space-y-2 animate-fade-in">
              <Label htmlFor="valorFipe">Valor FIPE</Label>
              <Input
                id="valorFipe"
                placeholder="R$ 0,00"
                value={valorFipe}
                onChange={handleValorChange}
                autoFocus
              />
            </div>
          )}

          {/* ═══ STEP 3: Tipo Veículo (manual only) ═══ */}
          {modo === 'manual' && temFipe && (
            <div className="space-y-2 animate-fade-in">
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
          )}

          {/* ═══ STEP 4: Ano (manual only) ═══ */}
          {modo === 'manual' && temFipe && (
            <div className="space-y-2 animate-fade-in">
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
          )}

          {/* ═══ STEP 5: Região ═══ */}
          {temDadosVeiculo && (
            <div className="space-y-2 animate-fade-in">
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
          )}

          {/* ═══ STEP 6: Tipo de Uso ═══ */}
          {temDadosVeiculo && (
            <div className="space-y-2 animate-fade-in">
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
          )}

          {/* ═══ STEP 7: Categoria (somente carros) ═══ */}
          {temDadosVeiculo && tipoVeiculo === 'carro' && (
            <div className="space-y-2 animate-fade-in">
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

          {/* ═══ STEP 8: Combustível (manual + carro + sem detecção) ═══ */}
          {temDadosVeiculo && tipoVeiculo === 'carro' && !combustivelDetectado && modo === 'manual' && (
            <div className="space-y-2 animate-fade-in">
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

          {/* ═══ Botões ═══ */}
          {temDadosVeiculo && (
            <div className="flex gap-2 animate-fade-in">
              <Button onClick={handleCalcular} className="flex-1" disabled={planosLoading}>
                {planosLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Calcular
              </Button>
              <Button variant="outline" onClick={limpar}>
                Limpar
              </Button>
            </div>
          )}

          {/* ═══ Resultado ═══ */}
          {showResults && (
            <div className="space-y-4 pt-4 border-t animate-fade-in">
              <div className="text-sm text-muted-foreground">
                <p>Veículo {formatarMoeda(fipeNumerico)}</p>
              </div>

              {/* Critérios */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
                  <Check className="h-3 w-3 text-primary" />
                  {TIPO_VEICULO_LABELS[tipoVeiculo]}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
                  <Check className="h-3 w-3 text-primary" />
                  {REGIOES.find(r => r.value === regiao)?.label || regiao}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
                  <Check className="h-3 w-3 text-primary" />
                  {tipoUso === 'aplicativo' ? 'Aplicativo / Trabalho' : 'Particular'}
                </span>
                {catLabel && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    {catLabel}
                  </span>
                )}
              </div>

              {/* Vencimento rápido */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarCheck className="h-3.5 w-3.5" />
                <span>Vencimento: <strong>dia {opcao1}</strong> ou <strong>dia {opcao2}</strong></span>
              </div>

              {/* Preços por plano */}
              <div className="space-y-3">
                {planosCalculados.map((plano) => (
                  <div
                    key={plano.id}
                    className="rounded-lg bg-primary/5 border border-primary/10 overflow-hidden"
                  >
                    {/* Header: nome + preço */}
                    <div className="flex items-center justify-between p-3">
                      <div>
                        <span className="text-sm font-semibold">{plano.nome}</span>
                        {plano.precoDesagioAplicado && (
                          <div className="flex gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-destructive/40 text-destructive">
                              Deságio
                            </Badge>
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
                          {plano.cotaPercentual}% FIPE
                          {plano.cotaMinima > 0 && (
                            <span className="text-muted-foreground font-normal"> · mín. {formatarMoeda(plano.cotaMinima)}</span>
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
                          {plano.coberturas.slice(0, 6).map((cob, i) => (
                            <span key={i} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Shield className="h-2.5 w-2.5 text-primary" />
                              {cob}
                              {i < Math.min(plano.coberturas.length, 6) - 1 && <span className="mx-0.5">·</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Coberturas removidas */}
                    {plano.coberturasRemovidas.length > 0 && (
                      <div className="px-3 pb-2">
                        <p className="text-[10px] text-muted-foreground italic">
                          Não inclui: {plano.coberturasRemovidas.join(', ')}
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
                          onClick={() => handleIrParaCotacao(plano.id)}
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

          {fipeBloqueado && (
            <Alert variant="destructive" className="mt-2 animate-fade-in">
              <Ban className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Veículo fora do perfil aceito</p>
                <p className="text-xs mt-1">
                  FIPE abaixo do mínimo de {formatarMoeda(limites?.fipeMinimo ?? 15000)}. Este veículo não é elegível para proteção.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {jaCalculou && temFipe && !fipeBloqueado && planosCalculados.length === 0 && !planosLoading && (
            <div className="text-center py-4 animate-fade-in">
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
