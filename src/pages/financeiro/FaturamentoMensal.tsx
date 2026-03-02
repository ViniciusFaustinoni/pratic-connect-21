import { useState, useMemo } from 'react';
import {
  Calendar, DollarSign, Users, FileText, Play, CheckCircle,
  AlertCircle, Loader2, ExternalLink, Eye, Send, Calculator,
  Lock, ChevronRight, Search, ArrowUpDown, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  useFechamento,
  useFechamentosMensais,
  useExecutarFechamento,
  useCalcularRateio,
  useGerarFaturas,
  getNomeMes,
  getStatusColor,
  getStatusLabel,
  formatCurrency,
  type PreviewFatura,
  type DespesaRateio,
  type DespesasManuais,
} from '@/hooks/useFechamentoMensal';

const meses = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
];

const ETAPAS = [
  { key: 'fechar', label: 'Fechar Mês', icon: Lock },
  { key: 'rateio', label: 'Calcular Rateio', icon: Calculator },
  { key: 'faturas', label: 'Gerar Faturas', icon: Send },
];

const CATEGORIAS_DESPESA: { key: keyof DespesasManuais; label: string; icon: string }[] = [
  { key: 'colisao', label: 'Total pago em colisões', icon: '🚗' },
  { key: 'roubo_furto', label: 'Total pago em roubos/furtos', icon: '🔒' },
  { key: 'assistencia', label: 'Total pago em assistência 24h', icon: '🚑' },
  { key: 'terceiros', label: 'Total pago em danos a terceiros', icon: '👥' },
  { key: 'vidros', label: 'Total pago em vidros/faróis', icon: '🪟' },
  { key: 'outros', label: 'Outras despesas operacionais', icon: '📋' },
];

function getEtapaAtual(status?: string): number {
  if (!status || status === 'aberto') return 0;
  if (status === 'fechado') return 1;
  if (status === 'aprovado') return 2;
  return 3;
}

export default function FaturamentoMensal() {
  const navigate = useNavigate();

  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [previewData, setPreviewData] = useState<PreviewFatura[] | null>(null);
  const [filtroPreview, setFiltroPreview] = useState('');
  const [confirmarGeracaoAberto, setConfirmarGeracaoAberto] = useState(false);
  const [confirmarFechamentoAberto, setConfirmarFechamentoAberto] = useState(false);
  const [resultadoGeracao, setResultadoGeracao] = useState<any>(null);

  // Despesas manuais
  const [despesas, setDespesas] = useState<DespesasManuais>({
    colisao: 0, roubo_furto: 0, assistencia: 0, terceiros: 0, vidros: 0, outros: 0,
  });

  const totalGeralDespesas = useMemo(
    () => Object.values(despesas).reduce((s, v) => s + v, 0),
    [despesas]
  );

  const { data: fechamento, isLoading: loadingFechamento } = useFechamento(mesSelecionado, anoSelecionado);
  const { data: historico, isLoading: loadingHistorico } = useFechamentosMensais();
  const executarFechamento = useExecutarFechamento();
  const calcularRateio = useCalcularRateio();
  const gerarFaturas = useGerarFaturas();

  const etapaAtual = getEtapaAtual(fechamento?.status);
  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];

  const totalAssociados = fechamento?.total_associados_ativos ?? 0;
  const totalCotas = fechamento?.total_cotas_ativas ?? 0;
  const totalDespesas = fechamento?.total_despesas_rateio ?? 0;
  const valorMedioCota = totalCotas > 0 ? totalDespesas / totalCotas : 0;
  const despesasRateio: DespesaRateio[] = (fechamento as any)?.despesas_rateio ?? [];

  const previewFiltrado = previewData?.filter(f =>
    !filtroPreview ||
    f.associado_nome?.toLowerCase().includes(filtroPreview.toLowerCase()) ||
    f.veiculo_placa?.toLowerCase().includes(filtroPreview.toLowerCase())
  )?.sort((a, b) => (b.composicao?.total ?? 0) - (a.composicao?.total ?? 0)) ?? [];

  const previewStats = previewData ? {
    total: previewData.length,
    valorTotal: previewData.reduce((s, f) => s + (f.composicao?.total ?? 0), 0),
    maior: Math.max(...previewData.map(f => f.composicao?.total ?? 0), 0),
    menor: previewData.length > 0 ? Math.min(...previewData.map(f => f.composicao?.total ?? Infinity)) : 0,
  } : null;

  function handleDespesaChange(key: keyof DespesasManuais, value: string) {
    const num = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    setDespesas(prev => ({ ...prev, [key]: num }));
  }

  async function handleFecharMes() {
    if (totalGeralDespesas <= 0) return;
    setConfirmarFechamentoAberto(false);
    executarFechamento.mutate({
      mes: mesSelecionado,
      ano: anoSelecionado,
      despesas_manuais: despesas,
    });
  }

  async function handleCalcularRateio() {
    if (!fechamento?.id) return;
    const { data: { user } } = await supabase.auth.getUser();
    calcularRateio.mutate({
      fechamento_id: fechamento.id,
      aprovar: true,
      profile_id: user?.id,
    });
  }

  async function handleSimularFaturas() {
    if (!fechamento?.id) return;
    gerarFaturas.mutate(
      { fechamento_id: fechamento.id, preview: true },
      { onSuccess: (data) => setPreviewData(data.faturas ?? []) }
    );
  }

  async function handleGerarFaturas() {
    if (!fechamento?.id) return;
    setConfirmarGeracaoAberto(false);
    gerarFaturas.mutate(
      { fechamento_id: fechamento.id, preview: false, enviar_whatsapp: true },
      { onSuccess: (data) => { setResultadoGeracao(data); setPreviewData(null); } }
    );
  }

  const isProcessing = executarFechamento.isPending || calcularRateio.isPending || gerarFaturas.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faturamento Mensal</h1>
        <p className="text-muted-foreground">
          Pipeline de rateio mutualista — fechamento, cálculo e geração de faturas
        </p>
      </div>

      {/* Seletor de Período */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Período de Referência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mês</label>
              <Select value={String(mesSelecionado)} onValueChange={(v) => { setMesSelecionado(Number(v)); setPreviewData(null); setResultadoGeracao(null); }}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meses.map((mes) => (
                    <SelectItem key={mes.value} value={String(mes.value)}>{mes.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select value={String(anoSelecionado)} onValueChange={(v) => { setAnoSelecionado(Number(v)); setPreviewData(null); setResultadoGeracao(null); }}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map((ano) => (
                    <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fechamento && (
              <Badge className={getStatusColor(fechamento.status)}>
                {getStatusLabel(fechamento.status)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards - only show when fechamento exists */}
      {fechamento && !loadingFechamento && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Associados Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssociados}</div>
              <p className="text-xs text-muted-foreground">Participam do rateio</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Cotas</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCotas.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-muted-foreground">Soma das cotas ativas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Despesas Rateio</CardTitle>
              <DollarSign className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalDespesas)}</div>
              <p className="text-xs text-muted-foreground">Total informado</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Médio/Cota</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(valorMedioCota)}</div>
              <p className="text-xs text-muted-foreground">Despesas ÷ Cotas</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loadingFechamento && (
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>
          ))}
        </div>
      )}

      {/* Stepper Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline de Faturamento</CardTitle>
          <CardDescription>
            {getNomeMes(mesSelecionado)} / {anoSelecionado} — 3 etapas sequenciais
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Stepper visual */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {ETAPAS.map((etapa, i) => {
              const done = etapaAtual > i;
              const active = etapaAtual === i;
              const Icon = etapa.icon;
              return (
                <div key={etapa.key} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                    done ? 'bg-primary/10 text-primary' :
                    active ? 'bg-primary text-primary-foreground' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {done ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    {etapa.label}
                  </div>
                </div>
              );
            })}
            {etapaAtual >= 3 && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-800 whitespace-nowrap">
                  <CheckCircle className="h-4 w-4" />
                  Concluído
                </div>
              </>
            )}
          </div>

          {/* ETAPA 1: Fechar Mês - Entrada Manual de Despesas */}
          {etapaAtual === 0 && (
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <Lock className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Etapa 1 — Informar Despesas do Mês</AlertTitle>
                <AlertDescription className="text-blue-700">
                  Informe os valores pagos em cada categoria de benefício para {getNomeMes(mesSelecionado)}/{anoSelecionado}.
                  O sistema contará automaticamente os associados e cotas ativas.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {CATEGORIAS_DESPESA.map((cat) => (
                  <div key={cat.key} className="space-y-1.5">
                    <Label htmlFor={`desp-${cat.key}`} className="text-sm flex items-center gap-2">
                      <span>{cat.icon}</span> {cat.label}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                      <Input
                        id={`desp-${cat.key}`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        className="pl-10"
                        value={despesas[cat.key] || ''}
                        onChange={(e) => handleDespesaChange(cat.key, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">TOTAL GERAL DE DESPESAS</p>
                  <p className="text-3xl font-bold">{formatCurrency(totalGeralDespesas)}</p>
                </div>
                <Button
                  size="lg"
                  onClick={() => setConfirmarFechamentoAberto(true)}
                  disabled={isProcessing || totalGeralDespesas <= 0}
                >
                  {executarFechamento.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fechando...</>
                  ) : (
                    <><Lock className="mr-2 h-4 w-4" />Fechar Mês</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ETAPA 2: Calcular Rateio + Prévia */}
          {etapaAtual === 1 && (
            <div className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50">
                <Calculator className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Etapa 2 — Calcular e Aprovar Rateio</AlertTitle>
                <AlertDescription className="text-amber-700">
                  Revise as despesas informadas e aprove o rateio.
                  Ao aprovar, o valor por cota é calculado para cada benefício.
                </AlertDescription>
              </Alert>

              {/* Resumo da prévia */}
              <div className="grid gap-4 md:grid-cols-3">
                <MiniKpi label="Total de Despesas" value={formatCurrency(totalDespesas)} />
                <MiniKpi label="Total de Cotas Ativas" value={totalCotas.toLocaleString('pt-BR')} />
                <MiniKpi label="Valor por Cota (média)" value={formatCurrency(valorMedioCota)} />
              </div>

              {despesasRateio.length > 0 && <TabelaDespesas despesas={despesasRateio} />}

              <div className="flex justify-end">
                <Button onClick={handleCalcularRateio} disabled={isProcessing}>
                  {calcularRateio.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Calculando...</>
                  ) : (
                    <><Calculator className="mr-2 h-4 w-4" />Calcular e Aprovar Rateio</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ETAPA 3: Gerar Faturas */}
          {etapaAtual === 2 && (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <Send className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Etapa 3 — Gerar Faturas</AlertTitle>
                <AlertDescription className="text-green-700">
                  Simule antes de gerar. Após a geração, os boletos são criados no ASAAS e enviados aos associados.
                </AlertDescription>
              </Alert>

              {despesasRateio.length > 0 && <TabelaDespesas despesas={despesasRateio} />}

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleSimularFaturas} disabled={isProcessing}>
                  {gerarFaturas.isPending && !confirmarGeracaoAberto ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Simulando...</>
                  ) : (
                    <><Eye className="mr-2 h-4 w-4" />Simular Faturas</>
                  )}
                </Button>
                <Button onClick={() => setConfirmarGeracaoAberto(true)} disabled={isProcessing}>
                  <Send className="mr-2 h-4 w-4" />
                  Gerar Faturas no ASAAS
                </Button>
              </div>
            </div>
          )}

          {/* PROCESSADO */}
          {etapaAtual >= 3 && (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Faturamento Concluído</AlertTitle>
                <AlertDescription className="text-green-700">
                  As faturas de {getNomeMes(mesSelecionado)}/{anoSelecionado} foram geradas e enviadas.
                </AlertDescription>
              </Alert>

              {/* Resumo final */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MiniKpi label="Mês de Referência" value={`${getNomeMes(mesSelecionado)}/${anoSelecionado}`} />
                <MiniKpi label="Total Associados" value={String(totalAssociados)} />
                <MiniKpi label="Total Despesas" value={formatCurrency(totalDespesas)} />
                <MiniKpi label="Valor Médio/Cota" value={formatCurrency(valorMedioCota)} />
              </div>

              <Button
                variant="outline"
                onClick={() => navigate(`/financeiro/cobrancas?competencia=${String(mesSelecionado).padStart(2, '0')}/${anoSelecionado}`)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver Cobranças Geradas
              </Button>
            </div>
          )}

          {/* Resultado da geração */}
          {resultadoGeracao && (
            <Alert className="mt-4 border-primary/20 bg-primary/5">
              <CheckCircle className="h-4 w-4 text-primary" />
              <AlertTitle>Resultado da Geração</AlertTitle>
              <AlertDescription>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div><span className="font-semibold">{resultadoGeracao.geradas ?? 0}</span> faturas geradas</div>
                  <div><span className="font-semibold text-destructive">{resultadoGeracao.erros ?? 0}</span> erros</div>
                  <div><span className="font-semibold">{resultadoGeracao.whatsappEnviados ?? 0}</span> WhatsApp enviados</div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Preview / Simulação */}
      {previewData && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Simulação de Faturas ({previewData.length})
            </CardTitle>
            <CardDescription>Valores estimados — nenhum boleto foi gerado ainda</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewStats && (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <MiniKpi label="Total Faturas" value={String(previewStats.total)} />
                <MiniKpi label="Valor Total" value={formatCurrency(previewStats.valorTotal)} />
                <MiniKpi label="Maior Boleto" value={formatCurrency(previewStats.maior)} />
                <MiniKpi label="Menor Boleto" value={formatCurrency(previewStats.menor === Infinity ? 0 : previewStats.menor)} />
              </div>
            )}

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por nome ou placa..."
                value={filtroPreview}
                onChange={(e) => setFiltroPreview(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Associado</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead className="text-center">Cotas</TableHead>
                    <TableHead className="text-right">Taxa Admin</TableHead>
                    <TableHead className="text-right">Rateio</TableHead>
                    <TableHead className="text-right">Pro-rata</TableHead>
                    <TableHead className="text-right font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewFiltrado.slice(0, 50).map((f, i) => {
                    const c = f.composicao ?? {} as any;
                    const rateioTotal = (c.rateio_colisao ?? 0) + (c.rateio_roubo_furto ?? 0) +
                      (c.rateio_incendio ?? 0) + (c.rateio_vidros ?? 0) +
                      (c.rateio_terceiros ?? 0) + (c.rateio_assistencia ?? 0) +
                      (c.rateio_outros ?? 0);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{f.associado_nome}</TableCell>
                        <TableCell><Badge variant="outline">{f.veiculo_placa}</Badge></TableCell>
                        <TableCell className="text-center">{f.cotas}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.taxa_administrativa ?? 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(rateioTotal)}</TableCell>
                        <TableCell className="text-right">
                          {c.fator_prorata != null && c.fator_prorata < 1
                            ? `${(c.fator_prorata * 100).toFixed(0)}%`
                            : '100%'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(c.total ?? 0)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {previewFiltrado.length > 50 && (
              <p className="text-xs text-muted-foreground text-center">
                Exibindo 50 de {previewFiltrado.length} faturas
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Histórico de Faturamentos
          </CardTitle>
          <CardDescription>Fechamentos anteriores e seus status</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistorico ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : historico && historico.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Associados</TableHead>
                  <TableHead className="text-right">Despesas Rateio</TableHead>
                  <TableHead className="text-right">Total Geral</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{getNomeMes(f.mes)} / {f.ano}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={getStatusColor(f.status)}>{getStatusLabel(f.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{f.total_associados_ativos || 0}</TableCell>
                    <TableCell className="text-right">{formatCurrency(f.total_despesas_rateio || 0)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(f.total_geral || 0)}</TableCell>
                    <TableCell>
                      {f.fechado_em
                        ? format(new Date(f.fechado_em), 'dd/MM/yyyy', { locale: ptBR })
                        : f.created_at
                          ? format(new Date(f.created_at), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.status === 'processado' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/financeiro/cobrancas?competencia=${String(f.mes).padStart(2, '0')}/${f.ano}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum fechamento realizado ainda.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de fechamento */}
      <Dialog open={confirmarFechamentoAberto} onOpenChange={setConfirmarFechamentoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Fechamento do Mês
            </DialogTitle>
            <DialogDescription>
              Revise os valores informados antes de confirmar o fechamento de {getNomeMes(mesSelecionado)}/{anoSelecionado}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 text-sm">
            {CATEGORIAS_DESPESA.map((cat) => (
              despesas[cat.key] > 0 && (
                <div key={cat.key} className="flex justify-between">
                  <span className="text-muted-foreground">{cat.icon} {cat.label}</span>
                  <span className="font-medium">{formatCurrency(despesas[cat.key])}</span>
                </div>
              )
            ))}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>TOTAL GERAL</span>
              <span>{formatCurrency(totalGeralDespesas)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarFechamentoAberto(false)}>Cancelar</Button>
            <Button onClick={handleFecharMes} disabled={executarFechamento.isPending}>
              {executarFechamento.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fechando...</>
              ) : (
                <><Lock className="mr-2 h-4 w-4" />Confirmar Fechamento</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de geração */}
      <Dialog open={confirmarGeracaoAberto} onOpenChange={setConfirmarGeracaoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Geração de Faturas</DialogTitle>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong>. Os boletos serão criados no ASAAS e enviados aos associados via WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            <p>Período: <strong>{getNomeMes(mesSelecionado)} / {anoSelecionado}</strong></p>
            <p>Associados no rateio: <strong>{totalAssociados}</strong></p>
            <p>Total de despesas: <strong>{formatCurrency(totalDespesas)}</strong></p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarGeracaoAberto(false)}>Cancelar</Button>
            <Button onClick={handleGerarFaturas} disabled={gerarFaturas.isPending}>
              {gerarFaturas.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Confirmar e Gerar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Sub-componentes ---------- */

function TabelaDespesas({ despesas }: { despesas: DespesaRateio[] }) {
  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo Benefício</TableHead>
            <TableHead className="text-center">Eventos</TableHead>
            <TableHead className="text-right">Valor Total</TableHead>
            <TableHead className="text-center">Cotas Elegíveis</TableHead>
            <TableHead className="text-right">Valor/Cota</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {despesas.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium capitalize">{d.tipo_beneficio?.replace(/_/g, ' ')}</TableCell>
              <TableCell className="text-center">{d.quantidade_eventos}</TableCell>
              <TableCell className="text-right">{formatCurrency(d.valor_total)}</TableCell>
              <TableCell className="text-center">{d.total_cotas_elegivel?.toLocaleString('pt-BR')}</TableCell>
              <TableCell className="text-right">{formatCurrency(d.valor_por_cota)}</TableCell>
            </TableRow>
          ))}
          {despesas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                Nenhuma despesa registrada para este período.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
