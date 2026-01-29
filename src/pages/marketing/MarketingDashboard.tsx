import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Users, TrendingUp, Target, DollarSign, Calculator, UserPlus,
  Plus, Link, BarChart3, ChevronRight, Megaphone, Percent, Activity
} from 'lucide-react';
import { useMarketingStats, useEvolucaoLeads, useFunilConversao } from '@/hooks/useMarketing';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CampanhaFormDialog } from '@/components/marketing/CampanhaFormDialog';
import { IndicacaoFormDialog } from '@/components/marketing/IndicacaoFormDialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend } from 'recharts';

export default function MarketingDashboard() {
  const navigate = useNavigate();
  const [showCampanhaModal, setShowCampanhaModal] = useState(false);
  const [showIndicacaoModal, setShowIndicacaoModal] = useState(false);
  
  const { data: stats, isLoading: loadingStats } = useMarketingStats();
  const { data: evolucaoLeads, isLoading: loadingEvolucao } = useEvolucaoLeads();
  const { data: funilData, isLoading: loadingFunil } = useFunilConversao();

  // Query: Leads por origem (do mês)
  const { data: leadsPorOrigem, isLoading: loadingOrigem } = useQuery({
    queryKey: ['leads-por-origem'],
    queryFn: async () => {
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const { data } = await supabase
        .from('leads')
        .select('origem')
        .gte('created_at', inicioMes.toISOString());
      
      const contagem = new Map<string, number>();
      data?.forEach(l => {
        const origem = l.origem || 'nao_identificado';
        contagem.set(origem, (contagem.get(origem) || 0) + 1);
      });
      
      return Array.from(contagem.entries())
        .map(([origem, total]) => ({ origem, total }))
        .sort((a, b) => b.total - a.total);
    }
  });

  // Query: Top campanhas ativas com métricas
  const { data: topCampanhas, isLoading: loadingCampanhas } = useQuery({
    queryKey: ['top-campanhas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('campanhas')
        .select(`
          id, codigo, nome, status,
          metricas:campanhas_metricas(leads, conversoes, valor_gasto)
        `)
        .eq('status', 'ativa')
        .limit(5);
      
      return data?.map(c => ({
        ...c,
        totalLeads: c.metricas?.reduce((sum, m) => sum + (m.leads || 0), 0) || 0,
        totalConversoes: c.metricas?.reduce((sum, m) => sum + (m.conversoes || 0), 0) || 0,
        totalGasto: c.metricas?.reduce((sum, m) => sum + (m.valor_gasto || 0), 0) || 0
      })) || [];
    }
  });

  // Query: Indicações recentes (últimas 5)
  const { data: indicacoesRecentes } = useQuery({
    queryKey: ['indicacoes-recentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('indicacoes')
        .select('id, codigo, indicado_nome, status, data_indicacao')
        .order('data_indicacao', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    }
  });

  const origemLabels: Record<string, string> = {
    'site': 'Site',
    'indicacao': 'Indicação',
    'google_ads': 'Google Ads',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'whatsapp': 'WhatsApp',
    'telefone': 'Telefone',
    'presencial': 'Presencial',
    'outro': 'Outro',
    'nao_identificado': 'Não identificado'
  };

  const statusLabels: Record<string, string> = {
    'pendente': 'Pendente',
    'contatado': 'Contatado',
    'convertido': 'Convertido',
    'recompensado': 'Recompensado',
    'expirado': 'Expirado',
    'cancelado': 'Cancelado'
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marketing</h1>
          <p className="text-muted-foreground">
            Gerencie campanhas, canais e indicações
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/marketing/utms')}>
            <Link className="mr-2 h-4 w-4" />
            Novo UTM
          </Button>
          <Button onClick={() => setShowCampanhaModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      {/* KPIs - 8 cards em 2 linhas */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* Card 1: Leads do Mês */}
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Leads</CardTitle>
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats?.leadsMes || 0}</div>
                <p className="text-xs text-blue-600 dark:text-blue-400">Este mês</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Conversões */}
        <Card className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Conversões</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats?.conversoesMes || 0}</div>
                <p className="text-xs text-green-600 dark:text-green-400">Este mês</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Taxa Conversão */}
        <Card className="bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Taxa Conversão</CardTitle>
              <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{(stats?.taxaConversao || 0).toFixed(1)}%</div>
                <p className="text-xs text-purple-600 dark:text-purple-400">Leads para vendas</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 4: ROI */}
        <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">ROI</CardTitle>
              <Percent className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {stats?.investimentoMes > 0 
                    ? `${(((stats?.conversoesMes || 0) * 150 - (stats?.investimentoMes || 0)) / (stats?.investimentoMes || 1) * 100).toFixed(0)}%` 
                    : '—'}
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Retorno sobre investimento</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 5: Investimento */}
        <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Investimento</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  R$ {(stats?.investimentoMes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-yellow-600 dark:text-yellow-400">Este mês</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 6: CPL Médio */}
        <Card className="bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">CPL Médio</CardTitle>
              <Calculator className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  R$ {(stats?.cplMedio || 0).toFixed(2)}
                </div>
                <p className="text-xs text-orange-600 dark:text-orange-400">Custo por lead</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 7: Indicações */}
        <Card className="bg-pink-50 border-pink-200 dark:bg-pink-950/30 dark:border-pink-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-pink-700 dark:text-pink-300">Indicações</CardTitle>
              <UserPlus className="h-4 w-4 text-pink-600 dark:text-pink-400" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-pink-900 dark:text-pink-100">{stats?.indicacoesMes || 0}</div>
                <p className="text-xs text-pink-600 dark:text-pink-400">Este mês</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 8: Campanhas Ativas */}
        <Card className="bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Campanhas</CardTitle>
              <Megaphone className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{stats?.campanhasAtivas || 0}</div>
                <p className="text-xs text-cyan-600 dark:text-cyan-400">Ativas</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Evolução e Funil */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gráfico: Evolução de Leads (12 meses) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Evolução de Leads (12 meses)
            </CardTitle>
            <CardDescription>Leads e conversões por mês</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingEvolucao ? (
              <Skeleton className="h-64 w-full" />
            ) : !evolucaoLeads?.length ? (
              <p className="text-center text-muted-foreground py-12">Sem dados disponíveis</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={evolucaoLeads}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mesLabel" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    name="Leads"
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="conversoes" 
                    name="Conversões"
                    stroke="#22c55e" 
                    strokeWidth={2}
                    dot={{ fill: '#22c55e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Gráfico: Funil de Conversão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Funil de Conversão
            </CardTitle>
            <CardDescription>Distribuição de leads por etapa (mês atual)</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingFunil ? (
              <Skeleton className="h-64 w-full" />
            ) : !funilData?.length ? (
              <p className="text-center text-muted-foreground py-12">Sem dados disponíveis</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funilData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="label" type="category" width={100} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number, name: string) => [`${value} leads`, name]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="total" name="Leads" radius={[0, 4, 4, 0]}>
                    {funilData.map((entry, index) => {
                      const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#22c55e'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grid Principal - 3 colunas */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* COLUNA 1-2 (col-span-2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card: Leads por Origem */}
          <Card>
            <CardHeader>
              <CardTitle>Leads por Origem</CardTitle>
              <CardDescription>Distribuição de leads por canal no mês atual</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOrigem ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !leadsPorOrigem?.length ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum lead registrado este mês
                </p>
              ) : (
                <div className="space-y-3">
                  {leadsPorOrigem.map((item) => {
                    const maxTotal = leadsPorOrigem[0]?.total || 1;
                    const percent = (item.total / maxTotal) * 100;
                    return (
                      <div key={item.origem} className="flex items-center gap-4">
                        <span className="w-32 text-sm truncate">
                          {origemLabels[item.origem] || item.origem.replace('_', ' ')}
                        </span>
                        <Progress value={percent} className="flex-1" />
                        <span className="w-12 text-right font-medium">{item.total}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Campanhas Ativas (Tabela) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Campanhas Ativas</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/marketing/campanhas')}>
                Ver todas <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {loadingCampanhas ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !topCampanhas?.length ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma campanha ativa
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead className="text-center">Leads</TableHead>
                      <TableHead className="text-center">Conversões</TableHead>
                      <TableHead className="text-right">CPL</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCampanhas.map(campanha => (
                      <TableRow 
                        key={campanha.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/marketing/campanhas/${campanha.id}`)}
                      >
                        <TableCell>
                          <div className="font-medium">{campanha.nome}</div>
                          <div className="text-xs text-muted-foreground">{campanha.codigo}</div>
                        </TableCell>
                        <TableCell className="text-center">{campanha.totalLeads}</TableCell>
                        <TableCell className="text-center">{campanha.totalConversoes}</TableCell>
                        <TableCell className="text-right">
                          R$ {campanha.totalLeads > 0 
                            ? (campanha.totalGasto / campanha.totalLeads).toFixed(2) 
                            : '0.00'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            Ativa
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA 3 */}
        <div className="space-y-6">
          
          {/* Card: Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="justify-start" onClick={() => setShowCampanhaModal(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nova Campanha
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate('/marketing/utms')}>
                <Link className="mr-2 h-4 w-4" /> Gerar UTM
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => setShowIndicacaoModal(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Nova Indicação
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate('/vendas/relatorios')}>
                <BarChart3 className="mr-2 h-4 w-4" /> Ver Relatórios
              </Button>
            </CardContent>
          </Card>

          {/* Card: Top Origens */}
          <Card>
            <CardHeader>
              <CardTitle>Top Origens</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingOrigem ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !leadsPorOrigem?.length ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  Sem dados
                </p>
              ) : (
                <div className="space-y-1">
                  {leadsPorOrigem.slice(0, 3).map((item, idx) => (
                    <div key={item.origem} className="flex items-center gap-3 py-2">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                        idx === 0 && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
                        idx === 1 && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                        idx === 2 && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                      )}>
                        {idx + 1}º
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {origemLabels[item.origem] || item.origem.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.total} leads</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Indicações Recentes */}
          <Card>
            <CardHeader>
              <CardTitle>Indicações Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {!indicacoesRecentes?.length ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  Nenhuma indicação
                </p>
              ) : (
                <div className="space-y-1">
                  {indicacoesRecentes.map(indicacao => (
                    <div key={indicacao.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{indicacao.indicado_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {indicacao.data_indicacao && format(new Date(indicacao.data_indicacao), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant={indicacao.status === 'convertido' ? 'default' : 'outline'}>
                        {statusLabels[indicacao.status] || indicacao.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modais */}
      <CampanhaFormDialog 
        open={showCampanhaModal} 
        onClose={() => setShowCampanhaModal(false)} 
      />
      <IndicacaoFormDialog 
        open={showIndicacaoModal} 
        onClose={() => setShowIndicacaoModal(false)} 
      />
    </div>
  );
}
