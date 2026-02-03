import { useState } from 'react';
import { 
  FileText, 
  Download, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  DollarSign, 
  Users, 
  AlertTriangle, 
  Calculator,
  Wrench,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface ReportConfig {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  icon: LucideIcon;
}

const relatorios: ReportConfig[] = [
  // OPERACIONAL
  { 
    id: 'associados-status', 
    categoria: 'operacional',
    titulo: 'Associados por Status', 
    descricao: 'Distribuição de associados por status',
    icon: Users
  },
  { 
    id: 'vendas-periodo', 
    categoria: 'operacional',
    titulo: 'Vendas por Período', 
    descricao: 'Leads, conversões e receita',
    icon: TrendingUp
  },
  { 
    id: 'instalacoes', 
    categoria: 'operacional',
    titulo: 'Instalações', 
    descricao: 'Instalações realizadas por período',
    icon: Wrench
  },
  // FINANCEIRO
  { 
    id: 'receitas-despesas', 
    categoria: 'financeiro',
    titulo: 'Receitas x Despesas', 
    descricao: 'DRE simplificado',
    icon: DollarSign
  },
  { 
    id: 'inadimplencia', 
    categoria: 'financeiro',
    titulo: 'Inadimplência', 
    descricao: 'Associados inadimplentes por faixa',
    icon: AlertTriangle
  },
  { 
    id: 'rateio-mensal', 
    categoria: 'financeiro',
    titulo: 'Rateio Mensal', 
    descricao: 'Histórico de rateios',
    icon: PieChart
  },
  // SINISTROS
  { 
    id: 'sinistralidade', 
    categoria: 'sinistros',
    titulo: 'Sinistralidade', 
    descricao: 'Evolução da sinistralidade',
    icon: TrendingUp
  },
  { 
    id: 'sinistros-tipo', 
    categoria: 'sinistros',
    titulo: 'Sinistros por Tipo', 
    descricao: 'Distribuição por tipo de sinistro',
    icon: PieChart
  },
  { 
    id: 'oficinas', 
    categoria: 'sinistros',
    titulo: 'Oficinas', 
    descricao: 'Ordens de serviço por oficina',
    icon: Wrench
  },
  // ATUARIAL
  { 
    id: 'indicadores-mensais', 
    categoria: 'atuarial',
    titulo: 'Indicadores Mensais', 
    descricao: 'Todos indicadores do período',
    icon: BarChart3
  },
  { 
    id: 'projecao-resultados', 
    categoria: 'atuarial',
    titulo: 'Projeção de Resultados', 
    descricao: 'Projeção para próximos meses',
    icon: Calculator
  },
  { 
    id: 'custos-reparos', 
    categoria: 'atuarial',
    titulo: 'Custos de Reparos por Categoria', 
    descricao: 'Peças, Mão de Obra e Serviços Terceiros',
    icon: Wrench
  },
];

const categorias = {
  operacional: { label: 'Operacional', color: 'border-blue-500' },
  financeiro: { label: 'Financeiro', color: 'border-green-500' },
  sinistros: { label: 'Sinistros', color: 'border-red-500' },
  atuarial: { label: 'Atuarial', color: 'border-purple-500' },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function RelatoriosGerenciais() {
  const [selectedReport, setSelectedReport] = useState<ReportConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    dataInicio: '',
    dataFim: '',
    formato: 'pdf'
  });

  const gerarPDF = (titulo: string, cabecalhos: string[], dados: string[][], extras?: { subtitulo?: string }) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(titulo, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${reportFilters.dataInicio} a ${reportFilters.dataFim}`, 14, 30);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 36);
    
    if (extras?.subtitulo) {
      doc.text(extras.subtitulo, 14, 42);
    }
    
    autoTable(doc, {
      startY: extras?.subtitulo ? 48 : 42,
      head: [cabecalhos],
      body: dados,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    doc.save(`${titulo.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const gerarCSV = (cabecalhos: string[], dados: string[][]) => {
    const csv = [
      cabecalhos.join(';'),
      ...dados.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedReport?.titulo.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGerarRelatorio = async () => {
    if (!reportFilters.dataInicio || !reportFilters.dataFim) {
      toast.error('Selecione o período do relatório');
      return;
    }

    setIsGenerating(true);

    try {
      let cabecalhos: string[] = [];
      let dados: string[][] = [];
      let extras: { subtitulo?: string } = {};

      switch (selectedReport?.id) {
        case 'associados-status': {
          const { data } = await supabase
            .from('associados')
            .select('status')
            .gte('created_at', reportFilters.dataInicio)
            .lte('created_at', reportFilters.dataFim + 'T23:59:59');
          
          const agrupado: Record<string, number> = {};
          data?.forEach(a => {
            agrupado[a.status] = (agrupado[a.status] || 0) + 1;
          });
          
          cabecalhos = ['Status', 'Quantidade', '%'];
          const total = Object.values(agrupado).reduce((s, v) => s + v, 0);
          dados = Object.entries(agrupado).map(([status, qtd]) => [
            status,
            qtd.toString(),
            total > 0 ? `${((qtd / total) * 100).toFixed(1)}%` : '0%'
          ]);
          break;
        }
        
        case 'vendas-periodo': {
          const { data: leads } = await supabase
            .from('leads')
            .select('etapa, created_at')
            .gte('created_at', reportFilters.dataInicio)
            .lte('created_at', reportFilters.dataFim + 'T23:59:59');
          
          const { data: conversoes } = await supabase
            .from('leads')
            .select('*')
            .eq('etapa', 'ganho')
            .gte('updated_at', reportFilters.dataInicio)
            .lte('updated_at', reportFilters.dataFim + 'T23:59:59');
          
          cabecalhos = ['Métrica', 'Valor'];
          dados = [
            ['Total de Leads', (leads?.length || 0).toString()],
            ['Conversões', (conversoes?.length || 0).toString()],
            ['Taxa de Conversão', leads?.length ? `${((conversoes?.length || 0) / leads.length * 100).toFixed(1)}%` : '0%'],
          ];
          break;
        }
        
        case 'instalacoes': {
          const { data } = await supabase
            .from('instalacoes')
            .select('status, created_at')
            .gte('created_at', reportFilters.dataInicio)
            .lte('created_at', reportFilters.dataFim + 'T23:59:59');
          
          const agrupado: Record<string, number> = {};
          data?.forEach(i => {
            agrupado[i.status] = (agrupado[i.status] || 0) + 1;
          });
          
          cabecalhos = ['Status', 'Quantidade'];
          dados = Object.entries(agrupado).map(([status, qtd]) => [status, qtd.toString()]);
          break;
        }
        
        case 'receitas-despesas': {
          const { data: receitas } = await supabase
            .from('cobrancas')
            .select('valor_pago')
            .eq('status', 'pago')
            .gte('data_pagamento', reportFilters.dataInicio)
            .lte('data_pagamento', reportFilters.dataFim);
          
          const { data: sinistros } = await supabase
            .from('sinistros')
            .select('valor_indenizacao')
            .in('status', ['aprovado', 'indenizado', 'pago'])
            .gte('data_ocorrencia', reportFilters.dataInicio)
            .lte('data_ocorrencia', reportFilters.dataFim);
          
          const totalReceitas = receitas?.reduce((s, r) => s + (r.valor_pago || 0), 0) || 0;
          const totalSinistros = sinistros?.reduce((s, r) => s + (r.valor_indenizacao || 0), 0) || 0;
          
          cabecalhos = ['Descrição', 'Valor'];
          dados = [
            ['Receita Total', formatCurrency(totalReceitas)],
            ['Despesas com Sinistros', formatCurrency(totalSinistros)],
            ['Resultado', formatCurrency(totalReceitas - totalSinistros)],
            ['Margem', totalReceitas > 0 ? `${(((totalReceitas - totalSinistros) / totalReceitas) * 100).toFixed(1)}%` : '0%'],
          ];
          break;
        }
        
        case 'inadimplencia': {
          const { data } = await supabase
            .from('cobrancas')
            .select('data_vencimento, valor_final, associado:associados(nome)')
            .eq('status', 'vencido')
            .gte('data_vencimento', reportFilters.dataInicio)
            .lte('data_vencimento', reportFilters.dataFim);
          
          cabecalhos = ['Associado', 'Vencimento', 'Valor'];
          dados = (data || []).map(c => [
            (c.associado as any)?.nome || 'N/A',
            c.data_vencimento,
            formatCurrency(c.valor_final || 0)
          ]);
          
          const total = data?.reduce((s, c) => s + (c.valor_final || 0), 0) || 0;
          extras.subtitulo = `Total em atraso: ${formatCurrency(total)}`;
          break;
        }
        
        case 'sinistralidade': {
          const { data } = await supabase
            .from('indicadores_atuariais')
            .select('mes, ano, sinistralidade_bruta, receita_bruta, despesas_sinistros')
            .gte('ano', parseInt(reportFilters.dataInicio.slice(0, 4)))
            .lte('ano', parseInt(reportFilters.dataFim.slice(0, 4)))
            .order('ano')
            .order('mes');
          
          cabecalhos = ['Mês/Ano', 'Sinistralidade', 'Receita', 'Sinistros'];
          dados = (data || []).map(i => [
            `${i.mes}/${i.ano}`,
            `${(i.sinistralidade_bruta || 0).toFixed(1)}%`,
            formatCurrency(i.receita_bruta || 0),
            formatCurrency(i.despesas_sinistros || 0)
          ]);
          break;
        }
        
        case 'sinistros-tipo': {
          const { data } = await supabase
            .from('sinistros')
            .select('tipo')
            .gte('data_ocorrencia', reportFilters.dataInicio)
            .lte('data_ocorrencia', reportFilters.dataFim);
          
          const agrupado: Record<string, number> = {};
          data?.forEach(s => {
            agrupado[s.tipo || 'Não especificado'] = (agrupado[s.tipo || 'Não especificado'] || 0) + 1;
          });
          
          cabecalhos = ['Tipo', 'Quantidade', '%'];
          const total = Object.values(agrupado).reduce((s, v) => s + v, 0);
          dados = Object.entries(agrupado).map(([tipo, qtd]) => [
            tipo,
            qtd.toString(),
            total > 0 ? `${((qtd / total) * 100).toFixed(1)}%` : '0%'
          ]);
          break;
        }
        
        case 'oficinas': {
          const { data } = await supabase
            .from('ordens_servico')
            .select('status, oficina:oficinas(nome)')
            .gte('created_at', reportFilters.dataInicio)
            .lte('created_at', reportFilters.dataFim + 'T23:59:59');
          
          const agrupado: Record<string, number> = {};
          data?.forEach(os => {
            const nome = (os.oficina as any)?.nome || 'Sem oficina';
            agrupado[nome] = (agrupado[nome] || 0) + 1;
          });
          
          cabecalhos = ['Oficina', 'Ordens de Serviço'];
          dados = Object.entries(agrupado).map(([oficina, qtd]) => [oficina, qtd.toString()]);
          break;
        }
        
        case 'indicadores-mensais': {
          const { data } = await supabase
            .from('indicadores_atuariais')
            .select('*')
            .gte('ano', parseInt(reportFilters.dataInicio.slice(0, 4)))
            .lte('ano', parseInt(reportFilters.dataFim.slice(0, 4)))
            .order('ano')
            .order('mes');
          
          cabecalhos = ['Período', 'Receita', 'Sinistros', 'Margem', 'Novos', 'Cancelamentos'];
          dados = (data || []).map(i => [
            `${i.mes}/${i.ano}`,
            formatCurrency(i.receita_bruta || 0),
            formatCurrency(i.despesas_sinistros || 0),
            `${(i.margem_operacional || 0).toFixed(1)}%`,
            (i.novos_associados || 0).toString(),
            (i.cancelamentos || 0).toString()
          ]);
          break;
        }
        
        case 'rateio-mensal': {
          const { data } = await supabase
            .from('rateios')
            .select('*')
            .gte('created_at', reportFilters.dataInicio)
            .lte('created_at', reportFilters.dataFim + 'T23:59:59')
            .order('ano', { ascending: false })
            .order('mes', { ascending: false });
          
          cabecalhos = ['Código', 'Mês/Ano', 'Valor Sinistros', 'Status'];
          dados = (data || []).map(r => [
            r.codigo || '',
            `${r.mes}/${r.ano}`,
            formatCurrency(r.valor_total_sinistros || 0),
            r.status || ''
          ]);
          break;
        }
        
        case 'projecao-resultados': {
          // Buscar últimos 6 meses para projeção
          const { data } = await supabase
            .from('indicadores_atuariais')
            .select('*')
            .order('ano', { ascending: false })
            .order('mes', { ascending: false })
            .limit(6);
          
          const mediaReceita = data?.reduce((s, d) => s + (d.receita_bruta || 0), 0) / (data?.length || 1);
          const mediaSinistros = data?.reduce((s, d) => s + (d.despesas_sinistros || 0), 0) / (data?.length || 1);
          
          cabecalhos = ['Projeção', 'Valor Médio (6 meses)', 'Projeção Anual'];
          dados = [
            ['Receita', formatCurrency(mediaReceita), formatCurrency(mediaReceita * 12)],
            ['Sinistros', formatCurrency(mediaSinistros), formatCurrency(mediaSinistros * 12)],
            ['Resultado', formatCurrency(mediaReceita - mediaSinistros), formatCurrency((mediaReceita - mediaSinistros) * 12)],
          ];
          break;
        }
        
        case 'custos-reparos': {
          // Buscar itens de OS vinculadas a sinistros do período
          const { data: itens } = await supabase
            .from('ordens_servico_itens')
            .select(`
              tipo,
              valor_total,
              ordem_servico:ordens_servico!inner(
                sinistro_id,
                status,
                created_at
              )
            `)
            .gte('ordem_servico.created_at', reportFilters.dataInicio)
            .lte('ordem_servico.created_at', reportFilters.dataFim + 'T23:59:59');

          // Filtrar e agrupar por tipo
          const agrupado: Record<string, number> = { 
            peca: 0, 
            mao_de_obra: 0, 
            servico_terceiro: 0 
          };
          
          itens?.forEach(item => {
            const os = item.ordem_servico as any;
            if (os && ['concluido', 'pago', 'aprovado'].includes(os.status) && os.sinistro_id) {
              const tipo = item.tipo as string;
              if (agrupado.hasOwnProperty(tipo)) {
                agrupado[tipo] += item.valor_total || 0;
              }
            }
          });

          const total = Object.values(agrupado).reduce((s, v) => s + v, 0);

          cabecalhos = ['Categoria', 'Valor', '% Total'];
          dados = [
            ['Peças', formatCurrency(agrupado.peca), total > 0 ? `${((agrupado.peca / total) * 100).toFixed(1)}%` : '0%'],
            ['Mão de Obra', formatCurrency(agrupado.mao_de_obra), total > 0 ? `${((agrupado.mao_de_obra / total) * 100).toFixed(1)}%` : '0%'],
            ['Serviços Terceiros', formatCurrency(agrupado.servico_terceiro), total > 0 ? `${((agrupado.servico_terceiro / total) * 100).toFixed(1)}%` : '0%'],
            ['TOTAL', formatCurrency(total), '100%'],
          ];
          extras.subtitulo = 'Análise Atuarial de Custos de Oficinas';
          break;
        }
        
        default:
          toast.error('Relatório não implementado');
          return;
      }

      if (dados.length === 0) {
        toast.warning('Nenhum dado encontrado para o período selecionado');
        setIsGenerating(false);
        return;
      }

      if (reportFilters.formato === 'pdf') {
        gerarPDF(selectedReport?.titulo || 'Relatório', cabecalhos, dados, extras);
      } else {
        gerarCSV(cabecalhos, dados);
      }

      toast.success(`Relatório "${selectedReport?.titulo}" gerado com sucesso!`);
      setSelectedReport(null);
      setReportFilters({ dataInicio: '', dataFim: '', formato: 'pdf' });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setIsGenerating(false);
    }
  };

  const groupedReports = Object.entries(categorias).map(([key, config]) => ({
    categoria: key,
    ...config,
    reports: relatorios.filter(r => r.categoria === key)
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios Gerenciais</h1>
        <p className="text-muted-foreground">Gere relatórios consolidados por área</p>
      </div>

      {groupedReports.map(({ categoria, label, color, reports }) => (
        <div key={categoria} className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className={`w-1 h-6 rounded ${color.replace('border-', 'bg-')}`} />
            {label}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => (
              <Card key={report.id} className={`hover:shadow-md transition-shadow border-l-4 ${color}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-lg bg-muted">
                      <report.icon className="h-5 w-5" />
                    </div>
                  </div>
                  <CardTitle className="text-base">{report.titulo}</CardTitle>
                  <CardDescription>{report.descricao}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => setSelectedReport(report)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Gerar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Modal de Geração */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedReport && <selectedReport.icon className="h-5 w-5" />}
              {selectedReport?.titulo}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={reportFilters.dataInicio}
                  onChange={(e) => setReportFilters(f => ({ ...f, dataInicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={reportFilters.dataFim}
                  onChange={(e) => setReportFilters(f => ({ ...f, dataFim: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Formato</Label>
              <Select 
                value={reportFilters.formato} 
                onValueChange={(value) => setReportFilters(f => ({ ...f, formato: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReport(null)} disabled={isGenerating}>
              Cancelar
            </Button>
            <Button onClick={handleGerarRelatorio} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Gerar Relatório
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
