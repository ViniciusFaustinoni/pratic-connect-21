import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  AlertTriangle,
  Target,
  PieChart,
  BarChart3,
  Settings,
  FileText,
  Percent,
  Activity,
  Wrench,
  Phone,
  ShieldCheck,
  ArrowRight,
  Navigation,
  Timer,
  Radio,
  Bot,
  Globe,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useMetricasTempo } from '@/hooks/useMetricasTempo';
import { useRastreadoresPorPortador } from '@/hooks/useRastreadoresPorPortador';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { toast } from 'sonner';

type Periodo = 'mes' | 'trimestre' | 'ano';

const CORES_GRAFICO = {
  receita: '#22c55e',
  sinistros: '#ef4444',
  resultado: '#3b82f6',
};

const CORES_PIE = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function DiretoriaDashboard() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  
  // Hook de métricas de tempo
  const { data: metricasTempo, isLoading: loadingMetricasTempo } = useMetricasTempo();
  
  // Hook de rastreadores por portador
  const { data: rastreadoresPortador, isLoading: loadingRastreadoresPortador } = useRastreadoresPorPortador();

  // Calcular datas baseado no período
  const getDataInicio = () => {
    const hoje = new Date();
    switch (periodo) {
      case 'mes':
        return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      case 'trimestre':
        const mesAtual = hoje.getMonth();
        const inicioTrimestre = mesAtual - (mesAtual % 3);
        return new Date(hoje.getFullYear(), inicioTrimestre, 1);
      case 'ano':
        return new Date(hoje.getFullYear(), 0, 1);
      default:
        return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    }
  };

  // Query principal de stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['diretoria-stats', periodo],
    queryFn: async () => {
      const inicioMes = getDataInicio();

      const [associados, inadimplentes, totalAssociados, leads, conversoes, receita, sinistros] =
        await Promise.all([
          supabase.from('associados').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
          supabase.from('associados').select('*', { count: 'exact', head: true }).eq('status', 'inadimplente'),
          supabase.from('associados').select('*', { count: 'exact', head: true }),
          supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', inicioMes.toISOString()),
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('etapa', 'ganho').gte('updated_at', inicioMes.toISOString()),
          supabase.from('cobrancas').select('valor_pago').eq('status', 'pago').gte('data_pagamento', inicioMes.toISOString().split('T')[0]),
          supabase.from('sinistros').select('valor_indenizacao').in('status', ['aprovado', 'indenizado', 'encerrado']).gte('data_ocorrencia', inicioMes.toISOString().split('T')[0]),
        ]);

      const receitaTotal = receita.data?.reduce((sum, p) => sum + (p.valor_pago || 0), 0) || 0;
      const sinistrosTotal = sinistros.data?.reduce((sum, s) => sum + (s.valor_indenizacao || 0), 0) || 0;
      const total = totalAssociados.count || 1;

      return {
        associadosAtivos: associados.count || 0,
        inadimplentes: inadimplentes.count || 0,
        taxaInadimplencia: total > 0 ? ((inadimplentes.count || 0) / total) * 100 : 0,
        leadsMes: leads.count || 0,
        conversoesMes: conversoes.count || 0,
        taxaConversao: (leads.count || 0) > 0 ? ((conversoes.count || 0) / (leads.count || 1)) * 100 : 0,
        receitaMes: receitaTotal,
        sinistrosMes: sinistrosTotal,
        sinistralidade: receitaTotal > 0 ? (sinistrosTotal / receitaTotal) * 100 : 0,
        resultado: receitaTotal - sinistrosTotal,
      };
    },
  });

  // Query de evolução mensal
  const { data: evolucao, isLoading: loadingEvolucao } = useQuery({
    queryKey: ['evolucao-mensal'],
    queryFn: async () => {
      const { data } = await supabase
        .from('indicadores_atuariais')
        .select('*')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(12);

      return (data || []).reverse().map((item) => ({
        periodo: `${item.mes}/${item.ano}`,
        receita: item.receita_bruta || 0,
        sinistros: item.despesas_sinistros || 0,
        resultado: item.resultado_operacional || 0,
      }));
    },
  });

  // Query de indicadores operacionais
  const { data: operacionais, isLoading: loadingOperacionais } = useQuery({
    queryKey: ['indicadores-operacionais', periodo],
    queryFn: async () => {
      const inicioMes = getDataInicio();

      const [instalacoes, assistencias] = await Promise.all([
        supabase
          .from('instalacoes')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'concluida')
          .gte('updated_at', inicioMes.toISOString()),
        supabase
          .from('chamados_assistencia')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', inicioMes.toISOString()),
      ]);

      return {
        instalacoes: instalacoes.count || 0,
        assistencias: assistencias.count || 0,
      };
    },
  });

  // Query de distribuição por plano
  const { data: distribuicao, isLoading: loadingDistribuicao } = useQuery({
    queryKey: ['distribuicao-planos'],
    queryFn: async () => {
      const { data: associados } = await supabase
        .from('associados')
        .select('plano_id, planos(nome)')
        .eq('status', 'ativo');

      if (!associados) return [];

      const agrupado: Record<string, number> = {};
      associados.forEach((a) => {
        const nome = (a.planos as any)?.nome || 'Sem plano';
        agrupado[nome] = (agrupado[nome] || 0) + 1;
      });

      return Object.entries(agrupado)
        .map(([nome, value]) => ({ nome, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    },
  });

  // Query do indicador atual (para fundo de reserva)
  const { data: indicadorAtual } = useQuery({
    queryKey: ['indicador-atual'],
    queryFn: async () => {
      const mesAtual = new Date();
      const { data } = await supabase
        .from('indicadores_atuariais')
        .select('*')
        .eq('ano', mesAtual.getFullYear())
        .eq('mes', mesAtual.getMonth() + 1)
        .maybeSingle();
      return data;
    },
  });

  // Query do rateio atual
  const { data: rateioAtual, isLoading: loadingRateio } = useQuery({
    queryKey: ['rateio-atual-dashboard'],
    queryFn: async () => {
      const hoje = new Date();
      const { data } = await supabase
        .from('rateios')
        .select('*')
        .eq('ano', hoje.getFullYear())
        .eq('mes', hoje.getMonth() + 1)
        .maybeSingle();
      return data;
    },
  });

  // Helpers
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getSinistColorClass = (value: number) => {
    if (value < 65) return 'bg-success';
    if (value < 70) return 'bg-warning';
    return 'bg-destructive';
  };

  // Alertas
  const alertas = [];
  if (stats && stats.sinistralidade > 70) {
    alertas.push({
      type: 'destructive' as const,
      title: 'Sinistralidade Alta',
      message: `A sinistralidade está em ${stats.sinistralidade.toFixed(1)}%, acima do limite de 70%.`,
    });
  }
  if (stats && stats.taxaInadimplencia > 10) {
    alertas.push({
      type: 'destructive' as const,
      title: 'Alta Inadimplência',
      message: `A taxa de inadimplência está em ${stats.taxaInadimplencia.toFixed(1)}%.`,
    });
  }
  if (indicadorAtual && (indicadorAtual.cobertura_sinistros_meses || 0) < 3) {
    alertas.push({
      type: 'warning' as const,
      title: 'Fundo de Reserva Baixo',
      message: `O fundo cobre apenas ${indicadorAtual.cobertura_sinistros_meses?.toFixed(1)} meses de sinistros.`,
    });
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Executivo</h1>
          <p className="text-muted-foreground">Visão consolidada da associação</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Mês Atual</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="ano">Ano</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline"
            onClick={() => {
              if (!stats) {
                toast.error('Aguarde os dados carregarem');
                return;
              }
              
              const doc = new jsPDF();
              doc.setFontSize(18);
              doc.text('Dashboard Executivo', 14, 22);
              
              doc.setFontSize(10);
              doc.setTextColor(100);
              doc.text(`Período: ${periodo === 'mes' ? 'Mês Atual' : periodo === 'trimestre' ? 'Trimestre' : 'Ano'}`, 14, 32);
              doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 38);
              
              // KPIs
              const kpis = [
                ['Associados Ativos', stats.associadosAtivos.toLocaleString()],
                ['Receita', formatCurrency(stats.receitaMes)],
                ['Sinistralidade', `${stats.sinistralidade.toFixed(1)}%`],
                ['Taxa Conversão', `${stats.taxaConversao.toFixed(1)}%`],
                ['Inadimplência', `${stats.taxaInadimplencia.toFixed(1)}%`],
                ['Resultado', formatCurrency(stats.resultado)],
              ];
              
              autoTable(doc, {
                startY: 45,
                head: [['Indicador', 'Valor']],
                body: kpis,
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246] },
              });
              
              // Helper para pegar Y final da última tabela
              const getY = () => (doc as any).lastAutoTable?.finalY || 90;

              // Evolução mensal
              if (evolucao && evolucao.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text('Evolução Mensal', 14, getY() + 15);
                autoTable(doc, {
                  startY: getY() + 20,
                  head: [['Período', 'Receita', 'Sinistros', 'Resultado']],
                  body: evolucao.map(e => [e.periodo, formatCurrency(e.receita), formatCurrency(e.sinistros), formatCurrency(e.resultado)]),
                  theme: 'striped',
                  headStyles: { fillColor: [59, 130, 246] },
                });
              }

              // Indicadores Operacionais
              if (operacionais) {
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text('Indicadores Operacionais', 14, getY() + 15);
                autoTable(doc, {
                  startY: getY() + 20,
                  head: [['Indicador', 'Quantidade']],
                  body: [
                    ['Instalações Concluídas', operacionais.instalacoes.toString()],
                    ['Chamados Assistência', operacionais.assistencias.toString()],
                  ],
                  theme: 'striped',
                  headStyles: { fillColor: [34, 197, 94] },
                });
              }

              // Distribuição por Plano
              if (distribuicao && distribuicao.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text('Distribuição por Plano', 14, getY() + 15);
                autoTable(doc, {
                  startY: getY() + 20,
                  head: [['Plano', 'Associados']],
                  body: distribuicao.map(d => [d.nome, d.value.toString()]),
                  theme: 'striped',
                  headStyles: { fillColor: [139, 92, 246] },
                });
              }

              // Rateio Atual
              if (rateioAtual) {
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text('Rateio Atual', 14, getY() + 15);
                autoTable(doc, {
                  startY: getY() + 20,
                  head: [['Campo', 'Valor']],
                  body: [
                    ['Status', (rateioAtual as any).status || '-'],
                    ['Valor da Cota', formatCurrency((rateioAtual as any).valor_cota || 0)],
                    ['Total Associados', ((rateioAtual as any).total_associados || 0).toString()],
                    ['Receita Bruta', formatCurrency((rateioAtual as any).receita_bruta || 0)],
                    ['Despesas Sinistros', formatCurrency((rateioAtual as any).despesas_sinistros || 0)],
                  ],
                  theme: 'striped',
                  headStyles: { fillColor: [245, 158, 11] },
                });
              }

              // Métricas de Tempo
              if (metricasTempo) {
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text('Métricas de Tempo', 14, getY() + 15);
                const metricsBody: string[][] = [
                  ['Tempo Médio Trânsito', metricasTempo.tempoMedioTransitoFormatado],
                  ['Tempo Médio Execução', metricasTempo.tempoMedioExecucaoFormatado],
                  ['Total Tarefas Analisadas', metricasTempo.totalTarefasAnalisadas.toString()],
                ];
                if (metricasTempo.porProfissional.length > 0) {
                  metricsBody.push(['', '']);
                  metricsBody.push(['--- Por Profissional ---', '']);
                  metricasTempo.porProfissional.forEach(p => {
                    metricsBody.push([p.nome, `Trânsito: ${Math.round(p.tempoMedioTransitoMin)}min | Execução: ${Math.round(p.tempoMedioExecucaoMin)}min | Tarefas: ${p.totalTarefas}`]);
                  });
                }
                autoTable(doc, {
                  startY: getY() + 20,
                  head: [['Métrica', 'Valor']],
                  body: metricsBody,
                  theme: 'striped',
                  headStyles: { fillColor: [6, 182, 212] },
                });
              }

              // Rastreadores por Portador
              if (rastreadoresPortador && rastreadoresPortador.porPortador.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text('Rastreadores por Portador', 14, getY() + 15);
                const rastBody: string[][] = rastreadoresPortador.porPortador.map(p => [p.nome, p.quantidade.toString()]);
                rastBody.push(['Sem Portador', rastreadoresPortador.semPortador.toString()]);
                rastBody.push(['Total em Porte', rastreadoresPortador.totalEmPorte.toString()]);
                autoTable(doc, {
                  startY: getY() + 20,
                  head: [['Portador', 'Quantidade']],
                  body: rastBody,
                  theme: 'striped',
                  headStyles: { fillColor: [236, 72, 153] },
                });
              }
              
              doc.save(`dashboard-executivo-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
              toast.success('Relatório exportado!');
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPI Cards - Primeira linha */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Associados Ativos</p>
              {loadingStats ? (
                <Skeleton className="mt-1 h-7 w-20" />
              ) : (
                <p className="text-2xl font-bold">{stats?.associadosAtivos.toLocaleString()}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-success/10 p-2">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Receita</p>
              {loadingStats ? (
                <Skeleton className="mt-1 h-7 w-24" />
              ) : (
                <p className="text-2xl font-bold">{formatCurrency(stats?.receitaMes || 0)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div
                className={`rounded-lg p-2 ${
                  (stats?.sinistralidade || 0) > 70 ? 'bg-destructive/10' : 'bg-warning/10'
                }`}
              >
                <Percent
                  className={`h-5 w-5 ${
                    (stats?.sinistralidade || 0) > 70 ? 'text-destructive' : 'text-warning'
                  }`}
                />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Sinistralidade</p>
              {loadingStats ? (
                <Skeleton className="mt-1 h-7 w-16" />
              ) : (
                <p className="text-2xl font-bold">{stats?.sinistralidade.toFixed(1)}%</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-info/10 p-2">
                <Target className="h-5 w-5 text-info" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Taxa Conversão</p>
              {loadingStats ? (
                <Skeleton className="mt-1 h-7 w-16" />
              ) : (
                <p className="text-2xl font-bold">{stats?.taxaConversao.toFixed(1)}%</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div
                className={`rounded-lg p-2 ${
                  (stats?.taxaInadimplencia || 0) > 10 ? 'bg-destructive/10' : 'bg-warning/10'
                }`}
              >
                <AlertTriangle
                  className={`h-5 w-5 ${
                    (stats?.taxaInadimplencia || 0) > 10 ? 'text-destructive' : 'text-warning'
                  }`}
                />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Inadimplência</p>
              {loadingStats ? (
                <Skeleton className="mt-1 h-7 w-16" />
              ) : (
                <p className="text-2xl font-bold">{stats?.taxaInadimplencia.toFixed(1)}%</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div
                className={`rounded-lg p-2 ${
                  (stats?.resultado || 0) >= 0 ? 'bg-success/10' : 'bg-destructive/10'
                }`}
              >
                {(stats?.resultado || 0) >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-success" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Resultado</p>
              {loadingStats ? (
                <Skeleton className="mt-1 h-7 w-24" />
              ) : (
                <p
                  className={`text-2xl font-bold ${
                    (stats?.resultado || 0) >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {formatCurrency(stats?.resultado || 0)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card Rateio Atual - NOVO */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-primary/10 p-2">
                <PieChart className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Rateio/Cota</p>
              {loadingRateio ? (
                <Skeleton className="mt-1 h-7 w-24" />
              ) : rateioAtual ? (
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(rateioAtual.valor_rateio_por_cota || rateioAtual.valor_rateio_por_associado || 0)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Sem rateio</p>
              )}
              {rateioAtual && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {rateioAtual.status}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna 1-2 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Evolução Mensal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Evolução Mensal
              </CardTitle>
              <CardDescription>Receita x Sinistros x Resultado (últimos 12 meses)</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEvolucao ? (
                <Skeleton className="h-[300px] w-full" />
              ) : evolucao && evolucao.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={evolucao}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="periodo" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="receita"
                      name="Receita"
                      stroke={CORES_GRAFICO.receita}
                      strokeWidth={2}
                      dot={{ fill: CORES_GRAFICO.receita }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sinistros"
                      name="Sinistros"
                      stroke={CORES_GRAFICO.sinistros}
                      strokeWidth={2}
                      dot={{ fill: CORES_GRAFICO.sinistros }}
                    />
                    <Line
                      type="monotone"
                      dataKey="resultado"
                      name="Resultado"
                      stroke={CORES_GRAFICO.resultado}
                      strokeWidth={2}
                      dot={{ fill: CORES_GRAFICO.resultado }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  Sem dados de indicadores atuariais cadastrados
                </div>
              )}
            </CardContent>
          </Card>

          {/* Indicadores Operacionais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Indicadores Operacionais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-info/10 p-2">
                      <Users className="h-4 w-4 text-info" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Leads Captados</p>
                      {loadingStats ? (
                        <Skeleton className="mt-1 h-6 w-12" />
                      ) : (
                        <p className="text-xl font-semibold">{stats?.leadsMes}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-success/10 p-2">
                      <Target className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Conversões</p>
                      {loadingStats ? (
                        <Skeleton className="mt-1 h-6 w-12" />
                      ) : (
                        <p className="text-xl font-semibold">
                          {stats?.conversoesMes}{' '}
                          <span className="text-sm text-muted-foreground">
                            ({stats?.taxaConversao.toFixed(0)}%)
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Wrench className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Instalações</p>
                      {loadingOperacionais ? (
                        <Skeleton className="mt-1 h-6 w-12" />
                      ) : (
                        <p className="text-xl font-semibold">{operacionais?.instalacoes}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-warning/10 p-2">
                      <Phone className="h-4 w-4 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Assistências</p>
                      {loadingOperacionais ? (
                        <Skeleton className="mt-1 h-6 w-12" />
                      ) : (
                        <p className="text-xl font-semibold">{operacionais?.assistencias}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tempo Médio em Trânsito */}
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-500/10 p-2">
                      <Navigation className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tempo Médio Trânsito</p>
                      {loadingMetricasTempo ? (
                        <Skeleton className="mt-1 h-6 w-16" />
                      ) : (
                        <p className="text-xl font-semibold">
                          {metricasTempo?.tempoMedioTransitoFormatado || '0 min'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tempo Médio de Execução */}
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-500/10 p-2">
                      <Timer className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tempo Médio Execução</p>
                      {loadingMetricasTempo ? (
                        <Skeleton className="mt-1 h-6 w-16" />
                      ) : (
                        <p className="text-xl font-semibold">
                          {metricasTempo?.tempoMedioExecucaoFormatado || '0 min'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rastreadores em Porte */}
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-orange-500/10 p-2">
                      <Radio className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Rastreadores em Porte</p>
                      {loadingRastreadoresPortador ? (
                        <Skeleton className="mt-1 h-6 w-20" />
                      ) : (
                        <p className="text-xl font-semibold">
                          {rastreadoresPortador?.totalEmPorte ?? 0}
                          <span className="text-sm text-muted-foreground ml-1">
                            ({rastreadoresPortador?.porPortador.length ?? 0} portadores)
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Lista resumida dos top 3 portadores */}
                  {!loadingRastreadoresPortador && rastreadoresPortador?.porPortador && rastreadoresPortador.porPortador.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-1.5">
                      {rastreadoresPortador.porPortador.slice(0, 3).map((p) => (
                        <div key={p.id} className="flex justify-between text-xs">
                          <span className="text-muted-foreground truncate">{p.nome}</span>
                          <Badge variant="outline" className="text-xs">
                            {p.quantidade}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Distribuição por Produto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Distribuição por Plano
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDistribuicao ? (
                <Skeleton className="mx-auto h-[250px] w-[250px] rounded-full" />
              ) : distribuicao && distribuicao.length > 0 ? (
                <div className="flex flex-col items-center gap-6 md:flex-row md:justify-around">
                  <ResponsiveContainer width={250} height={250}>
                    <RechartsPie>
                      <Pie
                        data={distribuicao}
                        dataKey="value"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {distribuicao.map((_, index) => (
                          <Cell key={index} fill={CORES_PIE[index % CORES_PIE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => value.toLocaleString()}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {distribuicao.map((item, index) => (
                      <div key={item.nome} className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: CORES_PIE[index % CORES_PIE.length] }}
                        />
                        <span className="text-sm">{item.nome}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {item.value}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                  Sem dados de planos cadastrados
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3 */}
        <div className="space-y-6">
          {/* Saúde Financeira */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Saúde Financeira
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sinistralidade */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sinistralidade</span>
                  <span className="text-sm font-medium">
                    {stats?.sinistralidade.toFixed(1)}% / 65%
                  </span>
                </div>
                <Progress
                  value={Math.min(stats?.sinistralidade || 0, 100)}
                  className={`h-2 ${getSinistColorClass(stats?.sinistralidade || 0)}`}
                />
                <p className="mt-1 text-xs text-muted-foreground">Meta: máximo 65%</p>
              </div>

              {/* Margem Operacional */}
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Margem Operacional</p>
                <p className="text-2xl font-bold">
                  {indicadorAtual?.margem_operacional?.toFixed(1) || '—'}%
                </p>
              </div>

              {/* Fundo de Reserva */}
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Fundo de Reserva</p>
                <p className="text-2xl font-bold">
                  {indicadorAtual?.saldo_fundo_reserva
                    ? formatCurrency(Number(indicadorAtual.saldo_fundo_reserva))
                    : '—'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cobertura:{' '}
                  <span className="font-medium">
                    {indicadorAtual?.cobertura_sinistros_meses?.toFixed(1) || '—'} meses
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Alertas */}
          {alertas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Alertas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alertas.map((alerta, index) => (
                  <Alert key={index} variant={alerta.type === 'destructive' ? 'destructive' : 'default'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{alerta.title}</AlertTitle>
                    <AlertDescription>{alerta.message}</AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => navigate('/diretoria/rateios')}
              >
                <span className="flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Ver Rateio
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => navigate('/configuracoes')}
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => navigate('/diretoria/relatorios')}
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Relatórios
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => navigate('/diretoria/indicadores')}
              >
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Indicadores Atuariais
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
