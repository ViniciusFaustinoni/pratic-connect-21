import { useState, useEffect, useMemo } from 'react';
import { useComissaoExternaConfig } from '@/hooks/useComissaoExternaConfig';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import {
  AlertTriangle, Save, DollarSign, Percent, Repeat, Truck, Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatarMoeda } from '@/utils/format';

function TooltipInfo({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-muted-foreground cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function ComissionamentoExternoConfig() {
  const { configs, isLoading, getValue, save, isSaving } = useComissaoExternaConfig();
  const { isDiretor, isDesenvolvedor, isAdminFinanceiro } = usePermissions();

  // Section 1 state
  const [pctAdesao, setPctAdesao] = useState('');
  const [msgAdesaoZero, setMsgAdesaoZero] = useState('');
  const [sec1Error, setSec1Error] = useState('');

  // Section 2 state
  const [valorVolante, setValorVolante] = useState('');
  const [sec2Error, setSec2Error] = useState('');

  // Section 3 state
  const [tipoRecorrente, setTipoRecorrente] = useState('percentual');
  const [valorRecorrente, setValorRecorrente] = useState('');
  const [parcelasRecorrente, setParcelasRecorrente] = useState('');
  const [sec3Error, setSec3Error] = useState('');

  // Load saved values
  useEffect(() => {
    if (configs) {
      setPctAdesao(getValue('comissao_ext_pct_adesao'));
      setMsgAdesaoZero(getValue('comissao_ext_msg_adesao_zero'));
      setValorVolante(getValue('comissao_ext_valor_volante'));
      setTipoRecorrente(getValue('comissao_ext_tipo_recorrente'));
      setValorRecorrente(getValue('comissao_ext_valor_recorrente'));
      setParcelasRecorrente(getValue('comissao_ext_parcelas_recorrente'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs]);

  // Access control
  if (!isDiretor && !isDesenvolvedor && !isAdminFinanceiro) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando configurações...</div>;
  }

  // ---- SECTION 1: Comissão de Adesão ----
  const handleSaveSection1 = () => {
    setSec1Error('');
    const pct = parseFloat(pctAdesao);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setSec1Error('Percentual deve estar entre 0 e 100.');
      return;
    }
    if (pct === 100 && !msgAdesaoZero.trim()) {
      setSec1Error('Mensagem é obrigatória quando o percentual é 100%.');
      return;
    }
    save([
      { chave: 'comissao_ext_pct_adesao', valor: String(pct) },
      { chave: 'comissao_ext_msg_adesao_zero', valor: msgAdesaoZero.trim() },
    ]);
  };

  // ---- SECTION 2: Custo Volante ----
  const handleSaveSection2 = () => {
    setSec2Error('');
    const val = parseFloat(valorVolante);
    if (isNaN(val) || val <= 0) {
      setSec2Error('Valor deve ser maior que zero.');
      return;
    }
    save([{ chave: 'comissao_ext_valor_volante', valor: String(val) }]);
  };

  const volanteDynamic = useMemo(() => {
    const v = parseFloat(valorVolante) || 0;
    return formatarMoeda(v);
  }, [valorVolante]);

  // ---- SECTION 3: Comissão Recorrente ----
  const handleSaveSection3 = () => {
    setSec3Error('');
    const val = parseFloat(valorRecorrente);
    const parcelas = parseInt(parcelasRecorrente);
    if (isNaN(val) || val <= 0) {
      setSec3Error('Valor/percentual de comissão deve ser maior que zero.');
      return;
    }
    if (isNaN(parcelas) || parcelas <= 0) {
      setSec3Error('Número de parcelas deve ser um inteiro maior que zero.');
      return;
    }
    save([
      { chave: 'comissao_ext_tipo_recorrente', valor: tipoRecorrente },
      { chave: 'comissao_ext_valor_recorrente', valor: String(val) },
      { chave: 'comissao_ext_parcelas_recorrente', valor: String(parcelas) },
    ]);
  };

  const simulacao = useMemo(() => {
    const val = parseFloat(valorRecorrente) || 0;
    const parcelas = parseInt(parcelasRecorrente) || 0;
    const mensalidadeRef = 200;

    if (val <= 0 || parcelas <= 0) return null;

    let valorMensal: number;
    let descricao: string;

    if (tipoRecorrente === 'fixo') {
      valorMensal = val;
      descricao = formatarMoeda(val);
    } else {
      valorMensal = (val / 100) * mensalidadeRef;
      descricao = `${val}% = ${formatarMoeda(valorMensal)}`;
    }

    return {
      valorMensal,
      descricao,
      parcelas,
      total: valorMensal * parcelas,
      mensalidadeRef,
    };
  }, [tipoRecorrente, valorRecorrente, parcelasRecorrente]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Comissionamento de Venda Externa
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure regras de comissão para vendedores externos (consultores)
        </p>
      </div>

      <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-sm">
          Alterações nestas configurações se aplicam apenas a novas vendas a partir do momento do salvamento.
          Comissões já geradas não são alteradas retroativamente.
        </AlertDescription>
      </Alert>

      {/* ===== SECTION 1 — Comissão de Adesão ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Percent className="h-5 w-5" />
            Comissão de Adesão
          </CardTitle>
          <CardDescription>
            Define quanto do valor da taxa de adesão cobrada pelo vendedor externo é repassado a ele como comissão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label className="flex items-center">
              Percentual da adesão repassado ao vendedor externo
              <TooltipInfo text="100% significa que se o vendedor cobrar R$400 de adesão, ele recebe R$400. Se cobrar R$0, nenhum lançamento é gerado." />
            </Label>
            <div className="relative mt-1">
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={pctAdesao}
                onChange={(e) => setPctAdesao(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          <div>
            <Label className="flex items-center">
              Mensagem exibida ao associado quando a adesão for R$0,00
              <TooltipInfo text="Exibida no link de pagamento quando o vendedor zera a adesão. Nenhuma cobrança é gerada nesse caso." />
            </Label>
            <div className="relative mt-1">
              <Textarea
                maxLength={300}
                rows={3}
                placeholder="Ex.: Parabéns! Seu consultor concedeu desconto total na sua taxa de entrada. Seja bem-vindo à Praticcar!"
                value={msgAdesaoZero}
                onChange={(e) => setMsgAdesaoZero(e.target.value)}
              />
              <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                {msgAdesaoZero.length}/300
              </span>
            </div>
          </div>

          {sec1Error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> {sec1Error}
            </p>
          )}

          <Button onClick={handleSaveSection1} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" /> Salvar Comissão de Adesão
          </Button>
        </CardContent>
      </Card>

      {/* ===== SECTION 2 — Custo Instalação Volante ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5" />
            Custo de Instalação Volante
          </CardTitle>
          <CardDescription>
            Quando a instalação é realizada na residência ou local do associado (rota/volante), há um custo operacional para a empresa. Esse custo é absorvido pelo vendedor externo responsável pela venda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label className="flex items-center">
              Valor do débito por instalação volante
              <TooltipInfo text="Este valor é debitado automaticamente na conta corrente do vendedor externo sempre que uma instalação for do tipo volante." />
            </Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={valorVolante}
                onChange={(e) => setValorVolante(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <strong>Com base nesta configuração:</strong> se o vendedor cobrou adesão, {volanteDynamic} será
            debitado do crédito de adesão. Se o vendedor zerou a adesão, {volanteDynamic} será abatido
            sequencialmente das parcelas de comissão recorrente até ser quitado.
          </div>

          {sec2Error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> {sec2Error}
            </p>
          )}

          <Button onClick={handleSaveSection2} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" /> Salvar Custo Volante
          </Button>
        </CardContent>
      </Card>

      {/* ===== SECTION 3 — Comissão Recorrente ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Repeat className="h-5 w-5" />
            Comissão Recorrente
          </CardTitle>
          <CardDescription>
            Além da adesão, o vendedor externo recebe comissões mensais enquanto o associado que captou permanecer ativo e pagando, durante um número configurável de meses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label>Tipo de comissão recorrente</Label>
            <Select value={tipoRecorrente} onValueChange={setTipoRecorrente}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
                <SelectItem value="percentual">Percentual da mensalidade (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="max-w-sm">
            <Label>
              {tipoRecorrente === 'fixo' ? 'Valor por parcela' : 'Percentual da mensalidade'}
            </Label>
            <div className="relative mt-1">
              {tipoRecorrente === 'fixo' ? (
                <>
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={valorRecorrente}
                    onChange={(e) => setValorRecorrente(e.target.value)}
                    className="pl-10"
                  />
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    min={0.01}
                    max={100}
                    step={0.1}
                    value={valorRecorrente}
                    onChange={(e) => setValorRecorrente(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </>
              )}
            </div>
          </div>

          <div className="max-w-sm">
            <Label className="flex items-center">
              Número de parcelas de comissão
              <TooltipInfo text="Quantidade de mensalidades pagas pelo associado que geram comissão ao vendedor. Ex.: 6 = o vendedor recebe comissão pelos 6 primeiros pagamentos mensais do associado." />
            </Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={parcelasRecorrente}
              onChange={(e) => setParcelasRecorrente(e.target.value)}
              className="mt-1"
            />
          </div>

          {simulacao && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <strong>Simulação:</strong> um vendedor que captar um associado com mensalidade de{' '}
              {formatarMoeda(simulacao.mensalidadeRef)} receberá{' '}
              <span className="font-semibold text-primary">{simulacao.descricao}</span> por mês durante{' '}
              <span className="font-semibold">{simulacao.parcelas}</span> meses — total estimado de{' '}
              <span className="font-semibold text-primary">{formatarMoeda(simulacao.total)}</span>.
            </div>
          )}

          {sec3Error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> {sec3Error}
            </p>
          )}

          <Button onClick={handleSaveSection3} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" /> Salvar Comissão Recorrente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
