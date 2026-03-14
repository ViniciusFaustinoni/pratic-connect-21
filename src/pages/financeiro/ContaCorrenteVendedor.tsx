import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useContaCorrenteVendedor, CCLancamento } from '@/hooks/useContaCorrenteVendedor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { formatarMoeda } from '@/utils/format';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, TrendingUp, Clock, FileDown, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  a_pagar: 'A pagar',
  pago: 'Pago',
  antecipado: 'Antecipado',
  cancelado: 'Cancelado',
  em_abatimento: 'Em abatimento',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pendente: 'outline',
  a_pagar: 'default',
  pago: 'secondary',
  antecipado: 'default',
  cancelado: 'destructive',
  em_abatimento: 'outline',
};

export default function ContaCorrenteVendedor() {
  const { profile } = useAuth();
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipo, setTipo] = useState<'credito' | 'debito' | ''>('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [exportando, setExportando] = useState(false);

  const vendedorId = profile?.id || '';
  const { lancamentos, totalLancamentos, isLoadingLancamentos, saldo, isLoadingSaldo } = useContaCorrenteVendedor({
    vendedorId, dataInicio, dataFim, tipo, status, page, pageSize: 15,
  });

  const totalPages = Math.ceil(totalLancamentos / 15);

  const handleExportarPDF = async () => {
    if (!vendedorId) return;
    setExportando(true);
    try {
      // Fetch ALL lancamentos matching current filters (no pagination)
      let query = supabase
        .from('cc_vendedor_lancamentos')
        .select('*')
        .eq('vendedor_id', vendedorId)
        .order('data_lancamento', { ascending: true });

      if (dataInicio) query = query.gte('data_lancamento', dataInicio);
      if (dataFim) query = query.lte('data_lancamento', dataFim);
      if (tipo) query = query.eq('tipo', tipo);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;
      const todos = (data || []) as any[];

      if (todos.length === 0) {
        toast.info('Nenhum lançamento para exportar com os filtros atuais.');
        setExportando(false);
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const nomeVendedor = profile?.nome || 'Vendedor';

      // Header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Extrato — ${nomeVendedor}`, pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      const periodoTexto = dataInicio || dataFim
        ? `Período: ${dataInicio ? format(new Date(dataInicio), 'dd/MM/yyyy') : '—'} a ${dataFim ? format(new Date(dataFim), 'dd/MM/yyyy') : '—'}`
        : 'Período: Todos';
      doc.text(periodoTexto, pageWidth / 2, 25, { align: 'center' });
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 30, { align: 'center' });

      // Summary cards
      autoTable(doc, {
        startY: 36,
        head: [['Indicador', 'Valor']],
        body: [
          ['Saldo Atual', formatarMoeda(saldo.saldo_atual)],
          ['A Receber Este Mês', formatarMoeda(saldo.a_receber_mes)],
          ['Antecipações em Aberto', formatarMoeda(saldo.antecipacoes_abertas)],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
        theme: 'grid',
      });

      let y = (doc as any).lastAutoTable.finalY + 8;

      // Lancamentos table
      const tableData = todos.map((l: any) => [
        format(new Date(l.data_lancamento), 'dd/MM/yyyy'),
        l.descricao?.substring(0, 45) || '',
        l.tipo === 'credito' ? 'Crédito' : 'Débito',
        formatarMoeda(l.valor_bruto),
        l.valor_abatimento > 0 ? formatarMoeda(l.valor_abatimento) : '—',
        formatarMoeda(l.valor_liquido),
        STATUS_LABELS[l.status] || l.status,
        l.saldo_apos != null ? formatarMoeda(l.saldo_apos) : '—',
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Data', 'Descrição', 'Tipo', 'Bruto', 'Abat.', 'Líquido', 'Status', 'Saldo']],
        body: tableData,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
      }

      doc.save(`extrato-${nomeVendedor.replace(/\s/g, '_')}.pdf`);
      toast.success('Extrato exportado com sucesso!');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e as Error).message);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minha Conta Corrente</h1>
        <p className="text-muted-foreground">Extrato de comissões e débitos</p>
      </div>

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
            <p className="text-xs text-muted-foreground">{saldo.saldo_atual >= 0 ? 'Empresa deve a você' : 'Você deve à empresa'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">A Receber Este Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoadingSaldo ? '...' : formatarMoeda(saldo.a_receber_mes)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Antecipações em Aberto</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingSaldo ? '...' : formatarMoeda(saldo.antecipacoes_abertas)}
            </div>
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
                  <SelectItem value="em_abatimento">Em abatimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportarPDF} disabled={exportando || isLoadingLancamentos}>
              {exportando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
              Exportar PDF
            </Button>
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
                <TableHead className="text-right">Valor Bruto</TableHead>
                <TableHead className="text-right">Abatimento</TableHead>
                <TableHead className="text-right">Valor Líquido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Saldo Após</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLancamentos ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : lancamentos.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell></TableRow>
              ) : lancamentos.map((l: CCLancamento) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{format(new Date(l.data_lancamento), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="max-w-xs truncate">{l.descricao}</TableCell>
                  <TableCell>
                    <Badge variant={l.tipo === 'credito' ? 'default' : 'destructive'} className={l.tipo === 'credito' ? 'bg-green-600' : ''}>
                      {l.tipo === 'credito' ? 'Crédito' : 'Débito'}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right ${l.tipo === 'credito' ? 'text-green-600' : 'text-destructive'}`}>
                    {formatarMoeda(l.valor_bruto)}
                  </TableCell>
                  <TableCell className="text-right">
                    {l.valor_abatimento > 0 ? (
                      <span className="text-orange-500 font-medium">-{formatarMoeda(l.valor_abatimento)}</span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${l.tipo === 'credito' ? 'text-green-600' : 'text-destructive'}`}>
                    {formatarMoeda(l.valor_liquido)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[l.status] || 'outline'}
                      className={l.valor_abatimento > 0 && l.status !== 'cancelado' ? 'bg-orange-500 text-white border-orange-500' : ''}>
                      {l.valor_abatimento > 0 && l.status !== 'cancelado' ? 'Abatendo débito' : STATUS_LABELS[l.status] || l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{l.saldo_apos != null ? formatarMoeda(l.saldo_apos) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
            </PaginationItem>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <PaginationItem key={p}>
                  <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">{p}</PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
