import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Loader2, FileDown, FileText, Table as TableIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getRelatorioConfig, RelatorioQueryConfig } from '@/config/relatoriosConfig';
import { format, subDays, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { DateRange } from 'react-day-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RelatorioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatorio: {
    id: string;
    nome: string;
    descricao: string;
  } | null;
}

export function RelatorioModal({ open, onOpenChange, relatorio }: RelatorioModalProps) {
  const [periodo, setPeriodo] = useState<'7d' | '30d' | 'mes' | 'custom'>('30d');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [gerado, setGerado] = useState(false);

  const config = relatorio ? getRelatorioConfig(relatorio.id) : null;

  const getDateRange = () => {
    const hoje = new Date();
    switch (periodo) {
      case '7d':
        return { from: subDays(hoje, 7), to: hoje };
      case '30d':
        return { from: subDays(hoje, 30), to: hoje };
      case 'mes':
        return { from: startOfMonth(hoje), to: hoje };
      case 'custom':
        return dateRange || { from: subDays(hoje, 30), to: hoje };
      default:
        return { from: subDays(hoje, 30), to: hoje };
    }
  };

  const { data: dados, isLoading, refetch } = useQuery({
    queryKey: ['relatorio-generico', relatorio?.id, periodo, dateRange],
    queryFn: async () => {
      if (!config) return [];

      const range = getDateRange();
      
      // Construir query dinamicamente baseado na tabela
      let query = (supabase.from(config.tabela as any) as any)
        .select(config.select);

      // Aplicar filtros de data se a tabela suportar
      const dateColumn = getDateColumn(config.tabela);
      if (dateColumn && range.from && range.to) {
        query = query
          .gte(dateColumn, range.from.toISOString())
          .lte(dateColumn, range.to.toISOString());
      }

      // Aplicar filtros específicos
      if (config.filtros) {
        Object.entries(config.filtros).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      // Ordenação
      if (config.orderBy) {
        query = query.order(config.orderBy, { ascending: false });
      }

      query = query.limit(500);

      const { data, error } = await query;
      if (error) {
        console.error('Erro ao buscar dados:', error);
        throw error;
      }

      return data || [];
    },
    enabled: false, // Não executar automaticamente
  });

  const getDateColumn = (tabela: string): string | null => {
    const mapping: Record<string, string> = {
      leads: 'created_at',
      cotacoes: 'created_at',
      contratos: 'created_at',
      cobrancas: 'data_vencimento',
      instalacoes: 'agendada_para',
      associados: 'created_at',
      veiculos: 'created_at',
      sinistros: 'data_ocorrencia',
      rastreadores: 'created_at',
      chamados_assistencia: 'data_abertura',
      indicadores_atuariais: 'created_at',
      lancamentos_caixa: 'data',
    };
    return mapping[tabela] || null;
  };

  const handleGerar = async () => {
    setGerado(true);
    await refetch();
  };

  const processarDadosParaTabela = (): any[][] => {
    if (!dados || !config) return [];

    return dados.map((item: any) => {
      // Criar linha baseada nos campos do select
      const campos = config.select.split(',').map(c => c.trim().split(':')[0]);
      return campos.map(campo => {
        const valor = item[campo];
        if (valor === null || valor === undefined) return '-';
        if (typeof valor === 'object') {
          // Relacionamento
          return valor.nome || valor.numero || JSON.stringify(valor);
        }
        if (campo.includes('data') || campo.includes('_at') || campo.includes('_em')) {
          try {
            return format(new Date(valor), 'dd/MM/yyyy', { locale: ptBR });
          } catch {
            return valor;
          }
        }
        if (campo.includes('valor')) {
          return `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }
        return String(valor);
      });
    });
  };

  const handleExportarPDF = () => {
    if (!dados || !config) {
      toast.error('Gere o relatório primeiro');
      return;
    }

    const doc = new jsPDF();
    const range = getDateRange();
    
    // Título
    doc.setFontSize(16);
    doc.text(config.titulo, 14, 20);
    
    // Subtítulo com período
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Período: ${range.from ? format(range.from, 'dd/MM/yyyy', { locale: ptBR }) : ''} - ${range.to ? format(range.to, 'dd/MM/yyyy', { locale: ptBR }) : ''}`,
      14, 28
    );
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 34);
    doc.text(`Total de registros: ${dados.length}`, 14, 40);

    // Tabela
    const linhas = processarDadosParaTabela();
    
    if (linhas.length > 0) {
      autoTable(doc, {
        startY: 48,
        head: [config.cabecalhos],
        body: linhas.slice(0, 100), // Limitar a 100 linhas no PDF
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    } else {
      doc.text('Nenhum registro encontrado no período selecionado.', 14, 50);
    }

    doc.save(`${config.id}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  const handleExportarExcel = () => {
    if (!dados || !config) {
      toast.error('Gere o relatório primeiro');
      return;
    }

    const linhas = processarDadosParaTabela();
    const wsData = [config.cabecalhos, ...linhas];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    
    XLSX.writeFile(wb, `${config.id}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel exportado com sucesso!');
  };

  if (!relatorio) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {relatorio.nome}
          </DialogTitle>
          <DialogDescription>
            {config?.descricao || relatorio.descricao}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filtros */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={periodo} onValueChange={(v: any) => setPeriodo(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="mes">Este mês</SelectItem>
                  <SelectItem value="custom">Período personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodo === 'custom' && (
              <div className="space-y-2">
                <Label>Intervalo de Datas</Label>
                <DatePickerWithRange
                  date={dateRange}
                  onDateChange={setDateRange}
                />
              </div>
            )}
          </div>

          {/* Botão Gerar */}
          <div className="flex gap-3">
            <Button onClick={handleGerar} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <TableIcon className="mr-2 h-4 w-4" />
                  Gerar Relatório
                </>
              )}
            </Button>

            {gerado && dados && dados.length > 0 && (
              <>
                <Button variant="outline" onClick={handleExportarPDF}>
                  <FileDown className="mr-2 h-4 w-4" />
                  PDF
                </Button>
                <Button variant="outline" onClick={handleExportarExcel}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Excel
                </Button>
              </>
            )}
          </div>

          {/* Prévia dos Dados */}
          {gerado && (
            <div className="rounded-lg border">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : dados && dados.length > 0 ? (
                <>
                  <div className="px-4 py-3 border-b bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      {dados.length} registro(s) encontrado(s)
                    </p>
                  </div>
                  <div className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {config?.cabecalhos.map((cab, i) => (
                            <TableHead key={i}>{cab}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processarDadosParaTabela().slice(0, 50).map((linha, i) => (
                          <TableRow key={i}>
                            {linha.map((cel: any, j: number) => (
                              <TableCell key={j} className="text-sm">
                                {cel}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {dados.length > 50 && (
                    <div className="px-4 py-2 border-t bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">
                        Exibindo 50 de {dados.length} registros. Exporte para ver todos.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <TableIcon className="h-12 w-12 mb-4 opacity-30" />
                  <p>Nenhum registro encontrado no período selecionado.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
