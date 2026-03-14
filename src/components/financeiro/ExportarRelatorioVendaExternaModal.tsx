import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { formatarMoeda } from '@/utils/format';
import { toast } from 'sonner';
import { Loader2, FileDown } from 'lucide-react';

interface Vendedor { vendedor_id: string; vendedor_nome: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  vendedores: Vendedor[];
}

export function ExportarRelatorioVendaExternaModal({ open, onClose, vendedores }: Props) {
  const [dataInicio, setDataInicio] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [vendedorId, setVendedorId] = useState('todos');
  const [loading, setLoading] = useState(false);

  const handleExportar = async () => {
    setLoading(true);
    try {
      // 1) Fetch lancamentos in period
      let query = supabase
        .from('cc_vendedor_lancamentos')
        .select('*')
        .gte('data_lancamento', dataInicio)
        .lte('data_lancamento', dataFim)
        .order('vendedor_id')
        .order('data_lancamento', { ascending: true });

      if (vendedorId !== 'todos') {
        query = query.eq('vendedor_id', vendedorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      const lancamentos = (data || []) as any[];

      // 2) Fetch lancamentos BEFORE period for opening balance
      let queryAntes = supabase
        .from('cc_vendedor_lancamentos')
        .select('vendedor_id, tipo, valor_liquido, status')
        .lt('data_lancamento', dataInicio)
        .neq('status', 'cancelado');

      if (vendedorId !== 'todos') {
        queryAntes = queryAntes.eq('vendedor_id', vendedorId);
      }

      const { data: dataAntes, error: errorAntes } = await queryAntes;
      if (errorAntes) throw errorAntes;
      const lancamentosAntes = (dataAntes || []) as any[];

      // Compute opening balances per vendor
      const saldoInicial: Record<string, number> = {};
      lancamentosAntes.forEach(l => {
        if (!saldoInicial[l.vendedor_id]) saldoInicial[l.vendedor_id] = 0;
        const val = Number(l.valor_liquido);
        saldoInicial[l.vendedor_id] += l.tipo === 'credito' ? val : -val;
      });

      // Group by vendor
      const byVendedor: Record<string, any[]> = {};
      lancamentos.forEach(l => {
        if (!byVendedor[l.vendedor_id]) byVendedor[l.vendedor_id] = [];
        byVendedor[l.vendedor_id].push(l);
      });

      const nomeMap: Record<string, string> = {};
      vendedores.forEach(v => { nomeMap[v.vendedor_id] = v.vendedor_nome; });

      // Dashboard card calculations (within period, non-cancelled)
      const active = lancamentos.filter(l => l.status !== 'cancelado');
      const aPagar = active.filter(l => l.status === 'a_pagar' && l.tipo === 'credito').reduce((s, l) => s + Number(l.valor_liquido), 0);
      const antecipacoes = active.filter(l => l.status === 'antecipado').reduce((s, l) => s + Number(l.valor_liquido), 0);
      const debitosPendentes = active.filter(l => l.status === 'em_abatimento' && l.tipo === 'debito').reduce((s, l) => s + Number(l.valor_liquido), 0);
      const totalPago = active.filter(l => l.status === 'pago' && l.tipo === 'credito').reduce((s, l) => s + Number(l.valor_liquido), 0);

      // Build PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Venda Externa', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${format(new Date(dataInicio), 'dd/MM/yyyy')} a ${format(new Date(dataFim), 'dd/MM/yyyy')}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 34, { align: 'center' });

      // Dashboard cards as 2x2 grid table
      autoTable(doc, {
        startY: 42,
        head: [['Indicador', 'Valor']],
        body: [
          ['A Pagar (Créditos)', formatarMoeda(aPagar)],
          ['Antecipações em Aberto', formatarMoeda(antecipacoes)],
          ['Débitos Pendentes', formatarMoeda(debitosPendentes)],
          ['Total Pago no Período', formatarMoeda(totalPago)],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
        theme: 'grid',
      });

      let y = (doc as any).lastAutoTable.finalY + 12;

      // Per vendor sections
      for (const [vid, items] of Object.entries(byVendedor)) {
        if (y > 230) { doc.addPage(); y = 20; }

        const nome = nomeMap[vid] || 'Vendedor';
        const saldoIni = saldoInicial[vid] || 0;

        // Compute period totals for this vendor
        const vendorActive = items.filter((l: any) => l.status !== 'cancelado');
        const creditos = vendorActive.filter((l: any) => l.tipo === 'credito').reduce((s: number, l: any) => s + Number(l.valor_liquido), 0);
        const debitos = vendorActive.filter((l: any) => l.tipo === 'debito').reduce((s: number, l: any) => s + Number(l.valor_liquido), 0);
        const saldoFinal = saldoIni + creditos - debitos;
        const vendorPago = vendorActive.filter((l: any) => l.status === 'pago' && l.tipo === 'credito').reduce((s: number, l: any) => s + Number(l.valor_liquido), 0);

        // Vendor header
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(nome, 14, y); y += 6;

        // Balance summary row
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Saldo Inicial: ${formatarMoeda(saldoIni)}   |   Saldo Final: ${formatarMoeda(saldoFinal)}   |   Total Pago: ${formatarMoeda(vendorPago)}`, 14, y);
        y += 6;

        // Lancamentos table
        const tableData = items.map((l: any) => [
          format(new Date(l.data_lancamento), 'dd/MM/yy'),
          l.descricao.substring(0, 50),
          l.tipo === 'credito' ? 'Crédito' : 'Débito',
          formatarMoeda(l.valor_bruto),
          l.valor_abatimento > 0 ? formatarMoeda(l.valor_abatimento) : '—',
          formatarMoeda(l.valor_liquido),
          l.status,
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Data', 'Descrição', 'Tipo', 'Bruto', 'Abat.', 'Líquido', 'Status']],
          body: tableData,
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        });

        y = (doc as any).lastAutoTable.finalY + 12;
      }

      // Footer with page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
      }

      doc.save(`relatorio-venda-externa-${dataInicio}-a-${dataFim}.pdf`);
      toast.success('Relatório exportado com sucesso!');
      onClose();
    } catch (e) {
      toast.error('Erro ao gerar relatório: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Relatório</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data fim</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Vendedor</Label>
            <Select value={vendedorId} onValueChange={setVendedorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os vendedores</SelectItem>
                {vendedores.map(v => (
                  <SelectItem key={v.vendedor_id} value={v.vendedor_id}>{v.vendedor_nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleExportar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
