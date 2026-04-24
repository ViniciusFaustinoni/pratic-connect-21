import { useState } from 'react';
import { CheckCircle2, Download, Eye, PlayCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { ComissaoDetalhesPagamentoModal } from '@/components/comissoes/ComissaoDetalhesPagamentoModal';
import { useComissoesBackfill } from '@/hooks/useComissoesBackfill';
import { usePagamentosComissoes } from '@/hooks/usePagamentosComissoes';
import { COMISSOES_STATUS_OPTIONS, COMISSOES_TIPO_LANCAMENTO_OPTIONS } from '@/lib/comissoes-filtros';

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const nameOf = (item: any) => item?.nome || item?.full_name || item?.email || 'Sem nome';

export default function PagamentosComissoes() {
  const { executar, loading: backfillLoading, resultado } = useComissoesBackfill();
  const {
    filters,
    setFilters,
    items,
    total,
    totalPages,
    kpis,
    isLoading,
    grades,
    planos,
    vendedores,
    marcarComoPaga,
    gerarRecibo,
  } = usePagamentosComissoes();
  const [comissaoEmConferencia, setComissaoEmConferencia] = useState<string | null>(null);

  const updateFilter = (patch: Partial<typeof filters>) => setFilters({ ...filters, page: 1, ...patch });

  const selectedItem = items.find((item) => item.id === comissaoEmConferencia);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pagamentos de Comissões</h1>
          <p className="text-sm text-muted-foreground">Confira, liquide, registre lançamentos e emita recibos de comissões.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={backfillLoading} onClick={() => executar({ dry_run: true })}>
            <PlayCircle className="mr-2 h-4 w-4" /> Simular backfill
          </Button>
          <Button disabled={backfillLoading} onClick={() => executar({ dry_run: false })}>
            <RefreshCw className="mr-2 h-4 w-4" /> Executar backfill
          </Button>
        </div>
      </div>

      {resultado && (
        <Card>
          <CardContent className="py-3 text-sm text-muted-foreground">
            {resultado.dry_run ? 'Simulação' : 'Backfill'}: {resultado.total_cobrancas} cobrança(s), {resultado.total_comissoes_geradas} comissão(ões) gerada(s), {resultado.erros.length} erro(s).
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">A pagar</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(kpis.totalAPagar)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pago no período</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(kpis.totalPago)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Comissões</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.quantidade}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Destinatários</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.destinatarios}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lista paginada</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
            <Input className="lg:col-span-2" value={filters.search} onChange={(e) => updateFilter({ search: e.target.value })} placeholder="Buscar perfil/regra" />
            <Input type="date" value={filters.dataInicio} onChange={(e) => updateFilter({ dataInicio: e.target.value })} />
            <Input type="date" value={filters.dataFim} onChange={(e) => updateFilter({ dataFim: e.target.value })} />
            <Select value={filters.status} onValueChange={(status) => updateFilter({ status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COMISSOES_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.tipoLancamento} onValueChange={(tipoLancamento) => updateFilter({ tipoLancamento })}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>{COMISSOES_TIPO_LANCAMENTO_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.vendedorId} onValueChange={(vendedorId) => updateFilter({ vendedorId })}>
              <SelectTrigger><SelectValue placeholder="Destinatário" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos destinatários</SelectItem>{vendedores.map((v: any) => <SelectItem key={v.id} value={v.id}>{nameOf(v)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.gradeId} onValueChange={(gradeId) => updateFilter({ gradeId })}>
              <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todas grades</SelectItem>{grades.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.planoId} onValueChange={(planoId) => updateFilter({ planoId })}>
              <SelectTrigger><SelectValue placeholder="Plano" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos planos</SelectItem>{planos.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.parcela} onValueChange={(parcela) => updateFilter({ parcela })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todas">Todas parcelas</SelectItem>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => <SelectItem key={n} value={String(n)}>{n}ª</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(filters.pageSize)} onValueChange={(pageSize) => updateFilter({ pageSize: Number(pageSize) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="10">10 por página</SelectItem><SelectItem value="20">20 por página</SelectItem><SelectItem value="50">50 por página</SelectItem></SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Destinatário</TableHead><TableHead>Origem</TableHead><TableHead>Plano/Grade</TableHead><TableHead>Parcela</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Base</TableHead><TableHead className="text-right">Regra</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow> : items.length === 0 ? <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Nenhum lançamento encontrado.</TableCell></TableRow> : items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{new Date(item.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell><div className="font-medium">{item.destinatario_nome}</div><div className="text-xs text-muted-foreground">{item.destinatario_email}</div></TableCell>
                    <TableCell>{item.vendedor_origem_nome || '—'}</TableCell>
                    <TableCell><div>{item.plano || '—'}</div><div className="text-xs text-muted-foreground">{item.grade || '—'}</div></TableCell>
                    <TableCell>{item.parcela ? `${item.parcela}ª` : '—'}</TableCell>
                    <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                    <TableCell className="text-right">{money(item.valor_base)}</TableCell>
                    <TableCell className="text-right">{item.tipo_calculo === 'valor_fixo' ? money(item.regra_valor) : `${Number(item.percentual_aplicado || 0).toFixed(2)}%`}</TableCell>
                    <TableCell className="text-right font-medium">{money(item.valor_pago)}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => setComissaoEmConferencia(item.id)}><Eye className="mr-1 h-3.5 w-3.5" />Detalhes</Button>{item.status !== 'paga' ? <Button size="sm" onClick={() => setComissaoEmConferencia(item.id)}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Pagar</Button> : <Button size="sm" variant="outline" onClick={() => gerarRecibo(item)}><Download className="mr-1 h-3.5 w-3.5" />Recibo</Button>}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{total} registro(s) • página {filters.page} de {totalPages}</span>
            <Pagination className="mx-0 w-auto"><PaginationContent><PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setFilters({ ...filters, page: Math.max(1, filters.page - 1) }); }} /></PaginationItem>{Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => <PaginationItem key={page}><PaginationLink href="#" isActive={page === filters.page} onClick={(e) => { e.preventDefault(); setFilters({ ...filters, page }); }}>{page}</PaginationLink></PaginationItem>)}<PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setFilters({ ...filters, page: Math.min(totalPages, filters.page + 1) }); }} /></PaginationItem></PaginationContent></Pagination>
          </div>
        </CardContent>
      </Card>

      <ComissaoDetalhesPagamentoModal open={Boolean(comissaoEmConferencia)} comissaoId={comissaoEmConferencia} onOpenChange={(open) => !open && setComissaoEmConferencia(null)} allowConfirm confirming={marcarComoPaga.isPending} onConfirmPayment={(id) => marcarComoPaga.mutate(id, { onSuccess: () => setComissaoEmConferencia(null) })} onDownloadReceipt={(recibo) => gerarRecibo(recibo || selectedItem)} />
    </div>
  );
}