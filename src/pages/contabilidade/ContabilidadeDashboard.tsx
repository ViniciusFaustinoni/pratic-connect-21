import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, TrendingUp, TrendingDown, Calculator,
  FileText, BarChart3, Plus, Lock, Unlock, Calendar,
  ChevronRight, FolderTree, Search, Building2, Landmark, Scale,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts';
import { useSaldosAcumulados, useReceitaDespesaMensal, useComposicaoAtivo, useFechamentos } from '@/hooks/useContabilidade';
import { AlertasContabeis, type AlertaContabil } from '@/components/contabilidade';
import { cn } from '@/lib/utils';

const CHART_COLORS = [
  'hsl(220, 70%, 50%)', 'hsl(160, 60%, 45%)', 'hsl(45, 90%, 55%)',
  'hsl(280, 60%, 55%)', 'hsl(0, 70%, 55%)', 'hsl(200, 70%, 50%)',
];

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function ContabilidadeDashboard() {
  const navigate = useNavigate();
  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  const { data: saldos } = useSaldosAcumulados(mesAtual, anoAtual);
  const { data: recDesp } = useReceitaDespesaMensal(anoAtual);
  const { data: composicaoAtivo } = useComposicaoAtivo(mesAtual, anoAtual);
  const { data: fechamentos } = useFechamentos(anoAtual);

  // Despesas por natureza
  const { data: despesasPorNatureza } = useQuery({
    queryKey: ['despesas-natureza-dashboard', anoAtual],
    queryFn: async () => {
      const { data: partidas } = await supabase
        .from('lancamentos_partidas')
        .select(`
          valor,
          conta:plano_contas!inner(codigo, descricao, tipo),
          lancamento:lancamento_id!inner(data_competencia, status)
        `)
        .eq('tipo', 'debito')
        .eq('conta.tipo', 'despesa')
        .eq('lancamento.status', 'ativo')
        .gte('lancamento.data_competencia', `${anoAtual}-01-01`)
        .lte('lancamento.data_competencia', `${anoAtual}-12-31`);

      const grupos: Record<string, number> = {};
      (partidas as any[] || []).forEach((p: any) => {
        const codigo = p.conta.codigo;
        let grupo = 'Outras';
        if (codigo.startsWith('5.1.01') || codigo.startsWith('5.1.02') || codigo.startsWith('5.8') || codigo.startsWith('5.9')) grupo = 'Benefícios/Sinistros';
        else if (codigo.startsWith('5.1.03')) grupo = 'Pessoal';
        else if (codigo.startsWith('5.1.04') || codigo.startsWith('5.2')) grupo = 'Administrativas/Tecnologia';
        else if (codigo.startsWith('5.1.05')) grupo = 'Financeiras';
        else if (codigo.startsWith('5.3')) grupo = 'Jurídicas';
        else if (codigo.startsWith('5.4')) grupo = 'Marketing';
        else if (codigo.startsWith('5.5')) grupo = 'Tributárias';
        else if (codigo.startsWith('5.6')) grupo = 'Depreciação';
        else if (codigo.startsWith('5.7')) grupo = 'Provisões';
        grupos[grupo] = (grupos[grupo] || 0) + Number(p.valor);
      });

      return Object.entries(grupos)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    },
  });

  // Últimos lançamentos
  const { data: ultimosLancamentos } = useQuery({
    queryKey: ['ultimos-lancamentos-dash'],
    queryFn: async () => {
      const { data } = await supabase
        .from('lancamentos_contabeis')
        .select(`*, partidas:lancamentos_partidas(tipo, valor, conta:plano_contas(codigo, descricao))`)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Evolução PL mensal (calculado a partir do resultado mensal)
  const evolucaoPL = useMemo(() => {
    if (!recDesp || !saldos) return [];
    let plBase = saldos.patrimonioSocial - saldos.resultadoExercicio;
    return recDesp.map((m, i) => {
      const resultado = m.receitas - m.despesas;
      plBase += resultado;
      return { mes: MESES_CURTO[i], pl: plBase };
    });
  }, [recDesp, saldos]);

  // Alertas
  const alertas = useMemo<AlertaContabil[]>(() => {
    const result: AlertaContabil[] = [];
    if (saldos && saldos.resultadoExercicio < 0) {
      result.push({ tipo: 'vermelho', mensagem: `Resultado do exercício deficitário: ${formatCurrency(saldos.resultadoExercicio)}` });
    }
    // Mês anterior sem fechar
    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
    const fechado = fechamentos?.find(f => f.mes === mesAnterior && f.status === 'fechado');
    if (!fechado && mesAtual > 1) {
      result.push({ tipo: 'amarelo', mensagem: `Período anterior (${MESES_CURTO[mesAnterior - 1]}) ainda não foi fechado.` });
    }
    return result;
  }, [saldos, fechamentos, mesAtual]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const barData = recDesp?.map((m, i) => ({
    name: MESES_CURTO[i],
    Receitas: m.receitas,
    Despesas: m.despesas,
  })) || [];

  const calcTotais = (partidas: any[]) => {
    let d = 0, c = 0;
    partidas?.forEach(p => { if (p.tipo === 'debito') d += p.valor; else c += p.valor; });
    return { d, c };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Contabilidade
          </h1>
          <p className="text-muted-foreground capitalize">
            {format(new Date(anoAtual, mesAtual - 1), "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/contabilidade/lancamentos/novo')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lançamento
          </Button>
          <Button variant="outline" onClick={() => navigate('/contabilidade/fechamentos')}>
            <Calendar className="h-4 w-4 mr-2" />
            Fechamentos
          </Button>
        </div>
      </div>

      {/* Alertas */}
      <AlertasContabeis alertas={alertas} />

      {/* 6 KPIs */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Ativo Total</span>
              <Building2 className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-lg font-bold">{formatCurrency(saldos?.ativoTotal || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Passivo Total</span>
              <Landmark className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-lg font-bold">{formatCurrency(saldos?.passivoTotal || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Patrimônio Social</span>
              <Scale className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-lg font-bold">{formatCurrency(saldos?.patrimonioSocial || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Receita (ano)</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-lg font-bold text-green-600">{formatCurrency(saldos?.receitaAno || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Despesa (ano)</span>
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(saldos?.despesaAno || 0)}</p>
          </CardContent>
        </Card>
        <Card className={cn('border-l-4', (saldos?.resultadoExercicio || 0) >= 0 ? 'border-l-green-600' : 'border-l-red-600')}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Resultado</span>
              <Calculator className={cn('h-4 w-4', (saldos?.resultadoExercicio || 0) >= 0 ? 'text-green-600' : 'text-red-600')} />
            </div>
            <p className={cn('text-lg font-bold', (saldos?.resultadoExercicio || 0) >= 0 ? 'text-green-600' : 'text-red-600')}>
              {formatCurrency(saldos?.resultadoExercicio || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {(saldos?.resultadoExercicio || 0) >= 0 ? 'Superávit' : 'Déficit'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Receita vs Despesa por Mês */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita vs Despesa por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.some(d => d.Receitas > 0 || d.Despesas > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="Receitas" fill="hsl(142, 71%, 45%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Despesas" fill="hsl(0, 84%, 60%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                <BarChart3 className="h-8 w-8 mr-2 opacity-50" />
                Sem movimentação no ano
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composição do Ativo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Composição do Ativo</CardTitle>
          </CardHeader>
          <CardContent>
            {composicaoAtivo && composicaoAtivo.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={composicaoAtivo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                    {composicaoAtivo.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Composição das Despesas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Composição das Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            {despesasPorNatureza && despesasPorNatureza.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={despesasPorNatureza} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                    {despesasPorNatureza.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Evolução do Patrimônio Social */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução do Patrimônio Social</CardTitle>
          </CardHeader>
          <CardContent>
            {evolucaoPL.some(p => p.pl !== 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={evolucaoPL}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="pl" stroke="hsl(280, 60%, 55%)" strokeWidth={2} name="Patrimônio Social" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links + Últimos Lançamentos */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Últimos Lançamentos</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contabilidade/lancamentos">Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {!ultimosLancamentos || ultimosLancamentos.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum lançamento</p>
              ) : (
                <div className="space-y-2">
                  {ultimosLancamentos.map((l: any) => {
                    const t = calcTotais(l.partidas || []);
                    return (
                      <div key={l.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/contabilidade/lancamentos/${l.id}`)}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{l.historico}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(l.data_competencia), 'dd/MM/yyyy')} · {l.origem}</p>
                        </div>
                        <span className="text-sm font-medium ml-4">{formatCurrency(t.d)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Novo Lançamento', icon: Plus, to: '/contabilidade/lancamentos/novo' },
              { label: 'Balancete', icon: BarChart3, to: '/contabilidade/balancete' },
              { label: 'DRE', icon: TrendingUp, to: '/contabilidade/dre' },
              { label: 'Balanço Patrimonial', icon: Scale, to: '/contabilidade/balanco' },
              { label: 'Plano de Contas', icon: FolderTree, to: '/contabilidade/plano-contas' },
              { label: 'Razão da Conta', icon: Search, to: '/contabilidade/razao' },
            ].map(({ label, icon: Icon, to }) => (
              <Button key={to} variant="outline" className="w-full justify-start" onClick={() => navigate(to)}>
                <Icon className="h-4 w-4 mr-2" />{label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
