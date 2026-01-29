import { useState } from 'react';
import { TrendingUp, TrendingDown, Target, AlertTriangle, Calculator, BarChart3, Users, DollarSign, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SinistrosPorTipoTable, SinistrosPorFaixaFipeTable } from '@/components/diretoria';

const formatCurrency = (value: number | null) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const formatPercent = (value: number | null) => {
  return `${(value || 0).toFixed(2)}%`;
};

const getMesLabel = (mes: number) => {
  return format(new Date(2026, mes - 1), 'MMM', { locale: ptBR });
};

const getSinistralityColor = (value: number) => {
  if (value < 65) return 'text-green-600';
  if (value <= 75) return 'text-yellow-600';
  return 'text-red-600';
};

const getSinistralityBg = (value: number) => {
  if (value < 65) return 'bg-green-500';
  if (value <= 75) return 'bg-yellow-500';
  return 'bg-red-500';
};

export default function IndicadoresAtuariais() {
  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState(currentYear);
  const [activeTab, setActiveTab] = useState('visao-geral');
  const queryClient = useQueryClient();

  // Indicadores do ano selecionado
  const { data: indicadores, isLoading } = useQuery({
    queryKey: ['indicadores-atuariais', ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('indicadores_atuariais')
        .select('*')
        .eq('ano', ano)
        .order('mes');
      if (error) throw error;
      return data;
    }
  });

  // Indicador do mês atual
  const { data: atual } = useQuery({
    queryKey: ['indicador-atual'],
    queryFn: async () => {
      const hoje = new Date();
      const { data, error } = await supabase
        .from('indicadores_atuariais')
        .select('*')
        .eq('ano', hoje.getFullYear())
        .eq('mes', hoje.getMonth() + 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Mutation para recalcular indicadores
  const recalcularMutation = useMutation({
    mutationFn: async () => {
      const mesAtual = new Date().getMonth() + 1;
      const anoAtual = new Date().getFullYear();
      const inicioMes = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`;
      
      const [receita, sinistros, associados, novos, cancelados] = await Promise.all([
        supabase.from('cobrancas')
          .select('valor_pago')
          .eq('status', 'pago')
          .gte('data_pagamento', inicioMes),
        supabase.from('sinistros')
          .select('valor_indenizacao')
          .in('status', ['aprovado', 'indenizado', 'pago'])
          .gte('data_ocorrencia', inicioMes),
        supabase.from('associados')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'ativo'),
        supabase.from('associados')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'ativo')
          .gte('created_at', inicioMes),
        supabase.from('associados')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'cancelado')
          .gte('updated_at', inicioMes),
      ]);
      
      const receitaBruta = receita.data?.reduce((s, r) => s + (r.valor_pago || 0), 0) || 0;
      const despesasSinistros = sinistros.data?.reduce((s, r) => s + (r.valor_indenizacao || 0), 0) || 0;
      const totalAssociados = associados.count || 0;
      const qtdSinistros = sinistros.data?.length || 0;
      
      const sinistralidade = receitaBruta > 0 ? (despesasSinistros / receitaBruta) * 100 : 0;
      const frequencia = totalAssociados > 0 ? qtdSinistros / totalAssociados : 0;
      const ticketMedio = qtdSinistros > 0 ? despesasSinistros / qtdSinistros : 0;
      const resultado = receitaBruta - despesasSinistros;
      const margem = receitaBruta > 0 ? (resultado / receitaBruta) * 100 : 0;
      const taxaRetencao = totalAssociados > 0 ? ((totalAssociados - (cancelados.count || 0)) / totalAssociados) * 100 : 0;
      const churnRate = totalAssociados > 0 ? ((cancelados.count || 0) / totalAssociados) * 100 : 0;
      
      const { error } = await supabase
        .from('indicadores_atuariais')
        .upsert({
          mes: mesAtual,
          ano: anoAtual,
          receita_bruta: receitaBruta,
          despesas_sinistros: despesasSinistros,
          sinistralidade_bruta: sinistralidade,
          sinistralidade_liquida: sinistralidade, // Simplificado para mesma
          frequencia_sinistros: frequencia,
          ticket_medio_sinistro: ticketMedio,
          resultado_operacional: resultado,
          margem_operacional: margem,
          total_associados: totalAssociados,
          novos_associados: novos.count || 0,
          cancelamentos: cancelados.count || 0,
          taxa_retencao: taxaRetencao,
          churn_rate: churnRate,
        }, { onConflict: 'mes,ano' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Indicadores recalculados com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['indicadores-atuariais'] });
      queryClient.invalidateQueries({ queryKey: ['indicador-atual'] });
    },
    onError: (error) => {
      console.error('Erro ao recalcular:', error);
      toast.error('Erro ao recalcular indicadores');
    },
  });

  // Preparar dados para gráficos
  const chartData = indicadores?.map(ind => ({
    ...ind,
    mesLabel: getMesLabel(ind.mes),
  })) || [];

  // Anos disponíveis para seleção
  const anosDisponiveis = [currentYear - 2, currentYear - 1, currentYear];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Indicadores Atuariais</h1>
          <p className="text-muted-foreground">Análise de performance e sinistralidade</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={() => recalcularMutation.mutate()}
            disabled={recalcularMutation.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", recalcularMutation.isPending && "animate-spin")} />
            {recalcularMutation.isPending ? 'Calculando...' : 'Recalcular'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {/* Sinistralidade */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Sinistralidade</span>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className={`text-2xl font-bold ${getSinistralityColor(atual?.sinistralidade_bruta || 0)}`}>
              {formatPercent(atual?.sinistralidade_bruta)}
            </p>
            <Progress 
              value={Math.min(atual?.sinistralidade_bruta || 0, 100)} 
              className={`h-2 mt-2 ${getSinistralityBg(atual?.sinistralidade_bruta || 0)}`}
            />
            <p className="text-xs text-muted-foreground mt-1">Meta: 65%</p>
          </CardContent>
        </Card>

        {/* Frequência Sinistros */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Frequência</span>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {(atual?.frequencia_sinistros || 0).toFixed(4)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Sinistros/Associado</p>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Ticket Médio</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(atual?.ticket_medio_sinistro)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Por sinistro</p>
          </CardContent>
        </Card>

        {/* Taxa Retenção */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Retenção</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatPercent(atual?.taxa_retencao)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Associados retidos</p>
          </CardContent>
        </Card>

        {/* Margem Operacional */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Margem</span>
              {(atual?.margem_operacional || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className={`text-2xl font-bold ${(atual?.margem_operacional || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(atual?.margem_operacional)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Resultado/Receita</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="sinistralidade">Sinistralidade</TabsTrigger>
          <TabsTrigger value="crescimento">Crescimento</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="projecoes">Projeções</TabsTrigger>
        </TabsList>

        {/* Tab Visão Geral */}
        <TabsContent value="visao-geral" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Gráfico Sinistralidade Mensal */}
            <Card>
              <CardHeader>
                <CardTitle>Sinistralidade Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mesLabel" />
                    <YAxis unit="%" domain={[0, 100]} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                    <ReferenceLine y={65} stroke="#f59e0b" strokeDasharray="3 3" label="Meta 65%" />
                    <Line 
                      type="monotone" 
                      dataKey="sinistralidade_bruta" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      name="Sinistralidade"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico Receita vs Sinistros */}
            <Card>
              <CardHeader>
                <CardTitle>Receita vs Sinistros</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mesLabel" />
                    <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="receita_bruta" fill="#22c55e" name="Receita" />
                    <Bar dataKey="despesas_sinistros" fill="#ef4444" name="Sinistros" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Sinistralidade */}
        <TabsContent value="sinistralidade" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolução da Sinistralidade</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mesLabel" />
                  <YAxis unit="%" />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={65} stroke="#f59e0b" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="sinistralidade_bruta" stroke="#ef4444" name="Bruta" />
                  <Line type="monotone" dataKey="sinistralidade_liquida" stroke="#f97316" name="Líquida" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabela Sinistralidade por Tipo de Evento - NOVO */}
          <Card>
            <CardHeader>
              <CardTitle>Sinistralidade por Tipo de Evento</CardTitle>
            </CardHeader>
            <CardContent>
              <SinistrosPorTipoTable ano={ano} />
            </CardContent>
          </Card>

          {/* Tabela Sinistralidade por Faixa FIPE - NOVO */}
          <Card>
            <CardHeader>
              <CardTitle>Sinistralidade por Faixa FIPE</CardTitle>
            </CardHeader>
            <CardContent>
              <SinistrosPorFaixaFipeTable ano={ano} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhamento Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Sinistralidade Bruta</TableHead>
                    <TableHead className="text-right">Sinistralidade Líquida</TableHead>
                    <TableHead className="text-right">Frequência</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicadores?.map((ind) => (
                    <TableRow key={ind.id}>
                      <TableCell className="font-medium">{getMesLabel(ind.mes)}</TableCell>
                      <TableCell className={`text-right ${getSinistralityColor(ind.sinistralidade_bruta || 0)}`}>
                        {formatPercent(ind.sinistralidade_bruta)}
                      </TableCell>
                      <TableCell className="text-right">{formatPercent(ind.sinistralidade_liquida)}</TableCell>
                      <TableCell className="text-right">{(ind.frequencia_sinistros || 0).toFixed(4)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(ind.ticket_medio_sinistro)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Crescimento */}
        <TabsContent value="crescimento" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Novos Associados (ano)</p>
                <p className="text-2xl font-bold text-green-600">
                  {indicadores?.reduce((sum, ind) => sum + (ind.novos_associados || 0), 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Cancelamentos (ano)</p>
                <p className="text-2xl font-bold text-red-600">
                  {indicadores?.reduce((sum, ind) => sum + (ind.cancelamentos || 0), 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Crescimento Líquido</p>
                <p className="text-2xl font-bold">
                  {indicadores?.reduce((sum, ind) => sum + (ind.novos_associados || 0) - (ind.cancelamentos || 0), 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Novos vs Cancelamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mesLabel" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="novos_associados" fill="#22c55e" name="Novos" />
                  <Bar dataKey="cancelamentos" fill="#ef4444" name="Cancelamentos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolução Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Novos</TableHead>
                    <TableHead className="text-right">Cancelamentos</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="text-right">Taxa Retenção</TableHead>
                    <TableHead className="text-right">Churn Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicadores?.map((ind) => (
                    <TableRow key={ind.id}>
                      <TableCell className="font-medium">{getMesLabel(ind.mes)}</TableCell>
                      <TableCell className="text-right text-green-600">+{ind.novos_associados}</TableCell>
                      <TableCell className="text-right text-red-600">-{ind.cancelamentos}</TableCell>
                      <TableCell className="text-right font-medium">
                        {(ind.novos_associados || 0) - (ind.cancelamentos || 0)}
                      </TableCell>
                      <TableCell className="text-right">{formatPercent(ind.taxa_retencao)}</TableCell>
                      <TableCell className="text-right">{formatPercent(ind.churn_rate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Financeiro */}
        <TabsContent value="financeiro" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Receita Bruta (ano)</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(indicadores?.reduce((sum, ind) => sum + (ind.receita_bruta || 0), 0))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Despesas Sinistros (ano)</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(indicadores?.reduce((sum, ind) => sum + (ind.despesas_sinistros || 0), 0))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Resultado Operacional</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(indicadores?.reduce((sum, ind) => sum + (ind.resultado_operacional || 0), 0))}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Fundo de Reserva
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Atual</p>
                  <p className="text-3xl font-bold">{formatCurrency(atual?.saldo_fundo_reserva)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Cobertura</p>
                  <p className={`text-2xl font-bold ${(atual?.cobertura_sinistros_meses || 0) < 3 ? 'text-red-600' : 'text-green-600'}`}>
                    {atual?.cobertura_sinistros_meses?.toFixed(1) || 0} meses
                  </p>
                </div>
              </div>
              {(atual?.cobertura_sinistros_meses || 0) < 3 && (
                <Alert className="mt-4" variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Fundo de reserva abaixo do mínimo recomendado (3 meses).
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhamento Financeiro Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Receita Bruta</TableHead>
                    <TableHead className="text-right">Despesas Op.</TableHead>
                    <TableHead className="text-right">Despesas Sin.</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicadores?.map((ind) => (
                    <TableRow key={ind.id}>
                      <TableCell className="font-medium">{getMesLabel(ind.mes)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(ind.receita_bruta)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(ind.despesas_operacionais)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(ind.despesas_sinistros)}</TableCell>
                      <TableCell className={`text-right font-medium ${(ind.resultado_operacional || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(ind.resultado_operacional)}
                      </TableCell>
                      <TableCell className="text-right">{formatPercent(ind.margem_operacional)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Projeções */}
        <TabsContent value="projecoes" className="space-y-4">
          <Alert>
            <Calculator className="h-4 w-4" />
            <AlertDescription>
              Projeções baseadas na média móvel dos últimos 3 meses. Valores são estimativas e podem variar.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Projeção de Sinistralidade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map(offset => {
                    const mesAtual = new Date().getMonth() + 1;
                    const mesFuturo = mesAtual + offset > 12 ? mesAtual + offset - 12 : mesAtual + offset;
                    const ultimos3 = indicadores?.slice(-3) || [];
                    const mediaMovel = ultimos3.reduce((sum, ind) => sum + (ind.sinistralidade_bruta || 0), 0) / (ultimos3.length || 1);
                    
                    return (
                      <div key={offset} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="font-medium">{getMesLabel(mesFuturo)}</span>
                        <span className={getSinistralityColor(mediaMovel)}>
                          ~{formatPercent(mediaMovel)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projeção de Receita</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map(offset => {
                    const mesAtual = new Date().getMonth() + 1;
                    const mesFuturo = mesAtual + offset > 12 ? mesAtual + offset - 12 : mesAtual + offset;
                    const ultimos3 = indicadores?.slice(-3) || [];
                    const mediaMovel = ultimos3.reduce((sum, ind) => sum + (ind.receita_bruta || 0), 0) / (ultimos3.length || 1);
                    
                    return (
                      <div key={offset} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="font-medium">{getMesLabel(mesFuturo)}</span>
                        <span className="text-green-600 font-medium">
                          ~{formatCurrency(mediaMovel)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alertas de Tendência */}
          {indicadores && indicadores.length >= 3 && (
            <>
              {(() => {
                const ultimos3 = indicadores.slice(-3);
                const tendenciaSinistralidade = (ultimos3[2]?.sinistralidade_bruta || 0) > (ultimos3[0]?.sinistralidade_bruta || 0);
                const fundoBaixo = (atual?.cobertura_sinistros_meses || 0) < 3;

                return (
                  <div className="space-y-2">
                    {tendenciaSinistralidade && (
                      <Alert variant="destructive">
                        <TrendingUp className="h-4 w-4" />
                        <AlertDescription>
                          Tendência de alta na sinistralidade nos últimos 3 meses. Recomenda-se análise detalhada.
                        </AlertDescription>
                      </Alert>
                    )}
                    {fundoBaixo && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Fundo de reserva abaixo de 3 meses de cobertura. Considere aumentar as contribuições.
                        </AlertDescription>
                      </Alert>
                    )}
                    {!tendenciaSinistralidade && !fundoBaixo && (
                      <Alert>
                        <TrendingDown className="h-4 w-4" />
                        <AlertDescription>
                          Indicadores dentro dos parâmetros esperados. Continue monitorando.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
