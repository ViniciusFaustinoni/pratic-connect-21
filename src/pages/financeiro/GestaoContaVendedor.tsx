import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useContaCorrenteVendedor, CCLancamento } from '@/hooks/useContaCorrenteVendedor';
import { RegistrarPagamentoCCModal } from '@/components/financeiro/RegistrarPagamentoCCModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { formatarMoeda } from '@/utils/format';
import { format } from 'date-fns';
import { DollarSign, TrendingUp, Clock, CheckCircle, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente', a_pagar: 'A pagar', pago: 'Pago',
  antecipado: 'Antecipado', cancelado: 'Cancelado', em_abatimento: 'Em abatimento',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pendente: 'outline', a_pagar: 'default', pago: 'secondary',
  antecipado: 'default', cancelado: 'destructive', em_abatimento: 'outline',
};

export default function GestaoContaVendedor() {
  const { vendedorId: paramId } = useParams<{ vendedorId: string }>();
  const [selectedVendedor, setSelectedVendedor] = useState(paramId || '');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipo, setTipo] = useState<'credito' | 'debito' | ''>('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modalParcela, setModalParcela] = useState<CCLancamento | null>(null);

  useEffect(() => { if (paramId) setSelectedVendedor(paramId); }, [paramId]);

  // Fetch external sellers
  const { data: vendedores } = useQuery({
    queryKey: ['vendedores-externos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('perfil_acesso', ['vendedor_externo', 'vendedor_clt'] as any[])
        .eq('ativo', true)
        .order('nome');
      return (data || []) as { id: string; nome: string }[];
    },
  });

  const { lancamentos, totalLancamentos, isLoadingLancamentos, saldo, isLoadingSaldo, registrarPagamento } =
    useContaCorrenteVendedor({ vendedorId: selectedVendedor, dataInicio, dataFim, tipo, status, page, pageSize: 15 });

  const totalPages = Math.ceil(totalLancamentos / 15);
  const vendedorNome = vendedores?.find(v => v.id === selectedVendedor)?.nome || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Conta Corrente</h1>
          <p className="text-muted-foreground">Venda Externa — {vendedorNome || 'Selecione um vendedor'}</p>
        </div>
        <Button variant="outline" disabled>
          <Zap className="h-4 w-4 mr-1" /> Antecipar Parcelas
        </Button>
      </div>

      {/* Vendor selector */}
      {!paramId && (
        <Card>
          <CardContent className="pt-6">
            <Select value={selectedVendedor} onValueChange={v => { setSelectedVendedor(v); setPage(1); }}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
              <SelectContent>
                {vendedores?.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {!selectedVendedor ? (
        <Alert><Info className="h-4 w-4" /><AlertDescription>Selecione um vendedor para visualizar a conta corrente.</AlertDescription></Alert>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${saldo.saldo_atual >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {isLoadingSaldo ? '...' : formatarMoeda(saldo.saldo_atual)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">A Receber Este Mês</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{isLoadingSaldo ? '...' : formatarMoeda(saldo.a_receber_mes)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Antecipações em Aberto</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoadingSaldo ? '...' : formatarMoeda(saldo.antecipacoes_abertas)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Data início</label>
                  <Input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPage(1); }} className="w-40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Data fim</label>
                  <Input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPage(1); }} className="w-40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                  <Select value={tipo} onValueChange={(v) => { setTipo(v as any); setPage(1); }}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="credito">Crédito</SelectItem>
                      <SelectItem value="debito">Débito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="a_pagar">A pagar</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="antecipado">Antecipado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Abatimento</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingLancamentos ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : lancamentos.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum lançamento</TableCell></TableRow>
                  ) : lancamentos.map((l: CCLancamento) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(l.data_lancamento), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="max-w-xs truncate">{l.descricao}</TableCell>
                      <TableCell>
                        <Badge variant={l.tipo === 'credito' ? 'default' : 'destructive'} className={l.tipo === 'credito' ? 'bg-green-600' : ''}>
                          {l.tipo === 'credito' ? 'Crédito' : 'Débito'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right ${l.tipo === 'credito' ? 'text-green-600' : 'text-destructive'}`}>{formatarMoeda(l.valor_bruto)}</TableCell>
                      <TableCell className="text-right">
                        {l.valor_abatimento > 0 ? <span className="text-orange-500 font-medium">-{formatarMoeda(l.valor_abatimento)}</span> : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${l.tipo === 'credito' ? 'text-green-600' : 'text-destructive'}`}>{formatarMoeda(l.valor_liquido)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[l.status] || 'outline'}
                          className={l.valor_abatimento > 0 && l.status !== 'cancelado' ? 'bg-orange-500 text-white border-orange-500' : ''}>
                          {l.valor_abatimento > 0 && l.status !== 'cancelado' ? 'Abatendo débito' : STATUS_LABELS[l.status] || l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{l.saldo_apos != null ? formatarMoeda(l.saldo_apos) : '—'}</TableCell>
                      <TableCell>
                        {l.status === 'a_pagar' && l.tipo === 'credito' && (
                          <Button size="sm" variant="outline" onClick={() => setModalParcela(l)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Pagar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                  <PaginationItem key={p}>
                    <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">{p}</PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}

          <RegistrarPagamentoCCModal
            open={!!modalParcela}
            onClose={() => setModalParcela(null)}
            parcela={modalParcela}
            onConfirm={(dados) => registrarPagamento.mutate(dados)}
            isSaving={registrarPagamento.isPending}
          />
        </>
      )}
    </div>
  );
}
