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

      // Group by vendor
      const byVendedor: Record<string, any[]> = {};
      lancamentos.forEach(l => {
        if (!byVendedor[l.vendedor_id]) byVendedor[l.vendedor_id] = [];
        byVendedor[l.vendedor_id].push(l);
      });

      const nomeMap: Record<string, string> = {};
      vendedores.forEach(v => { nomeMap[v.vendedor_id] = v.vendedor_nome; });

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(16);
      doc.text('Relatório de Venda Externa', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Período: ${format(new Date(dataInicio), 'dd/MM/yyyy')} a ${format(new Date(dataFim), 'dd/MM/yyyy')}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 34, { align: 'center' });

      let y = 44;

      // Global summary
      const totalCreditos = lancamentos.filter(l => l.tipo === 'credito' && l.status !== 'cancelado').reduce((s, l) => s + Number(l.valor_liquido), 0);
      const totalDebitos = lancamentos.filter(l => l.tipo === 'debito' && l.status !== 'cancelado').reduce((s, l) => s + Number(l.valor_liquido), 0);
      const totalPago = lancamentos.filter(l => l.status === 'pago' && l.tipo === 'credito').reduce((s, l) => s + Number(l.valor_liquido), 0);

      doc.setFontSize(12);
      doc.text('Resumo Geral', 14, y); y += 6;
      doc.setFontSize(9);
      doc.text(`Total Créditos: ${formatarMoeda(totalCreditos)}`, 14, y); y += 5;
      doc.text(`Total Débitos: ${formatarMoeda(totalDebitos)}`, 14, y); y += 5;
      doc.text(`Total Pago: ${formatarMoeda(totalPago)}`, 14, y); y += 10;

      // Per vendor
      for (const [vid, items] of Object.entries(byVendedor)) {
        if (y > 250) { doc.addPage(); y = 20; }

        const nome = nomeMap[vid] || 'Vendedor';
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(nome, 14, y); y += 6;
        doc.setFont('helvetica', 'normal');

        const tableData = items.map(l => [
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

        y = (doc as any).lastAutoTable.finalY + 10;
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
