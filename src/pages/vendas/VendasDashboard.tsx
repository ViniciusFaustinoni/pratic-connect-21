import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, FileText, CheckCircle, TrendingUp, TrendingDown,
  DollarSign, Calendar, AlertTriangle, ArrowUpRight, ArrowDownRight,
  ChevronRight, Download, RefreshCw, Bell,
  Flame, ThermometerSun, Snowflake, Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, Area, AreaChart,
  ComposedChart
} from 'recharts';
import { useVendasMetricasExpanded, type Periodo, type LeadRisco } from '@/hooks/useVendasMetricasExpanded';
import { FunilCotacaoChart } from '@/components/vendas/FunilCotacaoChart';
import { cn } from '@/lib/utils';

// ============================================
// COMPONENTES AUXILIARES
// ============================================

function KPICard({ 
  titulo, 
  valor, 
  variacao, 
  icone: Icone, 
  corIcone,
  bgIcone,
  formato = 'numero',
  meta,
  metaLabel,
  isLoading = false
}: {
  titulo: string;
  valor: number;
  variacao?: number;
  icone: React.ElementType;
  corIcone: string;
  bgIcone: string;
  formato?: 'numero' | 'percentual' | 'moeda';
  meta?: { atual: number; total: number };
  metaLabel?: string;
  isLoading?: boolean;
}) {
  const formatarValor = (v: number) => {
    switch (formato) {
      case 'percentual':
        return `${v.toFixed(1)}%`;
      case 'moeda':
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
      default:
        return v.toLocaleString('pt-BR');
    }
  };

  const variacaoPositiva = variacao !== undefined && variacao > 0;
  const variacaoNegativa = variacao !== undefined && variacao < 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg", bgIcone)}>
              <Icone className={cn("h-6 w-6", corIcone)} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{titulo}</p>
              <p className="text-2xl font-bold">{formatarValor(valor)}</p>
            </div>
          </div>
          
          {variacao !== undefined && (
            <Badge 
              variant="outline" 
              className={cn(
                "flex items-center gap-1",
                variacaoPositiva && "text-green-600 border-green-200 bg-green-50",
                variacaoNegativa && "text-red-600 border-red-200 bg-red-50",
                !variacaoPositiva && !variacaoNegativa && "text-muted-foreground"
              )}
            >
              {variacaoPositiva && <ArrowUpRight className="h-3 w-3" />}
              {variacaoNegativa && <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(variacao).toFixed(1)}%
            </Badge>
          )}
        </div>
        
        {meta && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{metaLabel || 'Meta'}</span>
              <span>{meta.atual} / {meta.total}</span>
            </div>
            <Progress value={(meta.atual / meta.total) * 100} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeadRiscoCard({ lead, temperatura }: { lead: LeadRisco; temperatura: 'quente' | 'morno' | 'frio' }) {
  const config = {
    quente: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', icon: Flame, iconColor: 'text-orange-500' },
    morno: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', icon: ThermometerSun, iconColor: 'text-yellow-500' },
    frio: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: Snowflake, iconColor: 'text-blue-500' },
  };

  const { bg, border, icon: Icone, iconColor } = config[temperatura];

  return (
    <div className={cn("flex items-center justify-between p-3 rounded-lg border", bg, border)}>
      <div className="flex items-center gap-3">
        <Icone className={cn("h-4 w-4", iconColor)} />
        <div>
          <p className="font-medium text-sm">{lead.nome}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{lead.etapa}</span>
            <span>•</span>
            <span>{lead.vendedor}</span>
          </div>
        </div>
      </div>
      <Badge variant="secondary" className="text-xs">
        {lead.diasSemContato}d
      </Badge>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function VendasDashboard() {
  const [periodo, setPeriodo] = useState<Periodo>('30dias');
  const { data: metricas, isLoading, refetch } = useVendasMetricasExpanded(periodo);

  const totalLeadsRisco = metricas 
    ? metricas.leadsEmRisco.quentes.length + metricas.leadsEmRisco.mornos.length + metricas.leadsEmRisco.frios.length 
    : 0;

  const kpis = [
    {
      titulo: 'Leads do Mês',
      valor: metricas?.leads || 0,
      variacao: metricas?.leadsVariacao,
      icone: Users,
      corIcone: 'text-blue-600',
      bgIcone: 'bg-blue-100 dark:bg-blue-900/30',
      meta: metricas?.metas.leadsMetaMes ? { atual: metricas.leads, total: metricas.metas.leadsMetaMes } : undefined,
    },
    {
      titulo: 'Cotações Enviadas',
      valor: metricas?.cotacoes || 0,
      variacao: metricas?.cotacoesVariacao,
      icone: FileText,
      corIcone: 'text-purple-600',
      bgIcone: 'bg-purple-100 dark:bg-purple-900/30',
      meta: metricas?.metas.cotacoesMetaMes ? { atual: metricas.cotacoes, total: metricas.metas.cotacoesMetaMes } : undefined,
    },
    {
      titulo: 'Contratos Fechados',
      valor: metricas?.contratos || 0,
      variacao: metricas?.contratosVariacao,
      icone: CheckCircle,
      corIcone: 'text-green-600',
      bgIcone: 'bg-green-100 dark:bg-green-900/30',
      meta: metricas?.metas.contratosMetaMes ? { atual: metricas.contratos, total: metricas.metas.contratosMetaMes } : undefined,
    },
    {
      titulo: 'Taxa de Conversão',
      valor: metricas?.conversao || 0,
      variacao: metricas?.conversaoVariacao,
      icone: TrendingUp,
      corIcone: 'text-orange-600',
      bgIcone: 'bg-orange-100 dark:bg-orange-900/30',
      formato: 'percentual' as const,
    },
    {
      titulo: 'Ticket Médio',
      valor: metricas?.ticketMedio || 0,
      variacao: metricas?.ticketVariacao,
      icone: DollarSign,
      corIcone: 'text-emerald-600',
      bgIcone: 'bg-emerald-100 dark:bg-emerald-900/30',
      formato: 'moeda' as const,
    },
    {
      titulo: 'Receita Prevista',
      valor: metricas?.receitaPrevista || 0,
      icone: Target,
      corIcone: 'text-indigo-600',
      bgIcone: 'bg-indigo-100 dark:bg-indigo-900/30',
      formato: 'moeda' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link to="/dashboard" className="hover:text-foreground">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <span>Vendas</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold">Dashboard de Vendas</h1>
          <p className="text-muted-foreground">Visão geral do desempenho comercial</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro de Período */}
          <div className="flex rounded-lg border bg-muted/30 p-1">
            {[
              { id: 'hoje', label: 'Hoje' },
              { id: '7dias', label: '7 dias' },
              { id: '30dias', label: '30 dias' },
              { id: 'ano', label: 'Ano' },
            ].map((p) => (
              <Button
                key={p.id}
                variant={periodo === p.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriodo(p.id as Periodo)}
                className="h-8"
              >
                {p.label}
              </Button>
            ))}
          </div>
          
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Exportar
          </Button>
        </div>
      </div>

      {/* ============================================ */}
      {/* ALERTAS */}
      {/* ============================================ */}
      {metricas?.alertas && metricas.alertas.length > 0 && (
        <div className="space-y-2">
          {metricas.alertas.map((alerta, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                alerta.tipo === 'urgente' && "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
                alerta.tipo === 'atencao' && "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
                alerta.tipo === 'info' && "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
              )}
            >
              <div className="flex items-center gap-3">
                {alerta.tipo === 'urgente' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                {alerta.tipo === 'atencao' && <Bell className="h-4 w-4 text-yellow-500" />}
                {alerta.tipo === 'info' && <Bell className="h-4 w-4 text-blue-500" />}
                <span className="text-sm font-medium">{alerta.mensagem}</span>
              </div>
              <Link to={alerta.acao}>
                <Button variant="ghost" size="sm">
                  Ver <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ============================================ */}
      {/* KPIs PRINCIPAIS */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.titulo} {...kpi} isLoading={isLoading} />
        ))}
      </div>

      {/* ============================================ */}
      {/* PROGRESSO DAS METAS */}
      {/* ============================================ */}
      {metricas?.metas && (metricas.metas.leadsMetaMes > 0 || metricas.metas.contratosMetaMes > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Progresso das Metas do Mês</CardTitle>
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {metricas.metas.diasRestantes} dias restantes
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {metricas.metas.leadsMetaMes > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Leads</span>
                    <span className="text-muted-foreground">
                      {metricas.leads} / {metricas.metas.leadsMetaMes}
                    </span>
                  </div>
                  <Progress value={(metricas.leads / metricas.metas.leadsMetaMes) * 100} className="h-3" />
                  <p className="text-xs text-muted-foreground">
                    {((metricas.leads / metricas.metas.leadsMetaMes) * 100).toFixed(0)}% da meta
                  </p>
                </div>
              )}
              
              {metricas.metas.cotacoesMetaMes > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Cotações</span>
                    <span className="text-muted-foreground">
                      {metricas.cotacoes} / {metricas.metas.cotacoesMetaMes}
                    </span>
                  </div>
                  <Progress value={(metricas.cotacoes / metricas.metas.cotacoesMetaMes) * 100} className="h-3" />
                  <p className="text-xs text-muted-foreground">
                    {((metricas.cotacoes / metricas.metas.cotacoesMetaMes) * 100).toFixed(0)}% da meta
                  </p>
                </div>
              )}
              
              {metricas.metas.contratosMetaMes > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Contratos</span>
                    <span className="text-muted-foreground">
                      {metricas.contratos} / {metricas.metas.contratosMetaMes}
                    </span>
                  </div>
                  <Progress value={(metricas.contratos / metricas.metas.contratosMetaMes) * 100} className="h-3" />
                  <p className="text-xs text-muted-foreground">
                    {((metricas.contratos / metricas.metas.contratosMetaMes) * 100).toFixed(0)}% da meta
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* GRÁFICOS - LINHA 1: FUNIL + EVOLUÇÃO */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* FUNIL DE COTAÇÃO - Usando novo componente */}
        <FunilCotacaoChart periodo={periodo} />

        {/* EVOLUÇÃO MENSAL */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução Mensal</CardTitle>
            <CardDescription>Comparativo de leads, cotações e contratos</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : metricas?.evolucaoData && metricas.evolucaoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={metricas.evolucaoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="leads" fill="#3B82F6" fillOpacity={0.2} stroke="#3B82F6" name="Leads" />
                  <Line type="monotone" dataKey="cotacoes" stroke="#A855F7" strokeWidth={2} name="Cotações" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="contratos" stroke="#22C55E" strokeWidth={2} name="Contratos" dot={{ r: 4 }} />
                  {metricas.evolucaoData.some(d => d.meta > 0) && (
                    <Line type="monotone" dataKey="meta" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" name="Meta" dot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[350px] items-center justify-center text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================ */}
      {/* GRÁFICOS - LINHA 2: RANKING + ORIGENS */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TOP VENDEDORES */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top Vendedores</CardTitle>
              <Link to="/vendas/metas">
                <Button variant="ghost" size="sm">
                  Ver Metas <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : metricas?.rankingVendedores && metricas.rankingVendedores.length > 0 ? (
              <div className="space-y-3">
                {metricas.rankingVendedores.map((vendedor, index) => (
                  <div key={vendedor.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    {/* Ranking */}
                    <div className="w-8 text-center font-bold">
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && <span className="text-muted-foreground">{index + 1}º</span>}
                    </div>
                    
                    {/* Avatar */}
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={vendedor.avatar_url || undefined} />
                      <AvatarFallback>{vendedor.nome.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{vendedor.nome}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{vendedor.leads} leads</span>
                        <span>{vendedor.cotacoes} cot.</span>
                        <span className="font-medium text-green-600">{vendedor.contratos} contratos</span>
                      </div>
                      
                      {/* Barra de progresso da meta */}
                      {vendedor.metaContratos > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <Progress 
                            value={(vendedor.contratos / vendedor.metaContratos) * 100} 
                            className="h-1.5 flex-1" 
                          />
                          <span className="text-xs text-muted-foreground">
                            {vendedor.contratos}/{vendedor.metaContratos}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Métricas */}
                    <div className="text-right text-xs">
                      <p className="text-muted-foreground">Conv: {vendedor.conversao.toFixed(1)}%</p>
                      <p className="font-medium">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vendedor.valor)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Nenhum vendedor com atividade no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* LEADS POR ORIGEM */}
        <Card>
          <CardHeader>
            <CardTitle>Leads por Origem</CardTitle>
            <CardDescription>Distribuição por canal de entrada</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : metricas?.origensData && metricas.origensData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={metricas.origensData}
                    dataKey="valor"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={60}
                    paddingAngle={2}
                    label={({ nome, percentual }) => `${nome} (${percentual.toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {metricas.origensData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value} leads`, 'Quantidade']} 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================ */}
      {/* LEADS EM RISCO + PERDIDOS */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEADS EM RISCO */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <CardTitle className="text-lg">Leads em Risco</CardTitle>
                  <CardDescription>{totalLeadsRisco} leads precisam de atenção</CardDescription>
                </div>
              </div>
              <Link to="/vendas/leads?risco=true">
                <Button variant="ghost" size="sm">Ver todos</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="quentes">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="quentes" className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-500" />
                  Quentes ({metricas?.leadsEmRisco.quentes.length || 0})
                </TabsTrigger>
                <TabsTrigger value="mornos" className="flex items-center gap-1">
                  <ThermometerSun className="h-3 w-3 text-yellow-500" />
                  Mornos ({metricas?.leadsEmRisco.mornos.length || 0})
                </TabsTrigger>
                <TabsTrigger value="frios" className="flex items-center gap-1">
                  <Snowflake className="h-3 w-3 text-blue-500" />
                  Frios ({metricas?.leadsEmRisco.frios.length || 0})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="quentes" className="mt-4 space-y-2 max-h-[250px] overflow-y-auto">
                {metricas?.leadsEmRisco.quentes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum lead quente em risco 👍
                  </p>
                ) : (
                  metricas?.leadsEmRisco.quentes.map(lead => (
                    <LeadRiscoCard key={lead.id} lead={lead} temperatura="quente" />
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="mornos" className="mt-4 space-y-2 max-h-[250px] overflow-y-auto">
                {metricas?.leadsEmRisco.mornos.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum lead morno em risco
                  </p>
                ) : (
                  metricas?.leadsEmRisco.mornos.map(lead => (
                    <LeadRiscoCard key={lead.id} lead={lead} temperatura="morno" />
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="frios" className="mt-4 space-y-2 max-h-[250px] overflow-y-auto">
                {metricas?.leadsEmRisco.frios.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum lead frio
                  </p>
                ) : (
                  metricas?.leadsEmRisco.frios.map(lead => (
                    <LeadRiscoCard key={lead.id} lead={lead} temperatura="frio" />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* LEADS PERDIDOS */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <div>
                <CardTitle className="text-lg">Leads Perdidos</CardTitle>
                <CardDescription>{metricas?.perdidos.total || 0} leads perdidos no período</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : metricas?.perdidos.porMotivo && metricas.perdidos.porMotivo.length > 0 ? (
              <div className="space-y-4">
                {metricas.perdidos.porMotivo.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{item.motivo}</span>
                      <span className="text-muted-foreground">{item.quantidade} ({item.percentual.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all" 
                        style={{ width: `${item.percentual}%`, backgroundColor: item.cor }}
                      />
                    </div>
                  </div>
                ))}
                
                {/* Insight */}
                {metricas.perdidos.porMotivo[0] && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm">
                      💡 <strong>Insight:</strong> {metricas.perdidos.porMotivo[0].percentual.toFixed(0)}% dos leads foram perdidos por "{metricas.perdidos.porMotivo[0].motivo.toLowerCase()}". 
                      Considere revisar a estratégia para reduzir essas perdas.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                Nenhum lead perdido no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================ */}
      {/* CONTRATOS PENDENTES */}
      {/* ============================================ */}
      {metricas?.contratosPendentes && metricas.contratosPendentes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-500" />
                <div>
                  <CardTitle className="text-lg">Contratos Aguardando Assinatura</CardTitle>
                  <CardDescription>{metricas.contratosPendentes.length} contratos enviados aguardando associado</CardDescription>
                </div>
              </div>
              <Link to="/vendas/contratos?status=pendente">
                <Button variant="ghost" size="sm">Ver todos</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {metricas.contratosPendentes.slice(0, 6).map(contrato => (
                <div key={contrato.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="font-medium text-sm">{contrato.cliente}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contrato.valor)}/mês
                      </span>
                      <span>•</span>
                      <span>{contrato.vendedor}</span>
                    </div>
                  </div>
                  <Badge 
                    variant="outline"
                    className={cn(
                      contrato.diasPendente >= 3 && "bg-red-50 text-red-700 border-red-200",
                      contrato.diasPendente === 2 && "bg-yellow-50 text-yellow-700 border-yellow-200",
                      contrato.diasPendente <= 1 && "bg-green-50 text-green-700 border-green-200"
                    )}
                  >
                    {contrato.diasPendente}d pendente
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* PERFORMANCE POR DIA DA SEMANA */}
      {/* ============================================ */}
      <Card>
        <CardHeader>
          <CardTitle>Performance por Dia da Semana</CardTitle>
          <CardDescription>Identifique os melhores dias para prospecção</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : metricas?.performanceSemana ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metricas.performanceSemana}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" />
                <YAxis />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="leads" fill="#3B82F6" name="Leads" radius={[4, 4, 0, 0]} />
                <Bar dataKey="contratos" fill="#22C55E" name="Contratos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
