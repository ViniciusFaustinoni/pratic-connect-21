import { useState } from 'react';
import { Users, FileText, CheckCircle, TrendingUp } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';
import { useCotacoes } from '@/hooks/useCotacoes';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
} from 'recharts';
import { useVendasMetricas, type Periodo } from '@/hooks/useVendasMetricas';
import { FollowupWidget } from '@/components/vendas/FollowupWidget';

const periodos: { value: Periodo; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7dias', label: '7 dias' },
  { value: '30dias', label: '30 dias' },
  { value: 'ano', label: 'Este ano' },
];

export default function DashboardVendas() {
  const [periodo, setPeriodo] = useState<Periodo>('30dias');
  const { data: metricas, isLoading } = useVendasMetricas(periodo);
  const { data: cotacoes } = useCotacoes();

  // Ranking diário de consultores
  const hoje = new Date();
  const cotacoesHoje = (cotacoes || []).filter(c => {
    const dataCotacao = new Date(c.created_at);
    return isToday(dataCotacao);
  });

  const rankingConsultores = cotacoesHoje.reduce((acc, cotacao) => {
    const vendedorId = cotacao.vendedor_id;
    const vendedorNome = cotacao.vendedor?.nome || 'Sem vendedor';
    
    if (!acc[vendedorId || 'sem']) {
      acc[vendedorId || 'sem'] = {
        id: vendedorId,
        nome: vendedorNome,
        cotacoes: 0,
        aceitas: 0
      };
    }
    acc[vendedorId || 'sem'].cotacoes++;
    if (cotacao.status === 'aceita') {
      acc[vendedorId || 'sem'].aceitas++;
    }
    return acc;
  }, {} as Record<string, { id: string | null; nome: string; cotacoes: number; aceitas: number }>);

  const rankingOrdenado = Object.values(rankingConsultores)
    .sort((a, b) => b.cotacoes - a.cotacoes)
    .slice(0, 5);

  const kpis = [
    {
      titulo: 'Leads do Mês',
      valor: metricas?.leads || 0,
      icone: Users,
      cor: 'text-blue-600',
      bgCor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      titulo: 'Cotações Enviadas',
      valor: metricas?.cotacoes || 0,
      icone: FileText,
      cor: 'text-purple-600',
      bgCor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      titulo: 'Propostas Fechadas',
      valor: metricas?.contratos || 0,
      icone: CheckCircle,
      cor: 'text-green-600',
      bgCor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      titulo: 'Taxa de Conversão',
      valor: `${metricas?.conversao?.toFixed(1) || 0}%`,
      icone: TrendingUp,
      cor: 'text-orange-600',
      bgCor: 'bg-orange-100 dark:bg-orange-900/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Vendas</h1>
          <p className="text-muted-foreground">Visão geral do desempenho comercial</p>
        </div>
      </div>

      {/* Widget de Follow-ups + Filtro de período */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {/* Filtro de período */}
          <div className="flex gap-2 mb-4">
            {periodos.map((p) => (
              <Button
                key={p.value}
                variant={periodo === p.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodo(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <FollowupWidget maxItems={4} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.titulo}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${kpi.bgCor}`}>
                  <kpi.icone className={`h-6 w-6 ${kpi.cor}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.titulo}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{kpi.valor}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ranking Diário de Consultores */}
      {rankingOrdenado.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Ranking de Hoje - {format(hoje, "dd 'de' MMMM", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-3">
              {rankingOrdenado.map((consultor, index) => (
                <div 
                  key={consultor.id || index}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border",
                    index === 0 && "bg-yellow-500/10 border-yellow-500/30",
                    index === 1 && "bg-slate-300/10 border-slate-400/30",
                    index === 2 && "bg-orange-500/10 border-orange-500/30",
                    index > 2 && "bg-muted/50"
                  )}
                >
                  <span className="font-bold text-lg w-6">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`}
                  </span>
                  <UserAvatar 
                    name={consultor.nome} 
                    size="sm"
                  />
                  <div className="text-sm">
                    <p className="font-medium">{consultor.nome}</p>
                    <p className="text-muted-foreground text-xs">
                      {consultor.cotacoes} cotação(ões)
                      {consultor.aceitas > 0 && ` • ${consultor.aceitas} aceita(s)`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos - Linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funil de Vendas */}
        <Card>
          <CardHeader>
            <CardTitle>Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : metricas?.funilData && metricas.funilData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metricas.funilData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="etapa" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="quantidade" radius={[0, 4, 4, 0]}>
                    {metricas.funilData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evolução Mensal */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : metricas?.evolucaoData && metricas.evolucaoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metricas.evolucaoData}>
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="leads"
                    stroke="#3b82f6"
                    name="Leads"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="contratos"
                    stroke="#22c55e"
                    name="Propostas"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos - Linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking de Vendedores */}
        <Card>
          <CardHeader>
            <CardTitle>Top Vendedores</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : metricas?.rankingVendedores && metricas.rankingVendedores.length > 0 ? (
              <div className="space-y-4">
                {metricas.rankingVendedores.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-4">
                    <span
                      className={`text-2xl font-bold ${
                        i === 0 ? 'text-yellow-500' : 'text-muted-foreground'
                      }`}
                    >
                      #{i + 1}
                    </span>
                    <Avatar>
                      <AvatarFallback>{v.nome.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{v.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {v.contratos} {v.contratos === 1 ? 'proposta' : 'propostas'}
                      </p>
                    </div>
                    <Badge variant="outline">
                      R$ {v.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                Nenhum vendedor com propostas no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads por Origem */}
        <Card>
          <CardHeader>
            <CardTitle>Leads por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : metricas?.origensData && metricas.origensData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={metricas.origensData}
                    dataKey="valor"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ nome, percent }) =>
                      `${nome} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {metricas.origensData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
