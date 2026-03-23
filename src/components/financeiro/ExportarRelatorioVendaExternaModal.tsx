import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { formatarMoeda } from '@/utils/format';
import { toast } from 'sonner';
import { Loader2, FileDown, FileSpreadsheet } from 'lucide-react';

interface Vendedor { vendedor_id: string; vendedor_nome: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  vendedores: Vendedor[];
}

const ROLE_TIPO: Record<string, string> = {
  vendedor_externo: 'Vendedor',
  agencia: 'Agência',
  supervisor_vendas: 'Supervisor',
};

interface PlanoOption { id: string; nome: string; }

interface PlanoNivelRow {
  plano_nome: string;
  nivel: string;
  qtd: number;
  bruto: number;
  abatimento: number;
  liquido: number;
}

export function ExportarRelatorioVendaExternaModal({ open, onClose, vendedores }: Props) {
  // --- shared state ---
  const [dataInicio, setDataInicio] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));

  // --- aba beneficiário ---
  const [vendedorId, setVendedorId] = useState('todos');
  const [loading, setLoading] = useState(false);

  // --- aba plano ---
  const [planos, setPlanos] = useState<PlanoOption[]>([]);
  const [planoId, setPlanoId] = useState('todos');
  const [statusPlano, setStatusPlano] = useState('todos');
  const [loadingPlano, setLoadingPlano] = useState(false);

  // Fetch planos on open
  useEffect(() => {
    if (!open) return;
    supabase
      .from('planos')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setPlanos((data || []) as PlanoOption[]));
  }, [open]);

  // ===================== BENEFICIÁRIO (existing) =====================
  const handleExportarBeneficiario = async () => {
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

      const saldoInicial: Record<string, number> = {};
      lancamentosAntes.forEach(l => {
        if (!saldoInicial[l.vendedor_id]) saldoInicial[l.vendedor_id] = 0;
        const val = Number(l.valor_liquido);
        saldoInicial[l.vendedor_id] += l.tipo === 'credito' ? val : -val;
      });

      const byVendedor: Record<string, any[]> = {};
      lancamentos.forEach(l => {
        if (!byVendedor[l.vendedor_id]) byVendedor[l.vendedor_id] = [];
        byVendedor[l.vendedor_id].push(l);
      });

      const nomeMap: Record<string, string> = {};
      vendedores.forEach(v => { nomeMap[v.vendedor_id] = v.vendedor_nome; });

      const active = lancamentos.filter(l => l.status !== 'cancelado');
      const aPagar = active.filter(l => l.status === 'a_pagar' && l.tipo === 'credito').reduce((s, l) => s + Number(l.valor_liquido), 0);
      const antecipacoes = active.filter(l => l.status === 'antecipado').reduce((s, l) => s + Number(l.valor_liquido), 0);
      const debitosPendentes = active.filter(l => l.status === 'em_abatimento' && l.tipo === 'debito').reduce((s, l) => s + Number(l.valor_liquido), 0);
      const totalPago = active.filter(l => l.status === 'pago' && l.tipo === 'credito').reduce((s, l) => s + Number(l.valor_liquido), 0);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Venda Externa', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${format(new Date(dataInicio), 'dd/MM/yyyy')} a ${format(new Date(dataFim), 'dd/MM/yyyy')}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 34, { align: 'center' });

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

      for (const [vid, items] of Object.entries(byVendedor)) {
        if (y > 230) { doc.addPage(); y = 20; }

        const nome = nomeMap[vid] || 'Vendedor';
        const saldoIni = saldoInicial[vid] || 0;

        const vendorActive = items.filter((l: any) => l.status !== 'cancelado');
        const creditos = vendorActive.filter((l: any) => l.tipo === 'credito').reduce((s: number, l: any) => s + Number(l.valor_liquido), 0);
        const debitos = vendorActive.filter((l: any) => l.tipo === 'debito').reduce((s: number, l: any) => s + Number(l.valor_liquido), 0);
        const saldoFinal = saldoIni + creditos - debitos;
        const vendorPago = vendorActive.filter((l: any) => l.status === 'pago' && l.tipo === 'credito').reduce((s: number, l: any) => s + Number(l.valor_liquido), 0);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(nome, 14, y); y += 6;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Saldo Inicial: ${formatarMoeda(saldoIni)}   |   Saldo Final: ${formatarMoeda(saldoFinal)}   |   Total Pago: ${formatarMoeda(vendorPago)}`, 14, y);
        y += 6;

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

  // ===================== POR PLANO — data fetch =====================
  const fetchDadosPorPlano = async (): Promise<PlanoNivelRow[]> => {
    // 1) Fetch credit lancamentos in period
    let query = (supabase as any)
      .from('cc_vendedor_lancamentos')
      .select('id, vendedor_id, associado_id, valor_bruto, valor_abatimento, valor_liquido, status')
      .eq('tipo', 'credito')
      .gte('data_lancamento', dataInicio)
      .lte('data_lancamento', dataFim);

    if (statusPlano === 'a_pagar') query = query.eq('status', 'a_pagar');
    else if (statusPlano === 'pago') query = query.eq('status', 'pago');
    else query = query.neq('status', 'cancelado');

    const { data: lancamentos, error } = await query;
    if (error) throw error;
    if (!lancamentos || lancamentos.length === 0) return [];

    // 2) Get unique associado_ids and vendedor_ids
    const assocIds = [...new Set(lancamentos.map((l: any) => l.associado_id).filter(Boolean))] as string[];
    const vendedorIds = [...new Set(lancamentos.map((l: any) => l.vendedor_id).filter(Boolean))] as string[];

    // 3) Fetch associado → plano_id
    const assocPlanoMap: Record<string, string> = {};
    if (assocIds.length > 0) {
      // Batch in chunks of 500
      for (let i = 0; i < assocIds.length; i += 500) {
        const chunk = assocIds.slice(i, i + 500);
        const { data: assocs } = await supabase
          .from('associados')
          .select('id, plano_id')
          .in('id', chunk);
        (assocs || []).forEach((a: any) => { if (a.plano_id) assocPlanoMap[a.id] = a.plano_id; });
      }
    }

    // Filter by selected plano if needed
    if (planoId !== 'todos') {
      const validAssocs = new Set(Object.entries(assocPlanoMap).filter(([, pid]) => pid === planoId).map(([aid]) => aid));
      // Remove lancamentos not matching
      const filtered = lancamentos.filter((l: any) => validAssocs.has(l.associado_id));
      if (filtered.length === 0) return [];
      lancamentos.length = 0;
      lancamentos.push(...filtered);
    }

    // 4) Fetch plano names
    const planoIds = [...new Set(Object.values(assocPlanoMap))];
    const planoNomeMap: Record<string, string> = {};
    if (planoIds.length > 0) {
      const { data: planosData } = await supabase
        .from('planos')
        .select('id, nome')
        .in('id', planoIds);
      (planosData || []).forEach((p: any) => { planoNomeMap[p.id] = p.nome; });
    }

    // 5) Fetch vendedor roles via profiles → user_roles
    const vendedorNivelMap: Record<string, string> = {};
    if (vendedorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id')
        .in('id', vendedorIds);

      const userIdToProfileId: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        if (p.user_id) userIdToProfileId[p.user_id] = p.id;
      });

      const userIds = Object.keys(userIdToProfileId);
      if (userIds.length > 0) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);
        (roles || []).forEach((r: any) => {
          const profileId = userIdToProfileId[r.user_id];
          if (profileId && ROLE_TIPO[r.role]) {
            vendedorNivelMap[profileId] = ROLE_TIPO[r.role];
          }
        });
      }
    }

    // 6) Aggregate: plano_nome + nivel → totals
    const agg: Record<string, PlanoNivelRow> = {};
    (lancamentos as any[]).forEach((l: any) => {
      const plId = assocPlanoMap[l.associado_id];
      const plNome = plId ? (planoNomeMap[plId] || 'Sem plano') : 'Sem plano';
      const nivel = vendedorNivelMap[l.vendedor_id] || 'Outro';
      const key = `${plNome}|||${nivel}`;

      if (!agg[key]) {
        agg[key] = { plano_nome: plNome, nivel, qtd: 0, bruto: 0, abatimento: 0, liquido: 0 };
      }
      agg[key].qtd += 1;
      agg[key].bruto += Number(l.valor_bruto) || 0;
      agg[key].abatimento += Number(l.valor_abatimento) || 0;
      agg[key].liquido += Number(l.valor_liquido) || 0;
    });

    return Object.values(agg).sort((a, b) => a.plano_nome.localeCompare(b.plano_nome) || a.nivel.localeCompare(b.nivel));
  };

  // ===================== POR PLANO — PDF =====================
  const handleExportarPlanoPDF = async () => {
    setLoadingPlano(true);
    try {
      const rows = await fetchDadosPorPlano();
      if (rows.length === 0) {
        toast.info('Nenhum dado encontrado para os filtros selecionados.');
        setLoadingPlano(false);
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Comissões por Plano', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${format(new Date(dataInicio), 'dd/MM/yyyy')} a ${format(new Date(dataFim), 'dd/MM/yyyy')}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 34, { align: 'center' });

      // Group rows by plano
      const byPlano: Record<string, PlanoNivelRow[]> = {};
      rows.forEach(r => {
        if (!byPlano[r.plano_nome]) byPlano[r.plano_nome] = [];
        byPlano[r.plano_nome].push(r);
      });

      let y = 44;

      for (const [planoNome, niveis] of Object.entries(byPlano)) {
        if (y > 230) { doc.addPage(); y = 20; }

        const totalPlano = niveis.reduce((s, n) => s + n.liquido, 0);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${planoNome}  —  Total: ${formatarMoeda(totalPlano)}`, 14, y);
        y += 4;

        autoTable(doc, {
          startY: y,
          head: [['Nível', 'Qtd Comissões', 'Total Bruto', 'Total Abatimentos', 'Total Líquido']],
          body: niveis.map(n => [
            n.nivel,
            String(n.qtd),
            formatarMoeda(n.bruto),
            formatarMoeda(n.abatimento),
            formatarMoeda(n.liquido),
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [59, 130, 246] },
          columnStyles: {
            1: { halign: 'center' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
          },
          margin: { left: 14, right: 14 },
          theme: 'grid',
        });

        y = (doc as any).lastAutoTable.finalY + 12;
      }

      // Grand totals
      if (Object.keys(byPlano).length > 1) {
        if (y > 250) { doc.addPage(); y = 20; }
        const totals = rows.reduce(
          (acc, r) => ({ qtd: acc.qtd + r.qtd, bruto: acc.bruto + r.bruto, abatimento: acc.abatimento + r.abatimento, liquido: acc.liquido + r.liquido }),
          { qtd: 0, bruto: 0, abatimento: 0, liquido: 0 }
        );

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAIS GERAIS', 14, y);
        y += 4;

        autoTable(doc, {
          startY: y,
          head: [['', 'Qtd Comissões', 'Total Bruto', 'Total Abatimentos', 'Total Líquido']],
          body: [['Todos os Planos', String(totals.qtd), formatarMoeda(totals.bruto), formatarMoeda(totals.abatimento), formatarMoeda(totals.liquido)]],
          styles: { fontSize: 9, cellPadding: 3, fontStyle: 'bold' },
          headStyles: { fillColor: [34, 197, 94] },
          columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
          margin: { left: 14, right: 14 },
          theme: 'grid',
        });
      }

      // Page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
      }

      doc.save(`relatorio-comissoes-por-plano-${dataInicio}-a-${dataFim}.pdf`);
      toast.success('Relatório por plano exportado!');
      onClose();
    } catch (e) {
      toast.error('Erro ao gerar relatório: ' + (e as Error).message);
    } finally {
      setLoadingPlano(false);
    }
  };

  // ===================== POR PLANO — CSV =====================
  const handleExportarPlanoCSV = async () => {
    setLoadingPlano(true);
    try {
      const rows = await fetchDadosPorPlano();
      if (rows.length === 0) {
        toast.info('Nenhum dado encontrado para os filtros selecionados.');
        setLoadingPlano(false);
        return;
      }

      const header = 'Plano;Nível;Qtd Comissões;Bruto;Abatimento;Líquido';
      const lines = rows.map(r =>
        `${r.plano_nome};${r.nivel};${r.qtd};${r.bruto.toFixed(2).replace('.', ',')};${r.abatimento.toFixed(2).replace('.', ',')};${r.liquido.toFixed(2).replace('.', ',')}`
      );

      // Totals line
      const totals = rows.reduce(
        (acc, r) => ({ qtd: acc.qtd + r.qtd, bruto: acc.bruto + r.bruto, abatimento: acc.abatimento + r.abatimento, liquido: acc.liquido + r.liquido }),
        { qtd: 0, bruto: 0, abatimento: 0, liquido: 0 }
      );
      lines.push(`TOTAL;;${totals.qtd};${totals.bruto.toFixed(2).replace('.', ',')};${totals.abatimento.toFixed(2).replace('.', ',')};${totals.liquido.toFixed(2).replace('.', ',')}`);

      const bom = '\uFEFF';
      const csv = bom + [header, ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comissoes-por-plano-${dataInicio}-a-${dataFim}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('CSV exportado com sucesso!');
      onClose();
    } catch (e) {
      toast.error('Erro ao gerar CSV: ' + (e as Error).message);
    } finally {
      setLoadingPlano(false);
    }
  };

  // ===================== RENDER =====================
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar Relatório</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="beneficiario" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="beneficiario" className="flex-1">Por beneficiário</TabsTrigger>
            <TabsTrigger value="plano" className="flex-1">Por plano</TabsTrigger>
          </TabsList>

          {/* ========== ABA BENEFICIÁRIO ========== */}
          <TabsContent value="beneficiario">
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
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleExportarBeneficiario} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
                  Exportar PDF
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ========== ABA POR PLANO ========== */}
          <TabsContent value="plano">
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Plano</Label>
                  <Select value={planoId} onValueChange={setPlanoId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os planos</SelectItem>
                      {planos.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={statusPlano} onValueChange={setStatusPlano}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="a_pagar">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleExportarPlanoCSV} disabled={loadingPlano} variant="outline">
                  {loadingPlano ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                  Exportar CSV
                </Button>
                <Button onClick={handleExportarPlanoPDF} disabled={loadingPlano}>
                  {loadingPlano ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
                  Exportar PDF
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
