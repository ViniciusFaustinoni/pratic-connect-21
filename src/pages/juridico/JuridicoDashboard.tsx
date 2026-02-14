import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Scale, Clock, Calendar, HelpCircle, Plus, AlertTriangle, 
  ChevronRight, FileText, Users, CheckCircle, Gavel, DollarSign,
  Briefcase, AlertCircle, ShieldAlert, Building2, CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, isPast, isToday, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useProcessosPrazos } from '@/hooks/useProcessosPrazos';
import { NovaConsultaModal } from '@/components/juridico/NovaConsultaModal';
import { 
  GraficoProcessosPorTipo, 
  GraficoProcessosPorStatus,
  ValorEmDisputaCard 
} from '@/components/juridico/GraficosJuridico';
import { 
  PRIORIDADE_COLORS, 
  PRIORIDADE_LABELS,
  TIPO_AUDIENCIA_LABELS,
  TIPO_ANDAMENTO_LABELS
} from '@/types/juridico';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function JuridicoDashboard() {
  const navigate = useNavigate();
  const [novaConsultaOpen, setNovaConsultaOpen] = useState(false);
  const { cumprirPrazo, isCumprindo } = useProcessosPrazos();

  // ==========================================
  // SEÇÃO 1: KPIs DE CASOS (EVENTOS)
  // ==========================================

  const { data: casosStats, isLoading: loadingCasosStats } = useQuery({
    queryKey: ['juridico-casos-stats'],
    queryFn: async () => {
      const agora = new Date();
      const inicioMes = startOfMonth(agora).toISOString();
      const fimMes = endOfMonth(agora).toISOString();
      const inicioAno = startOfYear(agora).toISOString();

      const [
        consultasAbertas, consultasPendentes, processosAbertos,
        fraudesAno, aguardandoDiretoria, consultasFinalizadasMes, processosFinalizadosMes
      ] = await Promise.all([
        supabase.from('consultas_juridicas').select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null).in('status', ['pendente', 'em_analise']),
        supabase.from('consultas_juridicas').select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null).eq('status', 'pendente'),
        supabase.from('processos').select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null).eq('status', 'ativo'),
        supabase.from('processos').select('*', { count: 'exact', head: true })
          .eq('tipo', 'sindicancia_fraude').gte('created_at', inicioAno),
        supabase.from('sinistros').select('*', { count: 'exact', head: true })
          .eq('status', 'suspenso').eq('resultado_sindicancia', 'inconclusivo'),
        supabase.from('consultas_juridicas').select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null).eq('status', 'respondida')
          .gte('respondido_em', inicioMes).lte('respondido_em', fimMes),
        supabase.from('processos').select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null).in('status', ['encerrado', 'arquivado', 'acordo', 'ganho', 'perdido'])
          .gte('updated_at', inicioMes).lte('updated_at', fimMes),
      ]);

      return {
        casosAbertos: (consultasAbertas.count || 0) + (processosAbertos.count || 0),
        aguardandoParecer: consultasPendentes.count || 0,
        fraudesAno: fraudesAno.count || 0,
        aguardandoDiretoria: aguardandoDiretoria.count || 0,
        finalizadosMes: (consultasFinalizadasMes.count || 0) + (processosFinalizadosMes.count || 0),
      };
    },
  });

  // Dados para gráfico de rosca (tipos de casos abertos)
  const { data: casosPorTipo = [] } = useQuery({
    queryKey: ['juridico-casos-tipo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('consultas_juridicas')
        .select('assunto')
        .not('sinistro_id', 'is', null)
        .in('status', ['pendente', 'em_analise']);
      
      const { data: procs } = await supabase
        .from('processos')
        .select('tipo')
        .not('sinistro_id', 'is', null)
        .eq('status', 'ativo');

      const counts: Record<string, number> = {};
      const classify = (assunto: string, tipo?: string) => {
        if (tipo === 'sindicancia_fraude' || /fraude/i.test(assunto)) return 'Fraude';
        if (/carta de cancelamento/i.test(assunto)) return 'Carta Cancel.';
        if (/encaminhamento jur/i.test(assunto)) return 'Questão Legal';
        if (/indeniza/i.test(assunto)) return 'Indenização';
        if (/alagamento|inc[êe]ndio/i.test(assunto)) return 'Análise Técnica';
        return 'Outro';
      };

      (data || []).forEach(c => {
        const tipo = classify(c.assunto);
        counts[tipo] = (counts[tipo] || 0) + 1;
      });
      (procs || []).forEach(p => {
        const tipo = classify(p.tipo || '', p.tipo);
        counts[tipo] = (counts[tipo] || 0) + 1;
      });

      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  // Dados para gráfico de barras (evolução mensal 6 meses)
  const { data: evolucaoMensal = [] } = useQuery({
    queryKey: ['juridico-casos-evolucao'],
    queryFn: async () => {
      const meses: { label: string; inicio: string; fim: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const inicio = startOfMonth(d).toISOString();
        const fim = endOfMonth(d).toISOString();
        meses.push({ label: format(d, 'MMM', { locale: ptBR }), inicio, fim });
      }

      const results = await Promise.all(meses.map(async m => {
        const { count: c1 } = await supabase.from('consultas_juridicas')
          .select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null)
          .gte('created_at', m.inicio).lte('created_at', m.fim);
        const { count: c2 } = await supabase.from('processos')
          .select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null)
          .gte('created_at', m.inicio).lte('created_at', m.fim);
        return { mes: m.label, total: (c1 || 0) + (c2 || 0) };
      }));
      return results;
    },
  });

  // Casos urgentes
  const { data: casosUrgentes = [] } = useQuery({
    queryKey: ['juridico-casos-urgentes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('consultas_juridicas')
        .select('id, assunto, prioridade, status, created_at')
        .not('sinistro_id', 'is', null)
        .in('prioridade', ['alta', 'urgente'])
        .in('status', ['pendente', 'em_analise'])
        .order('created_at', { ascending: false })
        .limit(6);
      return data || [];
    },
  });

  // ==========================================
  // SEÇÃO 2: DASHBOARD EXISTENTE (PROCESSOS)
  // ==========================================

  const { data: todosProcessos = [] } = useQuery({
    queryKey: ['processos-graficos'],
    queryFn: async () => {
      const { data } = await supabase.from('processos').select('id, tipo, status, natureza, valor_causa');
      return data || [];
    },
  });

  const valoresDisputa = {
    valorRisco: todosProcessos.filter(p => p.natureza === 'reu' && p.status === 'ativo').reduce((sum, p) => sum + (p.valor_causa || 0), 0),
    valorAReceber: todosProcessos.filter(p => p.natureza === 'autor' && p.status === 'ativo').reduce((sum, p) => sum + (p.valor_causa || 0), 0),
    processosPassivos: todosProcessos.filter(p => p.natureza === 'reu' && p.status === 'ativo').length,
    processosAtivos: todosProcessos.filter(p => p.natureza === 'autor' && p.status === 'ativo').length,
  };

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['juridico-stats'],
    queryFn: async () => {
      const dataLimite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hoje = new Date().toISOString().split('T')[0];
      const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const fimMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      const [processosRes, prazosRes, prazosHoje, prazosAmanha, prazosVencidos, audienciasRes, consultasRes] = await Promise.all([
        supabase.from('processos').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('processos_prazos').select('*', { count: 'exact', head: true }).eq('status', 'pendente').lte('data_fim', dataLimite),
        supabase.from('processos_prazos').select('*', { count: 'exact', head: true }).eq('status', 'pendente').eq('data_fim', hoje),
        supabase.from('processos_prazos').select('*', { count: 'exact', head: true }).eq('status', 'pendente').eq('data_fim', amanha),
        supabase.from('processos_prazos').select('*', { count: 'exact', head: true }).eq('status', 'pendente').lt('data_fim', hoje),
        supabase.from('processos_audiencias').select('*', { count: 'exact', head: true }).gte('data_hora', inicioMes.toISOString()).lte('data_hora', fimMes.toISOString()),
        supabase.from('consultas_juridicas').select('*', { count: 'exact', head: true }).in('status', ['pendente', 'em_analise']),
      ]);

      return {
        processosAtivos: processosRes.count || 0,
        prazosProximos: prazosRes.count || 0,
        prazosHoje: prazosHoje.count || 0,
        prazosAmanha: prazosAmanha.count || 0,
        prazosVencidos: prazosVencidos.count || 0,
        audienciasMes: audienciasRes.count || 0,
        consultasPendentes: consultasRes.count || 0,
      };
    },
  });

  const { data: prazosUrgentes = [] } = useQuery({
    queryKey: ['prazos-urgentes'],
    queryFn: async () => {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() + 3);
      const { data } = await supabase.from('processos_prazos')
        .select(`*, processo:processos(numero, numero_processo, parte_contraria_nome)`)
        .eq('status', 'pendente').lte('data_fim', dataLimite.toISOString().split('T')[0]).order('data_fim');
      return data || [];
    },
  });

  const { data: proximasAudiencias = [] } = useQuery({
    queryKey: ['proximas-audiencias'],
    queryFn: async () => {
      const { data } = await supabase.from('processos_audiencias')
        .select(`*, processo:processos(numero, parte_contraria_nome)`)
        .eq('status', 'agendada').gte('data_hora', new Date().toISOString()).order('data_hora').limit(5);
      return data || [];
    },
  });

  const { data: consultasPendentes = [] } = useQuery({
    queryKey: ['consultas-pendentes-lista'],
    queryFn: async () => {
      const { data } = await supabase.from('consultas_juridicas').select('*')
        .in('status', ['pendente', 'em_analise']).order('created_at', { ascending: false }).limit(5);
      return data || [];
    },
  });

  const { data: ultimosAndamentos = [] } = useQuery({
    queryKey: ['ultimos-andamentos'],
    queryFn: async () => {
      const { data } = await supabase.from('processos_andamentos')
        .select(`*, processo:processos(numero, parte_contraria_nome)`)
        .order('created_at', { ascending: false }).limit(5);
      return data || [];
    },
  });

  const getUrgenciaBadge = (dataFim: string) => {
    const dias = differenceInDays(new Date(dataFim), new Date());
    if (dias < 0) return <Badge variant="destructive">Vencido</Badge>;
    if (dias === 0) return <Badge variant="destructive">Hoje</Badge>;
    if (dias === 1) return <Badge className="bg-orange-500 hover:bg-orange-600">Amanhã</Badge>;
    if (dias <= 3) return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">Próximo</Badge>;
    return <Badge variant="secondary">{dias} dias</Badge>;
  };

  const prazosVencidos = prazosUrgentes.filter(p => isPast(new Date(p.data_fim)) && !isToday(new Date(p.data_fim)));
  const prazosHoje = prazosUrgentes.filter(p => isToday(new Date(p.data_fim)));

  const handleCumprirPrazo = (prazoId: string) => {
    cumprirPrazo({ id: prazoId, observacao: 'Cumprido via dashboard' });
  };

  const PIE_COLORS = ['#ef4444', '#f97316', '#8b5cf6', '#3b82f6', '#eab308', '#6b7280'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jurídico</h1>
          <p className="text-muted-foreground">Gestão de casos, processos, prazos e consultas jurídicas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/juridico/processos/novo')}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Processo
          </Button>
          <Button variant="outline" onClick={() => setNovaConsultaOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Consulta
          </Button>
        </div>
      </div>

      {/* Alerta de prazos vencidos */}
      {(prazosVencidos.length > 0 || prazosHoje.length > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {prazosVencidos.length > 0 && `${prazosVencidos.length} prazo(s) vencido(s). `}
              {prazosHoje.length > 0 && `${prazosHoje.length} prazo(s) vencendo hoje!`}
            </span>
            <Link to="/juridico/prazos" className="underline hover:no-underline">Ver todos</Link>
          </AlertDescription>
        </Alert>
      )}

      {/* ==========================================
          CASOS DE EVENTOS — KPIs
          ========================================== */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Abertos</CardTitle>
            <Briefcase className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {loadingCasosStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{casosStats?.casosAbertos || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">consultas + processos de eventos</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${(casosStats?.aguardandoParecer || 0) > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Parecer</CardTitle>
            <AlertCircle className={`h-4 w-4 ${(casosStats?.aguardandoParecer || 0) > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            {loadingCasosStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{casosStats?.aguardandoParecer || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">advogado ainda não analisou</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraudes este Ano</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {loadingCasosStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{casosStats?.fraudesAno || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">sindicâncias com fraude comprovada</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Diretoria</CardTitle>
            <Building2 className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {loadingCasosStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{casosStats?.aguardandoDiretoria || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">inconclusivos pendentes</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalizados (mês)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loadingCasosStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{casosStats?.finalizadosMes || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">encerrados este mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Casos */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {casosPorTipo.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={casosPorTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {casosPorTipo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {casosPorTipo.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span>{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução Mensal (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {evolucaoMensal.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Casos Urgentes */}
      {casosUrgentes.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Casos Urgentes
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/juridico/casos">Ver todos <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {casosUrgentes.map((caso: any) => (
                <Link key={caso.id} to={`/juridico/consultas/${caso.id}`} className="block">
                  <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors space-y-2">
                    <p className="text-sm font-medium line-clamp-1">{caso.assunto}</p>
                    <div className="flex items-center justify-between">
                      <Badge className={caso.prioridade === 'urgente' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}>
                        {caso.prioridade}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {differenceInDays(new Date(), new Date(caso.created_at))}d aberto
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Separador */}
      <div className="flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Processos Judiciais</span>
        <Separator className="flex-1" />
      </div>

      {/* Cards KPI Existentes */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processos Ativos</CardTitle>
            <Scale className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{stats?.processosAtivos || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Passivos: {valoresDisputa.processosPassivos} | Ativos: {valoresDisputa.processosAtivos}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${(stats?.prazosProximos || 0) > 0 ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazos (7 dias)</CardTitle>
            <Clock className={`h-4 w-4 ${(stats?.prazosProximos || 0) > 0 ? 'text-red-500' : 'text-yellow-500'}`} />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{stats?.prazosProximos || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Hoje: {stats?.prazosHoje || 0} | Amanhã: {stats?.prazosAmanha || 0}
                  {(stats?.prazosVencidos || 0) > 0 && (
                    <span className="text-destructive font-medium"> | {stats?.prazosVencidos} vencido(s)!</span>
                  )}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audiências (mês)</CardTitle>
            <Calendar className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{stats?.audienciasMes || 0}</div>
                <p className="text-xs text-muted-foreground">audiências agendadas</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consultas Pendentes</CardTitle>
            <HelpCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{stats?.consultasPendentes || 0}</div>
                <p className="text-xs text-muted-foreground">aguardando parecer</p>
              </>
            )}
          </CardContent>
        </Card>

        <ValorEmDisputaCard {...valoresDisputa} />
      </div>

      {/* Gráficos de Processos */}
      <div className="grid gap-4 md:grid-cols-2">
        <GraficoProcessosPorTipo processos={todosProcessos} />
        <GraficoProcessosPorStatus processos={todosProcessos} />
      </div>

      {/* Grid principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Prazos próximos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Prazos Próximos</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/juridico/prazos">Ver todos <ChevronRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {prazosUrgentes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum prazo nos próximos 3 dias</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Processo</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Urgência</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prazosUrgentes.slice(0, 5).map((prazo: any) => (
                      <TableRow key={prazo.id}>
                        <TableCell className="font-medium">{prazo.processo?.numero || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{prazo.descricao}</TableCell>
                        <TableCell>{format(new Date(prazo.data_fim), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                        <TableCell>{getUrgenciaBadge(prazo.data_fim)}</TableCell>
                        <TableCell>
                          <Badge className={PRIORIDADE_COLORS[prazo.prioridade as keyof typeof PRIORIDADE_COLORS]}>
                            {PRIORIDADE_LABELS[prazo.prioridade as keyof typeof PRIORIDADE_LABELS]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleCumprirPrazo(prazo.id)} disabled={isCumprindo}>
                            <CheckCircle className="mr-1 h-3 w-3" />Cumprir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Últimos andamentos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Últimos Andamentos</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/juridico/processos">Ver todos <ChevronRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {ultimosAndamentos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum andamento registrado</p>
              ) : (
                <div className="space-y-4">
                  {ultimosAndamentos.map((andamento: any) => (
                    <div key={andamento.id} className="flex items-start gap-4 border-b pb-4 last:border-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <Gavel className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{andamento.processo?.numero || 'Processo'}</p>
                          <span className="text-xs text-muted-foreground">{format(new Date(andamento.data), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{andamento.descricao}</p>
                        {andamento.tipo && (
                          <Badge variant="outline" className="text-xs">
                            {TIPO_ANDAMENTO_LABELS[andamento.tipo as keyof typeof TIPO_ANDAMENTO_LABELS] || andamento.tipo}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3 */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-5 w-5" />Próximas Audiências</CardTitle>
            </CardHeader>
            <CardContent>
              {proximasAudiencias.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma audiência agendada</p>
              ) : (
                <div className="space-y-3">
                  {proximasAudiencias.map((audiencia: any) => (
                    <div key={audiencia.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{format(new Date(audiencia.data_hora), 'dd/MM', { locale: ptBR })}</span>
                        <span className="text-sm text-muted-foreground">{format(new Date(audiencia.data_hora), 'HH:mm', { locale: ptBR })}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {TIPO_AUDIENCIA_LABELS[audiencia.tipo as keyof typeof TIPO_AUDIENCIA_LABELS] || audiencia.tipo}
                      </Badge>
                      <p className="text-sm text-muted-foreground">{audiencia.processo?.numero}</p>
                      {audiencia.local && <p className="text-xs text-muted-foreground truncate">{audiencia.local}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Ações Rápidas</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="justify-start" onClick={() => navigate('/juridico/casos')}>
                <Briefcase className="mr-2 h-4 w-4" />Ver Casos
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate('/juridico/processos/novo')}>
                <Plus className="mr-2 h-4 w-4" />Novo Processo
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => setNovaConsultaOpen(true)}>
                <HelpCircle className="mr-2 h-4 w-4" />Nova Consulta
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate('/juridico/prazos')}>
                <Clock className="mr-2 h-4 w-4" />Ver Prazos
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><HelpCircle className="h-5 w-5" />Consultas Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              {consultasPendentes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma consulta pendente</p>
              ) : (
                <div className="space-y-3">
                  {consultasPendentes.map((consulta: any) => (
                    <div key={consulta.id} className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium line-clamp-1">{consulta.assunto}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{format(new Date(consulta.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        <Button size="sm" variant="link" className="h-auto p-0 text-xs" asChild>
                          <Link to={`/juridico/consultas/${consulta.id}`}>Responder</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <NovaConsultaModal open={novaConsultaOpen} onClose={() => setNovaConsultaOpen(false)} />
    </div>
  );
}
