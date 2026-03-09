import { useState, useMemo } from 'react';
import { format, addDays, differenceInDays } from 'date-fns';
import { Loader2, Receipt, ArrowLeftRight, Calculator, Shield, CheckCircle2, AlertTriangle, CreditCard, QrCode, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAsaas } from '@/hooks/useAsaas';
import { useCotasPorFipe } from '@/hooks/useFaixasCotas';
import { useAtualizarSubstituicao } from '@/hooks/useSubstituicaoVeiculo';
import { useBeneficiosSeparados } from '@/hooks/useBeneficiosAdicionaisCotacao';
import { useTaxaSubstituicao } from '@/hooks/useConteudosSistema';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PixQRCode } from '@/components/app/PixQRCode';
import type { DadosNovoVeiculo } from '@/types/substituicao';

// =============================================
// Types
// =============================================
interface VeiculoAntigoResumo {
  placa: string;
  modelo: string;
  marca: string;
  valor_fipe: number;
  cobertura_vidros?: boolean;
  cobertura_terceiros?: string | null;
  cobertura_assistencia?: string | null;
  mensalidade?: number;
}

interface StepFinanceiroProps {
  substituicaoId: string | null;
  associadoId: string;
  diaVencimento: number;
  veiculoAntigo: VeiculoAntigoResumo;
  dadosNovoVeiculo: Partial<DadosNovoVeiculo>;
  beneficiosSelecionados: Record<string, boolean | string>;
  onConfirmar: () => void;
  onBack: () => void;
  onIniciarSubstituicao: () => Promise<string>;
}

// =============================================
// Component
// =============================================
export function StepFinanceiro({
  substituicaoId,
  associadoId,
  diaVencimento,
  veiculoAntigo,
  dadosNovoVeiculo,
  beneficiosSelecionados,
  onConfirmar,
  onBack,
  onIniciarSubstituicao,
}: StepFinanceiroProps) {
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'BOLETO' | 'UNDEFINED'>('PIX');
  const [cobrancaGerada, setCobrancaGerada] = useState<Record<string, unknown> | null>(null);
  const [gerandoCobranca, setGerandoCobranca] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensalidadeManual, setMensalidadeManual] = useState<string>('');

  const { criarCobranca } = useAsaas();
  const atualizarSubstituicao = useAtualizarSubstituicao();
  const { precosMap, terceirosMap } = useBeneficiosSeparados();
  const { data: taxaSubstituicao = 50 } = useTaxaSubstituicao();

  // Faixas de cota
  const cotasAntigo = useCotasPorFipe(veiculoAntigo.valor_fipe);
  const cotasNovo = useCotasPorFipe(dadosNovoVeiculo.valor_fipe);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // =============================================
  // Cálculos financeiros
  // =============================================

  // Mensalidade base (0.45% FIPE — simplificado)
  const mensalidadeBaseAntiga = veiculoAntigo.mensalidade || (veiculoAntigo.valor_fipe * 0.0045);
  const mensalidadeBaseNova = dadosNovoVeiculo.valor_fipe
    ? (mensalidadeManual ? parseFloat(mensalidadeManual) : dadosNovoVeiculo.valor_fipe * 0.0045)
    : 0;

  // Adicionais antigos
  const adicionaisAntigo = useMemo(() => {
    let total = 0;
    if (veiculoAntigo.cobertura_vidros) {
      const vidros = precosMap['cobertura_vidros'];
      total += vidros ? vidros.preco : 9.90;
    }
    if (veiculoAntigo.cobertura_terceiros) {
      const ft = terceirosMap[veiculoAntigo.cobertura_terceiros];
      if (ft) total += ft.preco;
    }
    return total;
  }, [veiculoAntigo, precosMap, terceirosMap]);

  // Adicionais novos
  const adicionaisNovo = useMemo(() => {
    let total = 0;
    Object.entries(beneficiosSelecionados).forEach(([key, val]) => {
      if (key === 'cobertura_terceiros' && typeof val === 'string') {
        const ft = terceirosMap[val];
        if (ft) total += ft.preco;
      } else if (val === true && precosMap[key]) {
        total += precosMap[key].preco;
      }
    });
    return total;
  }, [beneficiosSelecionados, precosMap, terceirosMap]);

  const totalMensalAntigo = mensalidadeBaseAntiga + adicionaisAntigo;
  const totalMensalNovo = mensalidadeBaseNova + adicionaisNovo;
  const diferencaMensal = totalMensalNovo - totalMensalAntigo;

  // Cota de participação
  const cotaAntigaValor = useMemo(() => {
    if (!cotasAntigo) return veiculoAntigo.valor_fipe * (cotaParticipacaoDefault / 100);
    return Math.max(cotasAntigo.cotas * 200, cotaMinimaDefault);
  }, [cotasAntigo, veiculoAntigo.valor_fipe]);

  const cotaNovaValor = useMemo(() => {
    if (!cotasNovo || !dadosNovoVeiculo.valor_fipe) return 0;
    return Math.max(cotasNovo.cotas * 200, cotaMinimaDefault);
  }, [cotasNovo, dadosNovoVeiculo.valor_fipe]);

  // Pro-rata
  const proRata = useMemo(() => {
    const hoje = new Date();
    const diaVenc = diaVencimento || 10;
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const vencimento = new Date(anoAtual, mesAtual, Math.min(diaVenc, 28));

    let inicioPeríodo: Date;
    let fimPeríodo: Date;

    if (hoje >= vencimento) {
      inicioPeríodo = vencimento;
      fimPeríodo = new Date(anoAtual, mesAtual + 1, Math.min(diaVenc, 28));
    } else {
      inicioPeríodo = new Date(anoAtual, mesAtual - 1, Math.min(diaVenc, 28));
      fimPeríodo = vencimento;
    }

    const totalDias = differenceInDays(fimPeríodo, inicioPeríodo);
    const diasJaPagos = differenceInDays(hoje, inicioPeríodo);
    const diasRestantes = totalDias - diasJaPagos;

    const valorProRata = (totalMensalNovo / 30) * diasRestantes;
    const valorProRataAntigo = (totalMensalAntigo / 30) * diasRestantes;
    const diferenca = valorProRata - valorProRataAntigo;

    return {
      diaVenc,
      diasJaPagos: Math.max(0, diasJaPagos),
      diasRestantes: Math.max(0, diasRestantes),
      valorProRata,
      diferenca,
    };
  }, [diaVencimento, totalMensalNovo, totalMensalAntigo]);

  // Carência
  const dataEfetivacao = new Date();
  const dataFimCarencia = addDays(dataEfetivacao, 120);

  // =============================================
  // Gerar cobrança
  // =============================================
  const handleGerarCobranca = async () => {
    setGerandoCobranca(true);
    try {
      const dueDate = format(addDays(new Date(), 3), 'yyyy-MM-dd');
      const result = await criarCobranca.mutateAsync({
        billingType: formaPagamento,
        value: taxaSubstituicao,
        dueDate,
        description: `Taxa de substituição de veículo - Placa ${dadosNovoVeiculo.placa || 'N/A'}`,
        tipo: 'taxa_substituicao',
        associado_id: associadoId,
      });
      setCobrancaGerada(result as Record<string, unknown>);
      toast.success('Cobrança gerada com sucesso!');
    } catch (err) {
      toast.error('Erro ao gerar cobrança: ' + (err as Error).message);
    } finally {
      setGerandoCobranca(false);
    }
  };

  // =============================================
  // Enviar para aprovação
  // =============================================
  const handleEnviarAprovacao = async () => {
    setEnviando(true);
    try {
      let substId = substituicaoId;
      if (!substId) {
        substId = await onIniciarSubstituicao();
      }

      await atualizarSubstituicao.mutateAsync({
        id: substId,
        status: 'aguardando_aprovacao',
        mensalidade_nova: totalMensalNovo,
        cota_participacao_nova: cotaNovaValor,
        taxa_substituicao: taxaSubstituicao,
        valor_prorata: proRata.diferenca,
        diferenca_mensalidade: diferencaMensal,
        beneficios_novos: beneficiosSelecionados,
        veiculo_novo_placa: dadosNovoVeiculo.placa,
        veiculo_novo_modelo: `${dadosNovoVeiculo.marca || ''} ${dadosNovoVeiculo.modelo || ''}`.trim(),
        veiculo_novo_fipe: dadosNovoVeiculo.valor_fipe,
        data_inicio_carencia: format(dataEfetivacao, 'yyyy-MM-dd'),
        data_fim_carencia: format(dataFimCarencia, 'yyyy-MM-dd'),
        carencia_dias: 120,
        cobranca_taxa_asaas_id: (cobrancaGerada as Record<string, unknown>)?.cobranca_id || null,
      });

      toast.success('Substituição enviada para aprovação da diretoria!');
      onConfirmar();
    } catch (err) {
      toast.error('Erro: ' + (err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const canSubmit = cobrancaGerada && confirmado;

  // Itens comparativos de benefícios
  const beneficioRows = useMemo(() => {
    const rows: { nome: string; antigo: number; novo: number }[] = [];

    // Vidros
    const vidrosPreco = precosMap['cobertura_vidros']?.preco || 9.90;
    rows.push({
      nome: 'Vidros e Faróis',
      antigo: veiculoAntigo.cobertura_vidros ? vidrosPreco : 0,
      novo: beneficiosSelecionados.cobertura_vidros ? vidrosPreco : 0,
    });

    // Terceiros
    const ftAntigoKey = veiculoAntigo.cobertura_terceiros;
    const ftNovoKey = beneficiosSelecionados.cobertura_terceiros as string;
    rows.push({
      nome: 'Danos a Terceiros',
      antigo: ftAntigoKey && terceirosMap[ftAntigoKey] ? terceirosMap[ftAntigoKey].preco : 0,
      novo: ftNovoKey && terceirosMap[ftNovoKey] ? terceirosMap[ftNovoKey].preco : 0,
    });

    // Demais benefícios novos
    Object.entries(beneficiosSelecionados).forEach(([key, val]) => {
      if (key === 'cobertura_terceiros' || key === 'cobertura_vidros') return;
      if (val === true && precosMap[key]) {
        rows.push({
          nome: precosMap[key].nome,
          antigo: 0,
          novo: precosMap[key].preco,
        });
      }
    });

    return rows;
  }, [veiculoAntigo, beneficiosSelecionados, precosMap, terceirosMap]);

  return (
    <div className="space-y-6">
      {/* CARD 1: Taxa de Substituição */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Taxa de Substituição
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary">{formatCurrency(taxaSubstituicao)}</p>
              <p className="text-xs text-muted-foreground">Taxa administrativa obrigatória (Regulamento 2.1.6)</p>
            </div>
            {cobrancaGerada && (
              <Badge className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Gerada
              </Badge>
            )}
          </div>

          {!cobrancaGerada ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Forma de pagamento</Label>
                <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as typeof formaPagamento)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">
                      <span className="flex items-center gap-2"><QrCode className="h-3.5 w-3.5" /> Pix</span>
                    </SelectItem>
                    <SelectItem value="BOLETO">
                      <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Boleto</span>
                    </SelectItem>
                    <SelectItem value="UNDEFINED">
                      <span className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> Cartão de crédito</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGerarCobranca} disabled={gerandoCobranca} className="w-full">
                {gerandoCobranca ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Receipt className="h-4 w-4 mr-2" />}
                Gerar cobrança
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Badge variant="secondary">Aguardando pagamento</Badge>

              {/* PIX QR Code */}
              {formaPagamento === 'PIX' && (cobrancaGerada as Record<string, unknown>)?.pix_copia_cola && (
                <PixQRCode
                  copiaCola={(cobrancaGerada as Record<string, unknown>).pix_copia_cola as string}
                  valor={taxaSubstituicao}
                  descricao="Taxa de substituição de veículo"
                />
              )}

              {/* Boleto URL */}
              {formaPagamento === 'BOLETO' && (cobrancaGerada as Record<string, unknown>)?.boleto_url && (
                <Button variant="outline" asChild className="w-full">
                  <a href={(cobrancaGerada as Record<string, unknown>).boleto_url as string} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-2" />
                    Abrir boleto
                  </a>
                </Button>
              )}

              {/* Cartão link */}
              {formaPagamento === 'UNDEFINED' && (cobrancaGerada as Record<string, unknown>)?.invoiceUrl && (
                <Button variant="outline" asChild className="w-full">
                  <a href={(cobrancaGerada as Record<string, unknown>).invoiceUrl as string} target="_blank" rel="noopener noreferrer">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Abrir link de pagamento
                  </a>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CARD 2: Comparativo de Mensalidade */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Comparativo de Mensalidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!dadosNovoVeiculo.valor_fipe ? (
            <p className="text-sm text-muted-foreground">Consulte o valor FIPE do novo veículo primeiro.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Item</th>
                      <th className="text-right py-2 px-4 font-medium">Atual</th>
                      <th className="text-right py-2 px-4 font-medium">Nova</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 pr-4 text-muted-foreground">Mensalidade base</td>
                      <td className="py-2 px-4 text-right">{formatCurrency(mensalidadeBaseAntiga)}</td>
                      <td className="py-2 px-4 text-right">{formatCurrency(mensalidadeBaseNova)}</td>
                    </tr>
                    {beneficioRows.map((row, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2 pr-4 text-muted-foreground">{row.nome}</td>
                        <td className="py-2 px-4 text-right">{row.antigo > 0 ? formatCurrency(row.antigo) : '—'}</td>
                        <td className="py-2 px-4 text-right">{row.novo > 0 ? formatCurrency(row.novo) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2 pr-4">TOTAL MENSAL</td>
                      <td className="py-2 px-4 text-right">{formatCurrency(totalMensalAntigo)}</td>
                      <td className="py-2 px-4 text-right">{formatCurrency(totalMensalNovo)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-muted-foreground">DIFERENÇA</td>
                      <td className="py-2 px-4 text-right">—</td>
                      <td className={cn('py-2 px-4 text-right font-semibold', diferencaMensal > 0 ? 'text-red-600' : 'text-green-600')}>
                        {diferencaMensal > 0 ? '+' : ''}{formatCurrency(diferencaMensal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Input manual fallback */}
              <div className="mt-4 pt-4 border-t">
                <Label className="text-xs text-muted-foreground">
                  Ajustar mensalidade base manualmente (se necessário):
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Auto: ${formatCurrency((dadosNovoVeiculo.valor_fipe || 0) * 0.0045)}`}
                  value={mensalidadeManual}
                  onChange={(e) => setMensalidadeManual(e.target.value)}
                  className="mt-1 max-w-xs"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* CARD 3: Cota de Participação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Cota de Participação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Item</th>
                  <th className="text-right py-2 px-4 font-medium">Atual</th>
                  <th className="text-right py-2 px-4 font-medium">Nova</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4 text-muted-foreground">Valor FIPE</td>
                  <td className="py-2 px-4 text-right">{formatCurrency(veiculoAntigo.valor_fipe)}</td>
                  <td className="py-2 px-4 text-right">{formatCurrency(dadosNovoVeiculo.valor_fipe || 0)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 text-muted-foreground">Nº de Cotas</td>
                  <td className="py-2 px-4 text-right">{cotasAntigo?.cotas || '—'}</td>
                  <td className="py-2 px-4 text-right">{cotasNovo?.cotas || '—'}</td>
                </tr>
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 pr-4">COTA DE PARTICIPAÇÃO</td>
                  <td className="py-2 px-4 text-right">{formatCurrency(cotaAntigaValor)}</td>
                  <td className="py-2 px-4 text-right">{formatCurrency(cotaNovaValor)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* CARD 4: Pro-Rata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Pro-Rata do Mês Corrente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Dia de vencimento</p>
              <p className="font-medium">Dia {proRata.diaVenc}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dias já pagos</p>
              <p className="font-medium">{proRata.diasJaPagos} dias</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dias restantes</p>
              <p className="font-medium">{proRata.diasRestantes} dias</p>
            </div>
            <div>
              <p className="text-muted-foreground">Diferença pro-rata</p>
              <p className={cn('font-semibold', proRata.diferenca > 0 ? 'text-red-600' : 'text-green-600')}>
                {proRata.diferenca > 0 ? '+' : ''}{formatCurrency(proRata.diferenca)}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Este valor será ajustado no próximo boleto.</p>
        </CardContent>
      </Card>

      {/* CARD 5: Carência */}
      <Alert className="border-primary/30 bg-primary/5">
        <AlertTriangle className="h-4 w-4 text-primary" />
        <AlertDescription>
          <p className="font-semibold text-sm mb-1">CARÊNCIA DE 120 DIAS</p>
          <p className="text-xs text-muted-foreground">
            A partir da efetivação, o novo veículo terá carência de 120 dias para TODOS os benefícios.
          </p>
          <div className="flex gap-6 mt-2 text-xs">
            <span><strong>Início:</strong> {format(dataEfetivacao, 'dd/MM/yyyy')}</span>
            <span><strong>Fim:</strong> {format(dataFimCarencia, 'dd/MM/yyyy')}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Inclui: proteção veicular, vidros e todos os adicionais contratados.
          </p>
        </AlertDescription>
      </Alert>

      {/* RESUMO FINAL */}
      <Card className="border-primary/50 shadow-md">
        <CardHeader>
          <CardTitle className="text-base">Resumo Final</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Taxa de substituição</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatCurrency(taxaSubstituicao)}</span>
                <Badge variant={cobrancaGerada ? 'default' : 'secondary'} className={cn(cobrancaGerada && 'bg-green-600', 'text-xs')}>
                  {cobrancaGerada ? 'Gerada' : 'Pendente'}
                </Badge>
              </div>
            </div>
            <div className="flex justify-between">
              <span>Pro-rata a cobrar</span>
              <span className={cn('font-medium', proRata.diferenca > 0 ? 'text-red-600' : 'text-green-600')}>
                {proRata.diferenca > 0 ? '+' : ''}{formatCurrency(proRata.diferenca)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Nova mensalidade mensal</span>
              <span className="font-semibold text-primary">{formatCurrency(totalMensalNovo)}</span>
            </div>
            <div className="flex justify-between">
              <span>Nova cota de participação</span>
              <span className="font-medium">{formatCurrency(cotaNovaValor)}</span>
            </div>
            <div className="flex justify-between">
              <span>Carência até</span>
              <span className="font-medium">{format(dataFimCarencia, 'dd/MM/yyyy')}</span>
            </div>
          </div>

          <div className="pt-4 border-t">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={confirmado}
                onCheckedChange={(v) => setConfirmado(!!v)}
                className="mt-0.5"
              />
              <span className="text-sm">
                Confirmo que o associado está ciente dos valores e da carência de 120 dias.
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={handleEnviarAprovacao} disabled={!canSubmit || enviando}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Enviar para Aprovação
        </Button>
      </div>
    </div>
  );
}
