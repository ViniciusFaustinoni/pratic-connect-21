import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Scale, Clock, Calendar, HelpCircle, Plus, AlertTriangle, 
  ChevronRight, FileText, Users, CheckCircle, Gavel, DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
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

export default function JuridicoDashboard() {
  const navigate = useNavigate();
  const [novaConsultaOpen, setNovaConsultaOpen] = useState(false);
  const { cumprirPrazo, isCumprindo } = useProcessosPrazos();

  // Buscar todos os processos para gráficos
  const { data: todosProcessos = [] } = useQuery({
    queryKey: ['processos-graficos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('processos')
        .select('id, tipo, status, natureza, valor_causa');
      return data || [];
    }
  });

  // Calcular valores em disputa
  const valoresDisputa = {
    valorRisco: todosProcessos
      .filter(p => p.natureza === 'reu' && p.status === 'ativo')
      .reduce((sum, p) => sum + (p.valor_causa || 0), 0),
    valorAReceber: todosProcessos
      .filter(p => p.natureza === 'autor' && p.status === 'ativo')
      .reduce((sum, p) => sum + (p.valor_causa || 0), 0),
    processosPassivos: todosProcessos.filter(p => p.natureza === 'reu' && p.status === 'ativo').length,
    processosAtivos: todosProcessos.filter(p => p.natureza === 'autor' && p.status === 'ativo').length,
  };

  // Estatísticas gerais
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['juridico-stats'],
    queryFn: async () => {
      const dataLimite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hoje = new Date().toISOString().split('T')[0];
      const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const fimMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      const [processosRes, prazosRes, prazosHoje, prazosAmanha, prazosVencidos, audienciasRes, consultasRes] = await Promise.all([
        supabase
          .from('processos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'ativo'),
        supabase
          .from('processos_prazos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pendente')
          .lte('data_fim', dataLimite),
        supabase
          .from('processos_prazos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pendente')
          .eq('data_fim', hoje),
        supabase
          .from('processos_prazos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pendente')
          .eq('data_fim', amanha),
        supabase
          .from('processos_prazos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pendente')
          .lt('data_fim', hoje),
        supabase
          .from('processos_audiencias')
          .select('*', { count: 'exact', head: true })
          .gte('data_hora', inicioMes.toISOString())
          .lte('data_hora', fimMes.toISOString()),
        supabase
          .from('consultas_juridicas')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pendente', 'em_analise'])
      ]);

      return {
        processosAtivos: processosRes.count || 0,
        prazosProximos: prazosRes.count || 0,
        prazosHoje: prazosHoje.count || 0,
        prazosAmanha: prazosAmanha.count || 0,
        prazosVencidos: prazosVencidos.count || 0,
        audienciasMes: audienciasRes.count || 0,
        consultasPendentes: consultasRes.count || 0
      };
    }
  });

  // Prazos urgentes (próximos 3 dias)
  const { data: prazosUrgentes = [] } = useQuery({
    queryKey: ['prazos-urgentes'],
    queryFn: async () => {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() + 3);

      const { data } = await supabase
        .from('processos_prazos')
        .select(`
          *,
          processo:processos(numero, numero_processo, parte_contraria_nome)
        `)
        .eq('status', 'pendente')
        .lte('data_fim', dataLimite.toISOString().split('T')[0])
        .order('data_fim');
      return data || [];
    }
  });

  // Próximas audiências
  const { data: proximasAudiencias = [] } = useQuery({
    queryKey: ['proximas-audiencias'],
    queryFn: async () => {
      const { data } = await supabase
        .from('processos_audiencias')
        .select(`
          *,
          processo:processos(numero, parte_contraria_nome)
        `)
        .eq('status', 'agendada')
        .gte('data_hora', new Date().toISOString())
        .order('data_hora')
        .limit(5);
      return data || [];
    }
  });

  // Consultas pendentes
  const { data: consultasPendentes = [] } = useQuery({
    queryKey: ['consultas-pendentes-lista'],
    queryFn: async () => {
      const { data } = await supabase
        .from('consultas_juridicas')
        .select('*')
        .in('status', ['pendente', 'em_analise'])
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    }
  });

  // Últimos andamentos
  const { data: ultimosAndamentos = [] } = useQuery({
    queryKey: ['ultimos-andamentos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('processos_andamentos')
        .select(`
          *,
          processo:processos(numero, parte_contraria_nome)
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    }
  });

  // Helpers
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jurídico</h1>
          <p className="text-muted-foreground">
            Gestão de processos, prazos e consultas jurídicas
          </p>
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
            <Link to="/juridico/prazos" className="underline hover:no-underline">
              Ver todos
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Cards KPI - Linha 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processos Ativos</CardTitle>
            <Scale className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
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
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
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
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
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
            {loadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.consultasPendentes || 0}</div>
                <p className="text-xs text-muted-foreground">aguardando parecer</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card Valor em Disputa */}
        <ValorEmDisputaCard {...valoresDisputa} />
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        <GraficoProcessosPorTipo processos={todosProcessos} />
        <GraficoProcessosPorStatus processos={todosProcessos} />
      </div>

      {/* Grid principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna 1-2 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Prazos próximos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Prazos Próximos
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/juridico/prazos">
                  Ver todos <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {prazosUrgentes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum prazo nos próximos 3 dias
                </p>
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
                        <TableCell className="font-medium">
                          {prazo.processo?.numero || '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {prazo.descricao}
                        </TableCell>
                        <TableCell>
                          {format(new Date(prazo.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {getUrgenciaBadge(prazo.data_fim)}
                        </TableCell>
                        <TableCell>
                          <Badge className={PRIORIDADE_COLORS[prazo.prioridade as keyof typeof PRIORIDADE_COLORS]}>
                            {PRIORIDADE_LABELS[prazo.prioridade as keyof typeof PRIORIDADE_LABELS]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCumprirPrazo(prazo.id)}
                            disabled={isCumprindo}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Cumprir
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
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Últimos Andamentos
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/juridico/processos">
                  Ver todos <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {ultimosAndamentos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum andamento registrado
                </p>
              ) : (
                <div className="space-y-4">
                  {ultimosAndamentos.map((andamento: any) => (
                    <div key={andamento.id} className="flex items-start gap-4 border-b pb-4 last:border-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <Gavel className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {andamento.processo?.numero || 'Processo'}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(andamento.data), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {andamento.descricao}
                        </p>
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
          {/* Próximas audiências */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5" />
                Próximas Audiências
              </CardTitle>
            </CardHeader>
            <CardContent>
              {proximasAudiencias.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma audiência agendada
                </p>
              ) : (
                <div className="space-y-3">
                  {proximasAudiencias.map((audiencia: any) => (
                    <div key={audiencia.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {format(new Date(audiencia.data_hora), 'dd/MM', { locale: ptBR })}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(audiencia.data_hora), 'HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {TIPO_AUDIENCIA_LABELS[audiencia.tipo as keyof typeof TIPO_AUDIENCIA_LABELS] || audiencia.tipo}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {audiencia.processo?.numero}
                      </p>
                      {audiencia.local && (
                        <p className="text-xs text-muted-foreground truncate">
                          {audiencia.local}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ações rápidas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="justify-start" onClick={() => navigate('/juridico/processos/novo')}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Processo
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => setNovaConsultaOpen(true)}>
                <HelpCircle className="mr-2 h-4 w-4" />
                Nova Consulta
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate('/juridico/prazos')}>
                <Clock className="mr-2 h-4 w-4" />
                Ver Prazos
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate('/juridico/processos')}>
                <Scale className="mr-2 h-4 w-4" />
                Ver Processos
              </Button>
            </CardContent>
          </Card>

          {/* Consultas pendentes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="h-5 w-5" />
                Consultas Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {consultasPendentes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma consulta pendente
                </p>
              ) : (
                <div className="space-y-3">
                  {consultasPendentes.map((consulta: any) => (
                    <div key={consulta.id} className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium line-clamp-1">
                        {consulta.assunto}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(consulta.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        <Button size="sm" variant="link" className="h-auto p-0 text-xs" asChild>
                          <Link to={`/juridico/consultas/${consulta.id}`}>
                            Responder
                          </Link>
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

      {/* Modal Nova Consulta */}
      <NovaConsultaModal
        open={novaConsultaOpen}
        onClose={() => setNovaConsultaOpen(false)}
      />
    </div>
  );
}
