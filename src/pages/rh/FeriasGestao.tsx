import { Palmtree, Calendar, AlertTriangle, Check, X, Plus, Eye, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInMonths, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import { SolicitarFeriasModal } from '@/components/rh/SolicitarFeriasModal';

const statusConfig: Record<string, { label: string; className: string }> = {
  solicitada: { label: 'Solicitada', className: 'bg-yellow-100 text-yellow-800' },
  aprovada: { label: 'Aprovada', className: 'bg-green-100 text-green-800' },
  em_gozo: { label: 'Em Gozo', className: 'bg-blue-100 text-blue-800' },
  concluida: { label: 'Concluída', className: 'bg-gray-100 text-gray-800' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800' }
};

export default function FeriasGestao() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    status: 'todos',
    ano: new Date().getFullYear()
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [calendarioMes, setCalendarioMes] = useState(new Date());

  // Query férias com filtros
  const { data: ferias, isLoading } = useQuery({
    queryKey: ['ferias', filters],
    queryFn: async () => {
      let query = supabase
        .from('ferias')
        .select(`
          *,
          funcionario:funcionarios(nome_completo, foto_url, cargo:cargos(nome), departamento:departamentos(nome))
        `)
        .gte('data_inicio', `${filters.ano}-01-01`)
        .lte('data_inicio', `${filters.ano}-12-31`)
        .order('data_inicio', { ascending: false });

      if (filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }

      const { data } = await query;
      return data || [];
    }
  });

  // Query estatísticas
  const { data: stats } = useQuery({
    queryKey: ['ferias-stats'],
    queryFn: async () => {
      const hoje = new Date();
      const inicioMes = startOfMonth(hoje);
      const fimMes = endOfMonth(hoje);

      const { data: todas } = await supabase
        .from('ferias')
        .select('status, data_inicio, data_fim');

      const solicitadas = todas?.filter(f => f.status === 'solicitada').length || 0;
      const aprovadasMes = todas?.filter(f => 
        f.status === 'aprovada' && 
        new Date(f.data_inicio) >= inicioMes && 
        new Date(f.data_inicio) <= fimMes
      ).length || 0;
      const emGozo = todas?.filter(f => 
        f.status === 'em_gozo' || 
        (f.status === 'aprovada' && 
          hoje >= new Date(f.data_inicio) && 
          hoje <= new Date(f.data_fim))
      ).length || 0;

      return { solicitadas, aprovadasMes, emGozo };
    }
  });

  // Query funcionários com férias vencendo
  const { data: feriasVencendo } = useQuery({
    queryKey: ['ferias-vencendo'],
    queryFn: async () => {
      const { data: funcionarios } = await supabase
        .from('funcionarios')
        .select('id, nome_completo, data_admissao, cargo:cargos(nome)')
        .eq('status', 'ativo');

      const { data: feriasUsadas } = await supabase
        .from('ferias')
        .select('funcionario_id, dias_gozados, periodo_aquisitivo_fim')
        .in('status', ['aprovada', 'em_gozo', 'concluida']);

      const hoje = new Date();
      
      return funcionarios?.filter(f => {
        const admissao = parseISO(f.data_admissao);
        const meses = differenceInMonths(hoje, admissao);
        
        if (meses < 12) return false;

        // Verificar se tem férias vencendo (período > 12 meses)
        const anosCompletos = Math.floor(meses / 12);
        const periodoInicio = new Date(admissao);
        periodoInicio.setFullYear(admissao.getFullYear() + anosCompletos - 1);
        
        const periodoFim = new Date(periodoInicio);
        periodoFim.setFullYear(periodoInicio.getFullYear() + 1);
        periodoFim.setDate(periodoFim.getDate() - 1);

        // Férias vence 12 meses após período aquisitivo
        const vencimento = new Date(periodoFim);
        vencimento.setFullYear(vencimento.getFullYear() + 1);

        const diasParaVencer = Math.floor((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        return diasParaVencer <= 90; // Vencendo em 90 dias ou menos
      }).map(f => {
        const admissao = parseISO(f.data_admissao);
        const meses = differenceInMonths(hoje, admissao);
        return { ...f, mesesTrabalhados: meses };
      }) || [];
    }
  });

  // Mutation aprovar férias
  const aprovarFerias = useMutation({
    mutationFn: async (feriasId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('ferias')
        .update({
          status: 'aprovada',
          aprovado_por: user?.id,
          aprovado_em: new Date().toISOString()
        })
        .eq('id', feriasId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Férias aprovadas!');
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      queryClient.invalidateQueries({ queryKey: ['ferias-stats'] });
    },
    onError: () => {
      toast.error('Erro ao aprovar férias');
    }
  });

  // Mutation rejeitar férias
  const rejeitarFerias = useMutation({
    mutationFn: async (feriasId: string) => {
      const { error } = await supabase
        .from('ferias')
        .update({ status: 'cancelada' })
        .eq('id', feriasId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Férias rejeitadas');
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      queryClient.invalidateQueries({ queryKey: ['ferias-stats'] });
    },
    onError: () => {
      toast.error('Erro ao rejeitar férias');
    }
  });

  // Dados do calendário
  const diasCalendario = useMemo(() => {
    const inicio = startOfMonth(calendarioMes);
    const fim = endOfMonth(calendarioMes);
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [calendarioMes]);

  const feriasNoMes = useMemo(() => {
    if (!ferias) return [];
    return ferias.filter(f => {
      const dataInicio = parseISO(f.data_inicio);
      const dataFim = parseISO(f.data_fim);
      return (
        isSameMonth(dataInicio, calendarioMes) ||
        isSameMonth(dataFim, calendarioMes) ||
        (dataInicio < startOfMonth(calendarioMes) && dataFim > endOfMonth(calendarioMes))
      );
    });
  }, [ferias, calendarioMes]);

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Férias</h1>
          <p className="text-muted-foreground">Gerencie solicitações e períodos de férias</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Solicitação
        </Button>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Solicitadas</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.solicitadas || 0}</div>
            <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.aprovadasMes || 0}</div>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Em Gozo</CardTitle>
            <Palmtree className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.emGozo || 0}</div>
            <p className="text-xs text-muted-foreground">Atualmente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Férias Vencendo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{feriasVencendo?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Próximos 90 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="solicitacoes">
        <TabsList>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório</TabsTrigger>
        </TabsList>

        {/* Tab Solicitações */}
        <TabsContent value="solicitacoes" className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-4">
            <Select
              value={String(filters.ano)}
              onValueChange={(v) => setFilters(prev => ({ ...prev, ano: parseInt(v) }))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map(ano => (
                  <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="solicitada">Solicitadas</SelectItem>
                <SelectItem value="aprovada">Aprovadas</SelectItem>
                <SelectItem value="em_gozo">Em Gozo</SelectItem>
                <SelectItem value="concluida">Concluídas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Abono</TableHead>
                  <TableHead>13º</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : ferias?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma solicitação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  ferias?.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={f.funcionario?.foto_url || ''} />
                            <AvatarFallback>
                              {f.funcionario?.nome_completo?.charAt(0) || 'F'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{f.funcionario?.nome_completo}</div>
                            <div className="text-xs text-muted-foreground">
                              {f.funcionario?.cargo?.nome}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(f.data_inicio), 'dd/MM/yyyy')} a {format(parseISO(f.data_fim), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>{f.dias_gozados}</TableCell>
                      <TableCell>
                        {f.dias_abono > 0 ? (
                          <Badge variant="outline">{f.dias_abono} dias</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {f.adiantamento_13 ? (
                          <Badge variant="outline" className="bg-green-50">Sim</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[f.status]?.className || ''}>
                          {statusConfig[f.status]?.label || f.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {f.status === 'solicitada' && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600"
                                onClick={() => aprovarFerias.mutate(f.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-600"
                                onClick={() => rejeitarFerias.mutate(f.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab Calendário */}
        <TabsContent value="calendario" className="space-y-4">
          {/* Navegação do mês */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCalendarioMes(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold">
              {format(calendarioMes, 'MMMM yyyy', { locale: ptBR })}
            </h3>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCalendarioMes(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Grid do calendário */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                  <div key={dia} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {dia}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {/* Espaços vazios no início */}
                {Array.from({ length: diasCalendario[0]?.getDay() || 0 }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-24" />
                ))}
                {diasCalendario.map(dia => {
                  const feriasNoDia = feriasNoMes.filter(f => {
                    const inicio = parseISO(f.data_inicio);
                    const fim = parseISO(f.data_fim);
                    return isWithinInterval(dia, { start: inicio, end: fim });
                  });

                  return (
                    <div
                      key={dia.toISOString()}
                      className="h-24 border rounded-md p-1 overflow-hidden"
                    >
                      <div className="text-sm font-medium mb-1">
                        {format(dia, 'd')}
                      </div>
                      <div className="space-y-0.5">
                        {feriasNoDia.slice(0, 2).map(f => (
                          <div
                            key={f.id}
                            className="text-xs truncate px-1 py-0.5 rounded bg-blue-100 text-blue-800"
                            title={f.funcionario?.nome_completo}
                          >
                            {f.funcionario?.nome_completo?.split(' ')[0]}
                          </div>
                        ))}
                        {feriasNoDia.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{feriasNoDia.length - 2} mais
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Relatório */}
        <TabsContent value="relatorio" className="space-y-4">
          {/* Alerta férias vencendo */}
          {feriasVencendo && feriasVencendo.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção!</AlertTitle>
              <AlertDescription>
                {feriasVencendo.length} funcionário(s) com férias vencendo nos próximos 90 dias.
              </AlertDescription>
            </Alert>
          )}

          {/* Tabela de funcionários com férias vencendo */}
          <Card>
            <CardHeader>
              <CardTitle>Funcionários com Férias Vencendo</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Data Admissão</TableHead>
                    <TableHead>Meses Trabalhados</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feriasVencendo?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum funcionário com férias vencendo
                      </TableCell>
                    </TableRow>
                  ) : (
                    feriasVencendo?.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.nome_completo}</TableCell>
                        <TableCell>{format(parseISO(f.data_admissao), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{f.mesesTrabalhados} meses</Badge>
                        </TableCell>
                        <TableCell>{f.cargo?.nome || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => setModalOpen(true)}>
                            Agendar Férias
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal */}
      <SolicitarFeriasModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
