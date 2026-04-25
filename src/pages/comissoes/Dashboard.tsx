import { lazy, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DollarSign, CheckCircle2, Clock, Infinity as InfinityIcon, Trophy, BarChart3, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/components/comissoes/KpiCard';
import { ComissoesDetalhesModal } from '@/components/comissoes/ComissoesDetalhesModal';
import { useComissoesDashboard, type ComissaoDashboardItem } from '@/hooks/useComissoesDashboard';
import { COMISSOES_STATUS_OPTIONS, COMISSOES_TIPO_LANCAMENTO_OPTIONS, isComissaoVitalicia } from '@/lib/comissoes-filtros';
import type { DateRange } from 'react-day-picker';

const VendaExterna = lazy(() => import('./VendaExterna'));

const formatMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function DashboardComissoes() {
  const hoje = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
    to: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0),
  });
  const [status, setStatus] = useState('todos');
  const [tipoLancamento, setTipoLancamento] = useState('todos');
  const { items, kpis, isLoading } = useComissoesDashboard({
    dataInicio: dateRange?.from,
    dataFim: dateRange?.to || dateRange?.from,
    status,
    tipoLancamento,
  });
  const [modal, setModal] = useState<{ title: string; items: ComissaoDashboardItem[] } | null>(null);

  const pendentes = useMemo(() => items.filter(i => ['pendente', 'aprovada'].includes(i.status)), [items]);
  const pagas = useMemo(() => items.filter(i => ['paga', 'pago'].includes(i.status) || !!i.pago_em), [items]);
  const aguardando = useMemo(() => items.filter(i => i.status === 'pendente'), [items]);
  const vitalicias = useMemo(() => items.filter(isComissaoVitalicia), [items]);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabAtiva = searchParams.get('tab') === 'venda-externa' ? 'venda-externa' : 'visao-geral';

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'venda-externa') {
      next.set('tab', 'venda-externa');
    } else {
      next.delete('tab');
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard de Comissões</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe valores gerados automaticamente por pagamento reconhecido e a gestão de vendedores externos.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/comissoes/pagamentos">Pagamentos</a>
        </Button>
      </div>

      <Tabs value={tabAtiva} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="visao-geral" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="venda-externa" className="gap-2">
            <Users className="h-4 w-4" />
            Venda Externa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando comissões...</div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Filtros</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[minmax(260px,1fr)_220px_220px]">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Período</label>
                    <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Status</label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMISSOES_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Tipo de lançamento</label>
                    <Select value={tipoLancamento} onValueChange={setTipoLancamento}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMISSOES_TIPO_LANCAMENTO_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard title="Total a pagar no período" value={formatMoney(kpis.totalAPagarMes)} description={`${pendentes.length} lançamento(s)`} icon={DollarSign} onClick={() => setModal({ title: 'Total a pagar no período selecionado', items: pendentes })} />
                <KpiCard title="Total pago no período" value={formatMoney(kpis.totalPagoMes)} description={`${pagas.length} lançamento(s)`} icon={CheckCircle2} onClick={() => setModal({ title: 'Total pago no período selecionado', items: pagas })} />
                <KpiCard title="Pendente de aprovação" value={String(kpis.pendenteAprovacao)} description="Clique para detalhar" icon={Clock} onClick={() => setModal({ title: 'Pendentes de aprovação', items: aguardando })} />
                <KpiCard title="Comissões vitalícias" value={String(kpis.vitaliciasAtivas)} description="Lançamentos no período" icon={InfinityIcon} onClick={() => setModal({ title: 'Comissões vitalícias', items: vitalicias })} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" /> Top 5 vendedores no período</CardTitle>
                </CardHeader>
                <CardContent>
                  {kpis.topVendedores.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma comissão gerada no período.</p>
                  ) : (
                    <div className="space-y-3">
                      {kpis.topVendedores.map((v, idx) => (
                        <div key={v.vendedor_id} className="flex items-center justify-between rounded-md border p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">{idx + 1}</span>
                            <span className="font-medium truncate">{v.nome}</span>
                          </div>
                          <span className="font-semibold">{formatMoney(v.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="venda-externa">
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
            <VendaExterna embedded />
          </Suspense>
        </TabsContent>
      </Tabs>

      <ComissoesDetalhesModal
        open={!!modal}
        onOpenChange={(open) => !open && setModal(null)}
        title={modal?.title || ''}
        items={modal?.items || []}
      />
    </div>
  );
}
