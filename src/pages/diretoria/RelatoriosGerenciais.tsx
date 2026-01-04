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
  Wrench
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LucideIcon } from 'lucide-react';

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
];

const categorias = {
  operacional: { label: 'Operacional', color: 'border-blue-500' },
  financeiro: { label: 'Financeiro', color: 'border-green-500' },
  sinistros: { label: 'Sinistros', color: 'border-red-500' },
  atuarial: { label: 'Atuarial', color: 'border-purple-500' },
};

export default function RelatoriosGerenciais() {
  const [selectedReport, setSelectedReport] = useState<ReportConfig | null>(null);
  const [reportFilters, setReportFilters] = useState({
    dataInicio: '',
    dataFim: '',
    formato: 'pdf'
  });

  const handleGerarRelatorio = () => {
    if (!reportFilters.dataInicio || !reportFilters.dataFim) {
      toast.error('Selecione o período do relatório');
      return;
    }

    toast.success(`Gerando relatório "${selectedReport?.titulo}" em ${reportFilters.formato.toUpperCase()}...`);
    setSelectedReport(null);
    setReportFilters({ dataInicio: '', dataFim: '', formato: 'pdf' });
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
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReport(null)}>
              Cancelar
            </Button>
            <Button onClick={handleGerarRelatorio}>
              <Download className="mr-2 h-4 w-4" />
              Gerar Relatório
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
