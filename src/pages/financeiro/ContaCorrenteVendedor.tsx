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
import { DollarSign, TrendingUp, Clock, FileDown, Loader2, CheckCircle, Search, Wallet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; color: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', variant: 'outline' },
  a_pagar: { label: 'A pagar', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', variant: 'outline' },
  pago: { label: 'Pago', color: 'bg-green-500/15 text-green-600 border-green-500/30', variant: 'secondary' },
  antecipado: { label: 'Antecipado', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', variant: 'default' },
  cancelado: { label: 'Estornado', color: 'bg-red-500/15 text-red-600 border-red-500/30', variant: 'destructive' },
  em_abatimento: { label: 'Em abatimento', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30', variant: 'outline' },
};

const CATEGORIA_LABELS: Record<string, string> = {
  adesao: 'Adesão',
  recorrente: 'Mensalidade',
  volante: 'Débito Volante',
  estorno: 'Estorno',
  cancelamento: 'Cancelamento',
};

function getTipoLabel(l: CCLancamento): string {
  if (l.categoria === 'adesao') return 'Adesão';
  if (l.categoria === 'recorrente' && l.parcela_numero) {
    return `Mensalidade (${l.parcela_numero}ª parcela)`;
  }
  return CATEGORIA_LABELS[l.categoria] || l.categoria;
}

export default function ContaCorrenteVendedor() {
  const { profile } = useAuth();
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipo, setTipo] = useState<'credito' | 'debito' | ''>('');
  const [status, setStatus] = useState('');
  const [categoria, setCategoria] = useState('');
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const [exportando, setExportando] = useState(false);

  const vendedorId = profile?.id || '';
  const { lancamentos, totalLancamentos, isLoadingLancamentos, resumo, isLoadingResumo } = useContaCorrenteVendedor({
    vendedorId, dataInicio, dataFim, tipo, status, categoria, busca, page, pageSize: 15,
  });

  const totalPages = Math.ceil(totalLancamentos / 15);

  const handleExportarCSV = () => {
    if (lancamentos.length === 0) {
      toast.info('Nenhum lançamento para exportar.');
      return;
    }
    const headers = ['Data', 'Tipo', 'Associado', 'Plano', 'Valor', 'Status', 'Data Pagamento'];
    const rows = lancamentos.map(l => [
      format(new Date(l.data_lancamento), 'dd/MM/yyyy'),
      getTipoLabel(l),
      l.associado_nome || '—',
      l.plano_nome || '—',
      l.valor_liquido.toFixed(2).replace('.', ','),
      STATUS_CONFIG[l.status]?.label || l.status,
      l.data_pagamento ? format(new Date(l.data_pagamento), 'dd/MM/yyyy') : '—',
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-comissoes-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  const handleExportarPDF = async () => {
    if (!vendedorId) return;
    setExportando(true);
    try {
      let query = (supabase as any)
        .from('cc_vendedor_lancamentos')
        .select(`*, associado:associados!cc_vendedor_lancamentos_associado_id_fkey(nome), contrato:contratos!cc_vendedor_lancamentos_contrato_id_fkey(plano_id, plano:planos!contratos_plano_id_fkey(nome))`)
        .eq('vendedor_id', vendedorId)
        .order('data_lancamento', { ascending: true });

      if (dataInicio) query = query.gte('data_lancamento', dataInicio);
      if (dataFim) query = query.lte('data_lancamento', dataFim);
      if (tipo) query = query.eq('tipo', tipo);
      if (status) query = query.eq('status', status);
      if (categoria) query = query.eq('categoria', categoria);
      if (busca) query = query.ilike('descricao', `%${busca}%`);

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

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Extrato de Comissões — ${nomeVendedor}`, pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      const periodoTexto = dataInicio || dataFim
        ? `Período: ${dataInicio ? format(new Date(dataInicio), 'dd/MM/yyyy') : '—'} a ${dataFim ? format(new Date(dataFim), 'dd/MM/yyyy') : '—'}`
        : 'Período: Todos';
      doc.text(periodoTexto, pageWidth / 2, 25, { align: 'center' });
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 30, { align: 'center' });

      autoTable(doc, {
        startY: 36,
        head: [['Indicador', 'Valor']],
        body: [
          ['A Receber Este Mês', formatarMoeda(resumo.a_receber_este_mes)],
          ['Já Recebido Este Mês', formatarMoeda(resumo.ja_recebido_este_mes)],
          ['Total a Receber', formatarMoeda(resumo.total_a_receber)],
          ['Total Histórico Recebido', formatarMoeda(resumo.total_historico_recebido)],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
        theme: 'grid',
      });

      let y = (doc as any).lastAutoTable.finalY + 8;

      const tableData = todos.map((l: any) => [
        format(new Date(l.data_lancamento), 'dd/MM/yyyy'),
        l.categoria === 'adesao' ? 'Adesão' : l.parcela_numero ? `Mensalidade (${l.parcela_numero}ª)` : CATEGORIA_LABELS[l.categoria] || l.categoria,
        l.associado?.nome?.substring(0, 30) || '—',
        l.contrato?.plano?.nome || '—',
        formatarMoeda(l.valor_liquido),
        STATUS_CONFIG[l.status]?.label || l.status,
        l.data_pagamento ? format(new Date(l.data_pagamento), 'dd/MM/yyyy') : '—',
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Data', 'Tipo', 'Associado', 'Plano', 'Valor', 'Status', 'Pagamento']],
        body: tableData,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
      }

      doc.save(`extrato-comissoes-${nomeVendedor.replace(/\s/g, '_')}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e as Error).message);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          Minhas Comissões
        </h1>
        <p className="text-muted-foreground">Acompanhe suas comissões e pagamentos</p>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Receber Este Mês</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingResumo ? '...' : formatarMoeda(resumo.a_receber_este_mes)}
            </div>
            <p className="text-xs text-muted-foreground">Comissões pendentes do mês</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Já Recebido Este Mês</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoadingResumo ? '...' : formatarMoeda(resumo.ja_recebido_este_mes)}
            </div>
            <p className="text-xs text-muted-foreground">Pagamentos confirmados no mês</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total a Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {isLoadingResumo ? '...' : formatarMoeda(resumo.total_a_receber)}
            </div>
            <p className="text-xs text-muted-foreground">Saldo pendente total</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Histórico Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingResumo ? '...' : formatarMoeda(resumo.total_historico_recebido)}
            </div>
            <p className="text-xs text-muted-foreground">Tudo que você já recebeu</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Buscar associado</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do associado..."
                  value={busca}
                  onChange={e => { setBusca(e.target.value); setPage(1); }}
                  className="pl-9 w-52"
                />
              </div>
            </div>
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
              <Select value={categoria} onValueChange={(v) => { setCategoria(v); setPage(1); }}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="adesao">Adesão</SelectItem>
                  <SelectItem value="recorrente">Mensalidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="a_pagar">A pagar</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Estornado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportarPDF} disabled={exportando || isLoadingLancamentos}>
                {exportando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportarCSV} disabled={isLoadingLancamentos}>
                <FileDown className="h-4 w-4 mr-1" />
                CSV
              </Button>
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
                <TableHead>Tipo</TableHead>
                <TableHead>Associado</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLancamentos ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : lancamentos.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell></TableRow>
              ) : lancamentos.map((l: CCLancamento) => {
                const statusCfg = STATUS_CONFIG[l.status] || { label: l.status, color: '', variant: 'outline' as const };
                return (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(l.data_lancamento), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="whitespace-nowrap">{getTipoLabel(l)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{l.associado_nome || '—'}</TableCell>
                    <TableCell>{l.plano_nome || '—'}</TableCell>
                    <TableCell className={`text-right font-medium ${l.tipo === 'credito' ? 'text-green-600' : 'text-destructive'}`}>
                      {l.tipo === 'debito' ? '-' : ''}{formatarMoeda(l.valor_liquido)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusCfg.color}>
                        {statusCfg.label}
                      </Badge>
                      {l.status === 'cancelado' && l.observacao_pagamento && (
                        <p className="text-xs text-destructive mt-1 max-w-[150px] truncate" title={l.observacao_pagamento}>
                          {l.observacao_pagamento}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {l.data_pagamento ? format(new Date(l.data_pagamento), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
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
