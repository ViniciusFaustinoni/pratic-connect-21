import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Download, BarChart3, TrendingUp, Users, 
  DollarSign, Target, PieChart, Gift
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { usePerformanceCanais, useTopIndicadores } from '@/hooks/useMarketing';
import { toast } from 'sonner';

type PeriodoType = 'este_mes' | 'ultimo_mes' | 'trimestre' | 'ano';

export default function RelatoriosMarketing() {
  const [periodo, setPeriodo] = useState<PeriodoType>('este_mes');

  const periodoRange = useMemo(() => {
    const hoje = new Date();
    switch (periodo) {
      case 'este_mes':
        return { inicio: startOfMonth(hoje), fim: hoje };
      case 'ultimo_mes':
        const mesPassado = subMonths(hoje, 1);
        return { inicio: startOfMonth(mesPassado), fim: endOfMonth(mesPassado) };
      case 'trimestre':
        return { inicio: subMonths(hoje, 3), fim: hoje };
      case 'ano':
        return { inicio: new Date(hoje.getFullYear(), 0, 1), fim: hoje };
      default:
        return { inicio: startOfMonth(hoje), fim: hoje };
    }
  }, [periodo]);

  // Query: Dados consolidados do período
  const { data: dados, isLoading } = useQuery({
    queryKey: ['relatorio-marketing', periodoRange.inicio.toISOString(), periodoRange.fim.toISOString()],
    queryFn: async () => {
      const [leads, campanhas, indicacoes, metricas] = await Promise.all([
        // Leads por origem
        supabase.from('leads')
          .select('origem, etapa')
          .gte('created_at', periodoRange.inicio.toISOString())
          .lte('created_at', periodoRange.fim.toISOString()),
        
        // Campanhas
        supabase.from('campanhas')
          .select('id, nome, status, valor_gasto, meta_leads')
          .gte('data_inicio', periodoRange.inicio.toISOString().split('T')[0]),
        
        // Indicações
        supabase.from('indicacoes')
          .select('status, valor_recompensa, recompensa_paga')
          .gte('data_indicacao', periodoRange.inicio.toISOString()),
        
        // Métricas totais
        supabase.from('campanhas_metricas')
          .select('leads, conversoes, valor_gasto')
          .gte('data', periodoRange.inicio.toISOString().split('T')[0])
      ]);
      
      return { 
        leads: leads.data || [], 
        campanhas: campanhas.data || [], 
        indicacoes: indicacoes.data || [],
        metricas: metricas.data || []
      };
    }
  });

  const { data: performance } = usePerformanceCanais();
  const { data: topIndicadores } = useTopIndicadores();

  // Calcular KPIs
  const kpis = useMemo(() => {
    const totalLeads = dados?.leads?.length || 0;
    const conversoes = dados?.leads?.filter(l => l.etapa === 'ganho').length || 0;
    const totalInvestido = dados?.metricas?.reduce((s, m) => s + (m.valor_gasto || 0), 0) || 0;
    const taxaConversao = totalLeads > 0 ? (conversoes / totalLeads) * 100 : 0;
    const cplMedio = totalLeads > 0 ? totalInvestido / totalLeads : 0;
    // ROI simplificado (considerando R$ 500 por conversão)
    const receitaEstimada = conversoes * 500;
    const roi = totalInvestido > 0 ? ((receitaEstimada - totalInvestido) / totalInvestido) * 100 : 0;
    
    return { totalLeads, conversoes, taxaConversao, totalInvestido, cplMedio, roi };
  }, [dados]);

  // Leads por origem agrupados
  const leadsPorOrigem = useMemo(() => {
    if (!dados?.leads) return [];
    
    const grouped: Record<string, { origem: string; total: number; conversoes: number }> = {};
    dados.leads.forEach(lead => {
      const origem = lead.origem || 'Não informado';
      if (!grouped[origem]) {
        grouped[origem] = { origem, total: 0, conversoes: 0 };
      }
      grouped[origem].total++;
      if (lead.etapa === 'ganho') grouped[origem].conversoes++;
    });
    
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [dados?.leads]);

  // Indicações stats
  const indicacoesStats = useMemo(() => {
    if (!dados?.indicacoes) return { total: 0, convertidas: 0, valorPago: 0 };
    
    const total = dados.indicacoes.length;
    const convertidas = dados.indicacoes.filter(i => i.status === 'convertido' || i.status === 'recompensado').length;
    const valorPago = dados.indicacoes
      .filter(i => i.recompensa_paga)
      .reduce((sum, i) => sum + (i.valor_recompensa || 0), 0);
    
    return { total, convertidas, valorPago };
  }, [dados?.indicacoes]);

  const handleExportarPDF = () => {
    toast.info('Exportação de PDF em desenvolvimento');
  };

  const periodoLabels: Record<PeriodoType, string> = {
    este_mes: 'Este Mês',
    ultimo_mes: 'Último Mês',
    trimestre: 'Trimestre',
    ano: 'Este Ano',
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios de Marketing</h1>
          <p className="text-muted-foreground">
            {format(periodoRange.inicio, "dd 'de' MMMM", { locale: ptBR })} - {format(periodoRange.fim, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={periodo} onValueChange={(v: PeriodoType) => setPeriodo(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodoLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportarPDF}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          {/* Cards KPI */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Leads</p>
                    <p className="text-2xl font-bold">{kpis.totalLeads}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Taxa Conversão</p>
                    <p className="text-2xl font-bold text-green-600">{kpis.taxaConversao.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPL Médio</p>
                    <p className="text-2xl font-bold">R$ {kpis.cplMedio.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Investido</p>
                    <p className="text-2xl font-bold">R$ {kpis.totalInvestido.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpis.roi >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ROI</p>
                    <p className={`text-2xl font-bold ${kpis.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {kpis.roi >= 0 ? '+' : ''}{kpis.roi.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="visao-geral">
            <TabsList>
              <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
              <TabsTrigger value="por-canal">Por Canal</TabsTrigger>
              <TabsTrigger value="por-campanha">Por Campanha</TabsTrigger>
              <TabsTrigger value="indicacoes">Indicações</TabsTrigger>
            </TabsList>
            
            <TabsContent value="visao-geral" className="space-y-6 mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Leads por Origem */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      Leads por Origem
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {leadsPorOrigem.length > 0 ? (
                      leadsPorOrigem.slice(0, 8).map(item => (
                        <div key={item.origem} className="flex items-center gap-4">
                          <span className="w-32 truncate text-sm">{item.origem}</span>
                          <Progress 
                            value={(item.total / (leadsPorOrigem[0]?.total || 1)) * 100} 
                            className="flex-1" 
                          />
                          <span className="w-12 text-right font-medium text-sm">{item.total}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum dado disponível
                      </p>
                    )}
                  </CardContent>
                </Card>
                
                {/* Conversões por Canal */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Conversões por Canal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {performance && performance.length > 0 ? (
                      performance.slice(0, 8).map(canal => (
                        <div key={canal.id} className="flex items-center gap-4">
                          <span className="w-32 truncate text-sm">{canal.nome}</span>
                          <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${Math.min(100, (canal.conversoes / (performance[0]?.conversoes || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right font-medium text-sm text-green-600">
                            {canal.conversoes}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum dado disponível
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="por-canal" className="mt-6">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Canal</TableHead>
                        <TableHead className="text-center">Leads</TableHead>
                        <TableHead className="text-center">Conversões</TableHead>
                        <TableHead className="text-center">Taxa</TableHead>
                        <TableHead className="text-right">Investimento</TableHead>
                        <TableHead className="text-right">CPL</TableHead>
                        <TableHead className="text-right">CPA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performance && performance.length > 0 ? (
                        performance.map(canal => (
                          <TableRow key={canal.id}>
                            <TableCell className="font-medium">{canal.nome}</TableCell>
                            <TableCell className="text-center">{canal.total_leads}</TableCell>
                            <TableCell className="text-center text-green-600">{canal.conversoes}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{canal.taxa_conversao?.toFixed(1)}%</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {(canal.investimento_total || 0).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {(canal.cpl_medio || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {canal.conversoes > 0 ? ((canal.investimento_total || 0) / canal.conversoes).toFixed(2) : '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhum dado disponível
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="por-campanha" className="mt-6">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campanha</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Meta Leads</TableHead>
                        <TableHead className="text-right">Gasto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dados?.campanhas && dados.campanhas.length > 0 ? (
                        dados.campanhas.map(campanha => (
                          <TableRow key={campanha.id}>
                            <TableCell className="font-medium">{campanha.nome}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={campanha.status === 'ativa' ? 'default' : 'secondary'}>
                                {campanha.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{campanha.meta_leads || '-'}</TableCell>
                            <TableCell className="text-right">
                              R$ {(campanha.valor_gasto || 0).toLocaleString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhuma campanha no período
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="indicacoes" className="space-y-6 mt-6">
              {/* Cards de Indicações */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Indicações</p>
                    <p className="text-2xl font-bold">{indicacoesStats.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Convertidas</p>
                    <p className="text-2xl font-bold text-green-600">{indicacoesStats.convertidas}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Taxa Conversão</p>
                    <p className="text-2xl font-bold">
                      {indicacoesStats.total > 0 
                        ? ((indicacoesStats.convertidas / indicacoesStats.total) * 100).toFixed(1) 
                        : 0}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Valor Pago</p>
                    <p className="text-2xl font-bold text-purple-600">
                      R$ {indicacoesStats.valorPago.toLocaleString('pt-BR')}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Indicadores */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Top 5 Indicadores
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Posição</TableHead>
                        <TableHead>Indicador</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Convertidas</TableHead>
                        <TableHead className="text-right">Valor Recebido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topIndicadores && topIndicadores.length > 0 ? (
                        topIndicadores.slice(0, 5).map((ind, idx) => (
                          <TableRow key={ind.indicador_id || ind.indicador_nome}>
                            <TableCell>
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                idx === 1 ? 'bg-gray-100 text-gray-700' :
                                idx === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-muted'
                              }`}>
                                {idx + 1}º
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{ind.indicador_nome || 'Não informado'}</p>
                              <p className="text-xs text-muted-foreground">{ind.indicador_telefone}</p>
                            </TableCell>
                            <TableCell className="text-center font-medium">{ind.total}</TableCell>
                            <TableCell className="text-center text-green-600">{ind.convertidas}</TableCell>
                            <TableCell className="text-right font-medium">
                              R$ {ind.valorRecebido.toLocaleString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Nenhum indicador no período
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
