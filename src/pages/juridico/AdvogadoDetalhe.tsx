import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays, subMonths, startOfMonth, endOfMonth, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, Edit, Scale, Briefcase, Calendar, Clock, User,
  Building2, Phone, Mail, AlertTriangle, ExternalLink
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { supabase } from '@/integrations/supabase/client';
import { useAdvogado } from '@/hooks/useAdvogados';
import {
  TIPO_ADVOGADO_LABELS, ESPECIALIDADE_LABELS,
  STATUS_PROCESSO_LABELS, STATUS_PROCESSO_COLORS,
  TIPO_PROCESSO_LABELS, PRIORIDADE_LABELS, PRIORIDADE_COLORS,
  TIPO_AUDIENCIA_LABELS, STATUS_AUDIENCIA_LABELS, STATUS_AUDIENCIA_COLORS,
  TipoAdvogado
} from '@/types/juridico';
import { useState } from 'react';

export default function AdvogadoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: advogado, isLoading } = useAdvogado(id);
  const [filtroStatusProcesso, setFiltroStatusProcesso] = useState('todos');

  // Processos do advogado
  const { data: processos = [] } = useQuery({
    queryKey: ['advogado-processos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select('id, numero, tipo, status, fase, prioridade, created_at, data_encerramento, parte_contraria_nome')
        .eq('advogado_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Pareceres do mês
  const { data: pareceresCount = 0 } = useQuery({
    queryKey: ['advogado-pareceres-mes', id],
    queryFn: async () => {
      const inicioMes = startOfMonth(new Date()).toISOString();
      const fimMes = endOfMonth(new Date()).toISOString();
      const { count, error } = await supabase
        .from('consultas_juridicas')
        .select('id', { count: 'exact', head: true })
        .eq('respondido_por', id!)
        .gte('respondido_em', inicioMes)
        .lte('respondido_em', fimMes);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  // IDs de processos do advogado (para prazos e audiências)
  const processosIds = useMemo(() => processos.map(p => p.id), [processos]);

  // Prazos pendentes (30d)
  const { data: prazos = [] } = useQuery({
    queryKey: ['advogado-prazos', id, processosIds],
    queryFn: async () => {
      if (!processosIds.length) return [];
      const em30d = new Date();
      em30d.setDate(em30d.getDate() + 30);
      const { data, error } = await supabase
        .from('processos_prazos')
        .select('id, descricao, data_fim, status, processo_id, prioridade')
        .in('processo_id', processosIds)
        .eq('status', 'pendente')
        .lte('data_fim', em30d.toISOString())
        .order('data_fim', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: processosIds.length > 0,
  });

  // Audiências agendadas (30d)
  const { data: audiencias = [] } = useQuery({
    queryKey: ['advogado-audiencias', id, processosIds],
    queryFn: async () => {
      if (!processosIds.length) return [];
      const em30d = new Date();
      em30d.setDate(em30d.getDate() + 30);
      const { data, error } = await supabase
        .from('processos_audiencias')
        .select('id, tipo, data_hora, local, link_videoconferencia, status, processo_id')
        .in('processo_id', processosIds)
        .eq('status', 'agendada')
        .lte('data_hora', em30d.toISOString())
        .gte('data_hora', new Date().toISOString())
        .order('data_hora', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: processosIds.length > 0,
  });

  // KPIs
  const processosAtivos = processos.filter(p => p.status === 'ativo').length;

  // Filtro processos
  const processosFiltrados = filtroStatusProcesso === 'todos'
    ? processos
    : processos.filter(p => p.status === filtroStatusProcesso);

  // Mapa numero por id
  const processoNumeroMap = useMemo(() => {
    const m: Record<string, string> = {};
    processos.forEach(p => { m[p.id] = p.numero; });
    return m;
  }, [processos]);

  // Histórico de desempenho (6 meses)
  const chartData = useMemo(() => {
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const inicio = startOfMonth(d);
      const fim = endOfMonth(d);
      const label = format(d, 'MMM/yy', { locale: ptBR });
      const recebidos = processos.filter(p => {
        const c = new Date(p.created_at);
        return c >= inicio && c <= fim;
      }).length;
      const finalizados = processos.filter(p => {
        if (!p.data_encerramento) return false;
        const e = new Date(p.data_encerramento);
        return e >= inicio && e <= fim;
      }).length;
      meses.push({ mes: label, recebidos, finalizados });
    }
    return meses;
  }, [processos]);

  const encerrados = processos.filter(p => p.data_encerramento);
  const tempoMedio = encerrados.length > 0
    ? Math.round(encerrados.reduce((sum, p) => sum + differenceInDays(new Date(p.data_encerramento!), new Date(p.created_at)), 0) / encerrados.length)
    : 0;

  // Badge de urgência para prazos
  const getUrgenciaBadge = (dataFim: string) => {
    const dias = differenceInDays(new Date(dataFim), new Date());
    if (dias < 0) return <Badge variant="destructive">Vencido</Badge>;
    if (dias <= 3) return <Badge variant="destructive">{dias}d</Badge>;
    if (dias <= 7) return <Badge className="bg-orange-100 text-orange-800">{dias}d</Badge>;
    if (dias <= 15) return <Badge className="bg-yellow-100 text-yellow-800">{dias}d</Badge>;
    return <Badge className="bg-green-100 text-green-800">{dias}d</Badge>;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!advogado) {
    return (
      <div className="container mx-auto py-6">
        <p>Advogado não encontrado.</p>
        <Button variant="outline" onClick={() => navigate('/juridico/advogados')}>Voltar</Button>
      </div>
    );
  }

  const tipo = advogado.tipo as TipoAdvogado;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/juridico/advogados')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{advogado.nome}</h1>
            <p className="text-muted-foreground">
              {advogado.oab && `OAB ${advogado.oab}/${advogado.oab_estado || '??'}`}
            </p>
          </div>
          <Badge className={tipo === 'interno' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}>
            {TIPO_ADVOGADO_LABELS[tipo]}
          </Badge>
          <Badge variant={advogado.ativo ? 'default' : 'secondary'}>
            {advogado.ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <Button onClick={() => navigate(`/juridico/advogados/${id}/editar`)}>
          <Edit className="mr-2 h-4 w-4" /> Editar Cadastro
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Scale className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-3xl font-bold">{processosAtivos}</p>
            <p className="text-sm text-muted-foreground">Processos Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Briefcase className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-3xl font-bold">{pareceresCount}</p>
            <p className="text-sm text-muted-foreground">Pareceres este Mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-3xl font-bold">{prazos.length}</p>
            <p className="text-sm text-muted-foreground">Prazos Pendentes (30d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-3xl font-bold">{audiencias.length}</p>
            <p className="text-sm text-muted-foreground">Audiências (30d)</p>
          </CardContent>
        </Card>
      </div>

      {/* Processos Atribuídos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Processos Atribuídos</CardTitle>
            <Select value={filtroStatusProcesso} onValueChange={setFiltroStatusProcesso}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="suspenso">Suspensos</SelectItem>
                <SelectItem value="arquivado">Arquivados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {processosFiltrados.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum processo encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Dias Aberto</TableHead>
                  <TableHead>Parte Contrária</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processosFiltrados.map(p => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/juridico/processos/${p.id}`)}
                  >
                    <TableCell className="font-medium">{p.numero}</TableCell>
                    <TableCell>{TIPO_PROCESSO_LABELS[p.tipo as keyof typeof TIPO_PROCESSO_LABELS] || p.tipo}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_PROCESSO_COLORS[p.status as keyof typeof STATUS_PROCESSO_COLORS] || ''}>
                        {STATUS_PROCESSO_LABELS[p.status as keyof typeof STATUS_PROCESSO_LABELS] || p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.prioridade && (
                        <Badge className={PRIORIDADE_COLORS[p.prioridade as keyof typeof PRIORIDADE_COLORS] || ''}>
                          {PRIORIDADE_LABELS[p.prioridade as keyof typeof PRIORIDADE_LABELS] || p.prioridade}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{differenceInDays(new Date(), new Date(p.created_at))}d</TableCell>
                    <TableCell>{p.parte_contraria_nome || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Prazos */}
      <Card>
        <CardHeader><CardTitle>Prazos Pendentes</CardTitle></CardHeader>
        <CardContent>
          {prazos.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Nenhum prazo pendente nos próximos 30 dias.</p>
          ) : (
            <div className="space-y-3">
              {prazos.map(prazo => (
                <div
                  key={prazo.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/juridico/processos/${prazo.processo_id}`)}
                >
                  <div>
                    <p className="font-medium">{prazo.descricao}</p>
                    <p className="text-sm text-muted-foreground">
                      Processo {processoNumeroMap[prazo.processo_id] || '—'} • Vence em {format(new Date(prazo.data_fim), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  {getUrgenciaBadge(prazo.data_fim)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audiências */}
      <Card>
        <CardHeader><CardTitle>Próximas Audiências</CardTitle></CardHeader>
        <CardContent>
          {audiencias.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Nenhuma audiência agendada nos próximos 30 dias.</p>
          ) : (
            <div className="space-y-3">
              {audiencias.map(aud => {
                const ehHoje = isToday(new Date(aud.data_hora));
                return (
                  <div
                    key={aud.id}
                    className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer ${ehHoje ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => navigate(`/juridico/processos/${aud.processo_id}`)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {format(new Date(aud.data_hora), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                        {ehHoje && <Badge variant="destructive">HOJE</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Processo {processoNumeroMap[aud.processo_id] || '—'} •{' '}
                        {TIPO_AUDIENCIA_LABELS[aud.tipo as keyof typeof TIPO_AUDIENCIA_LABELS] || aud.tipo} •{' '}
                        {aud.link_videoconferencia ? 'Virtual' : aud.local || 'A definir'}
                      </p>
                    </div>
                    <Badge className={STATUS_AUDIENCIA_COLORS[aud.status as keyof typeof STATUS_AUDIENCIA_COLORS] || ''}>
                      {STATUS_AUDIENCIA_LABELS[aud.status as keyof typeof STATUS_AUDIENCIA_LABELS] || aud.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Desempenho */}
      <Card>
        <CardHeader><CardTitle>Histórico de Desempenho (6 meses)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{tempoMedio}d</p>
                <p className="text-sm text-muted-foreground">Tempo Médio de Resolução</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{encerrados.length}</p>
                <p className="text-sm text-muted-foreground">Total Finalizados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{processos.length}</p>
                <p className="text-sm text-muted-foreground">Total Geral</p>
              </CardContent>
            </Card>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="recebidos" name="Recebidos" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                <Bar dataKey="finalizados" name="Finalizados" fill="hsl(var(--muted-foreground))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
