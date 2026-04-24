import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Separator } from '@/components/ui/separator';
import { ArrowDownCircle, ArrowUpCircle, Clock, Landmark, Search, Wallet, Wrench } from 'lucide-react';
import { getComissaoStatusBadgeVariant, getComissaoStatusLabel } from '@/lib/comissoes-filtros';
import { getContaCorrentePeriodoRange, useContaCorrenteComissoes, type ContaCorrentePeriodo } from '@/hooks/useContaCorrenteComissoes';

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('pt-BR') : '—';

const periodoOptions: { value: ContaCorrentePeriodo; label: string }[] = [
  { value: 'mes_atual', label: 'Mês atual' },
  { value: 'mes_anterior', label: 'Mês anterior' },
  { value: 'ultimos_30', label: 'Últimos 30 dias' },
  { value: 'ano_atual', label: 'Ano atual' },
  { value: 'personalizado', label: 'Personalizado' },
];

const statusOptions = [
  { value: 'todos', label: 'Todos status' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'paga', label: 'Paga' },
  { value: 'cancelada', label: 'Cancelada' },
];

export default function ContaCorrenteComissoes() {
  const { filters, setFilters, items, total, totalPages, resumo, isLoading, usuarios, planos, linhas } = useContaCorrenteComissoes();

  const updateFilter = (patch: Partial<typeof filters>) => setFilters({ ...filters, page: 1, ...patch });

  const selectedUsuario = useMemo(
    () => usuarios.find((u) => u.id === filters.vendedorId),
    [usuarios, filters.vendedorId]
  );

  const handlePeriodo = (periodo: ContaCorrentePeriodo) => {
    if (periodo === 'personalizado') {
      updateFilter({ periodo });
      return;
    }
    updateFilter({ periodo, ...getContaCorrentePeriodoRange(periodo) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Wallet className="h-6 w-6 text-primary" />
            Conta Corrente de Comissões
          </h1>
          <p className="text-sm text-muted-foreground">
            Extrato e saldo de comissões conforme o perfil de acesso e a hierarquia do usuário logado.
          </p>
        </div>
        <div className="rounded-md border bg-card px-4 py-3 text-right">
          <p className="text-xs text-muted-foreground">Escopo atual</p>
          <p className="font-medium text-foreground">{selectedUsuario ? (selectedUsuario.nome || selectedUsuario.full_name || selectedUsuario.email) : 'Todos usuários visíveis'}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Saldo atual</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-foreground">{money(resumo.saldoAtual)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total creditado no período</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-foreground">{money(resumo.totalCreditadoPeriodo)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total debitado no período</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-foreground">{money(resumo.totalDebitadoPeriodo)}</div><p className="text-xs text-muted-foreground">{resumo.quantidade} lançamento(s) filtrado(s)</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">A receber no período</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-lg font-semibold text-foreground">{money(resumo.totalAReceber)}</p>
        </div>
        <div className="rounded-md border bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">Pendentes no período</span>
          <p className="mt-1 text-lg font-semibold text-foreground">{money(resumo.totalPendente)}</p>
        </div>
        <div className="rounded-md border bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">Total filtrado</span>
          <p className="mt-1 text-lg font-semibold text-foreground">{money(resumo.totalPeriodo)}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={filters.search} onChange={(e) => updateFilter({ search: e.target.value })} placeholder="Associado, contrato, plano..." />
            </div>
            <Select value={filters.periodo} onValueChange={(periodo) => handlePeriodo(periodo as ContaCorrentePeriodo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{periodoOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={filters.dataInicio} onChange={(e) => updateFilter({ periodo: 'personalizado', dataInicio: e.target.value })} />
            <Input type="date" value={filters.dataFim} onChange={(e) => updateFilter({ periodo: 'personalizado', dataFim: e.target.value })} />
            <Select value={filters.status} onValueChange={(status) => updateFilter({ status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.vendedorId} onValueChange={(vendedorId) => updateFilter({ vendedorId })}>
              <SelectTrigger><SelectValue placeholder="Usuário" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos usuários visíveis</SelectItem>{usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome || u.full_name || u.email}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.linha} onValueChange={(linha) => updateFilter({ linha, planoId: 'todos' })}>
              <SelectTrigger><SelectValue placeholder="Linha" /></SelectTrigger>
              <SelectContent><SelectItem value="todas">Todas linhas</SelectItem>{linhas.map((linha) => <SelectItem key={linha} value={linha}>{linha}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.planoId} onValueChange={(planoId) => updateFilter({ planoId })}>
              <SelectTrigger className="lg:col-span-2"><SelectValue placeholder="Plano" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos planos</SelectItem>{planos.filter((p) => filters.linha === 'todas' || p.linha === filters.linha).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(filters.pageSize)} onValueChange={(pageSize) => updateFilter({ pageSize: Number(pageSize) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="10">10 por página</SelectItem><SelectItem value="20">20 por página</SelectItem><SelectItem value="50">50 por página</SelectItem></SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
            <CardTitle className="text-base">Extrato completo de movimentações de comissões</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Movimento</TableHead>
                  <TableHead>Resumo da comissão</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Nenhum lançamento encontrado.</TableCell></TableRow>
                ) : items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">{date(item.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap">{date(item.pago_em)}</TableCell>
                    <TableCell><div className="font-medium text-foreground">{item.vendedor_nome}</div><div className="text-xs text-muted-foreground">{item.vendedor_email || item.role_destinatario || '—'}</div></TableCell>
                    <TableCell>{item.origem_nome || '—'}</TableCell>
                    <TableCell><Badge variant={item.tipo_movimento === 'credito' ? 'default' : 'secondary'}>{item.tipo_movimento === 'credito' ? 'Crédito' : 'Débito'}</Badge><div className="mt-1 text-xs text-muted-foreground">{item.categoria || 'comissão'}</div></TableCell>
                    <TableCell className="min-w-[260px]">
                      <div className="font-medium text-foreground">{item.associado_nome || 'Cliente não informado'}</div>
                      {item.descricao && <div className="text-xs text-muted-foreground">{item.descricao}</div>}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Plano: {item.plano_nome || '—'}</span>
                        <span>Linha: {item.plano_linha || '—'}</span>
                        <span>Contrato: {item.contrato_numero || item.contrato_id || '—'}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Wrench className="h-3 w-3" />
                        <span>Instalação: {item.instalacao_resumo || 'não localizada'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{item.parcela_numero ? `${item.parcela_numero}${item.parcela_total ? `/${item.parcela_total}` : ''}` : '—'}</TableCell>
                    <TableCell><Badge variant={getComissaoStatusBadgeVariant(item as any)}>{getComissaoStatusLabel(item as any)}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{item.tipo_movimento === 'debito' ? '-' : '+'}{money(item.valor_total)}</TableCell>
                    <TableCell className="text-right font-medium">{money(item.saldo_apos)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted-foreground">
            <span>{total} registro(s) • página {filters.page} de {totalPages}</span>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setFilters({ ...filters, page: Math.max(1, filters.page - 1) }); }} /></PaginationItem>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => <PaginationItem key={page}><PaginationLink href="#" isActive={page === filters.page} onClick={(e) => { e.preventDefault(); setFilters({ ...filters, page }); }}>{page}</PaginationLink></PaginationItem>)}
                <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setFilters({ ...filters, page: Math.min(totalPages, filters.page + 1) }); }} /></PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
