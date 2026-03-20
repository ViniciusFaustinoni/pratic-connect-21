import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isToday, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, ChevronLeft, ChevronRight, MapPin, Video, ExternalLink, Clock, AlertTriangle, CalendarDays, List, LayoutGrid, Plus, Eye, FileEdit } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useAudiencias, Audiencia } from '@/hooks/useAudiencias';
import { useAdvogados } from '@/hooks/useAdvogados';
import { NovaAudienciaModal } from '@/components/juridico/NovaAudienciaModal';
import { TIPO_AUDIENCIA_LABELS, TIPO_AUDIENCIA_COLORS, STATUS_AUDIENCIA_LABELS, STATUS_AUDIENCIA_COLORS } from '@/types/juridico';

export default function AudienciasAgenda() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendario' | 'lista'>('calendario');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [novaAudienciaOpen, setNovaAudienciaOpen] = useState(false);

  const [filters, setFilters] = useState({
    busca: '',
    status: 'todos',
    tipo: 'todos',
    advogado_id: 'todos',
    dataInicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    dataFim: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  const { audiencias, isLoading, kpi, isLoadingKpi } = useAudiencias({
    status: filters.status,
    tipo: filters.tipo,
    advogado_id: filters.advogado_id,
    dataInicio: filters.dataInicio,
    dataFim: filters.dataFim,
  });

  const { advogados } = useAdvogados({ ativo: true });

  // Filtrar por busca client-side
  const audienciasFiltradas = useMemo(() => {
    if (!filters.busca) return audiencias;
    const termo = filters.busca.toLowerCase();
    return audiencias.filter(a =>
      a.processo?.numero?.toLowerCase().includes(termo) ||
      a.processo?.numero_processo?.toLowerCase().includes(termo) ||
      a.processo?.parte_contraria_nome?.toLowerCase().includes(termo) ||
      a.local?.toLowerCase().includes(termo) ||
      a.advogado?.nome?.toLowerCase().includes(termo) ||
      a.forum?.toLowerCase().includes(termo)
    );
  }, [audiencias, filters.busca]);

  // Audiências agrupadas por data
  const audienciasPorData = useMemo(() => {
    const map = new Map<string, Audiencia[]>();
    audienciasFiltradas.forEach(a => {
      const dateKey = format(parseISO(a.data_hora), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, a]);
    });
    return map;
  }, [audienciasFiltradas]);

  // Calendar days
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: ptBR });
    const end = endOfWeek(endOfMonth(currentMonth), { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newMonth = direction === 'prev' ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setFilters(prev => ({
      ...prev,
      dataInicio: format(startOfMonth(newMonth), 'yyyy-MM-dd'),
      dataFim: format(endOfMonth(newMonth), 'yyyy-MM-dd'),
    }));
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setSheetOpen(true);
  };

  const audienciasDodia = selectedDate
    ? audienciasFiltradas.filter(a => isSameDay(parseISO(a.data_hora), selectedDate))
    : [];

  const getForumDisplay = (a: Audiencia) => {
    if (a.modalidade === 'virtual') return `Virtual${a.link_videoconferencia ? '' : ''}`;
    if (a.forum) return `${a.forum}${a.vara ? ` — ${a.vara}` : ''}`;
    return a.local || '-';
  };

  const getDayBadgeColor = (dayAudiencias: Audiencia[]) => {
    const now = new Date();
    const hasPendente = dayAudiencias.some(a => a.status === 'agendada' && isBefore(parseISO(a.data_hora), now));
    if (hasPendente) return 'bg-red-500 text-white';
    const hasToday = dayAudiencias.some(a => a.status === 'agendada' && isToday(parseISO(a.data_hora)));
    if (hasToday) return 'bg-orange-500 text-white';
    return 'bg-blue-500 text-white';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda de Audiências</h1>
          <p className="text-muted-foreground">Gerencie audiências judiciais e administrativas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setNovaAudienciaOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Agendar Audiência
          </Button>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'calendario' | 'lista')}>
            <TabsList>
              <TabsTrigger value="calendario" className="gap-2"><LayoutGrid className="h-4 w-4" /> Calendário</TabsTrigger>
              <TabsTrigger value="lista" className="gap-2"><List className="h-4 w-4" /> Lista</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={kpi.hoje > 0 ? 'border-red-300 bg-red-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${kpi.hoje > 0 ? 'text-red-800' : 'text-muted-foreground'}`}>
              <Clock className="h-4 w-4" /> Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${kpi.hoje > 0 ? 'text-red-600' : ''}`}>
              {isLoadingKpi ? <Skeleton className="h-9 w-12" /> : kpi.hoje}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Esta Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {isLoadingKpi ? <Skeleton className="h-9 w-12" /> : kpi.semana}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Este Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {isLoadingKpi ? <Skeleton className="h-9 w-12" /> : kpi.mes}
            </p>
          </CardContent>
        </Card>

        <Card className={kpi.pendentesRegistro > 0 ? 'border-red-300 bg-red-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${kpi.pendentesRegistro > 0 ? 'text-red-800' : 'text-muted-foreground'}`}>
              <AlertTriangle className="h-4 w-4" /> Pendentes de Registro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${kpi.pendentesRegistro > 0 ? 'text-red-600' : ''}`}>
              {isLoadingKpi ? <Skeleton className="h-9 w-12" /> : kpi.pendentesRegistro}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por processo, advogado, local..." value={filters.busca} onChange={(e) => setFilters(prev => ({ ...prev, busca: e.target.value }))} className="pl-10" />
            </div>
            <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="agendada">Agendada</SelectItem>
                <SelectItem value="realizada">Realizada</SelectItem>
                <SelectItem value="adiada">Adiada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="nao_compareceu">Não Compareceu</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.tipo} onValueChange={(v) => setFilters(prev => ({ ...prev, tipo: v }))}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(TIPO_AUDIENCIA_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.advogado_id} onValueChange={(v) => setFilters(prev => ({ ...prev, advogado_id: v }))}>
              <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Advogado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Advogados</SelectItem>
                {advogados.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo */}
      {isLoading ? (
        <Card><CardContent className="p-6"><div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div></CardContent></Card>
      ) : viewMode === 'calendario' ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => handleMonthChange('prev')}><ChevronLeft className="h-4 w-4" /></Button>
              <CardTitle className="text-lg capitalize">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => handleMonthChange('next')}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              setCurrentMonth(new Date());
              setFilters(prev => ({ ...prev, dataInicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'), dataFim: format(endOfMonth(new Date()), 'yyyy-MM-dd') }));
            }}>Hoje</Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayAudiencias = audienciasPorData.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const hasPendentePast = dayAudiencias.some(a => a.status === 'agendada' && isBefore(parseISO(a.data_hora), new Date()) && !isToday(day));

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-20 p-1 border rounded-lg text-left transition-colors
                      ${!isCurrentMonth ? 'text-muted-foreground bg-muted/30' : 'bg-background'}
                      ${isToday(day) ? 'border-primary border-2' : 'border-border'}
                      ${hasPendentePast ? 'bg-red-50' : ''}
                      hover:bg-accent`}
                  >
                    <div className="text-sm font-medium mb-1">{format(day, 'd')}</div>
                    {dayAudiencias.length > 0 && (
                      <Badge className={`text-xs ${getDayBadgeColor(dayAudiencias)}`}>
                        {dayAudiencias.length}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Lista */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead className="hidden md:table-cell">Partes</TableHead>
                  <TableHead className="hidden lg:table-cell">Fórum/Vara</TableHead>
                  <TableHead className="hidden md:table-cell">Advogado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Resultado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audienciasFiltradas.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma audiência encontrada</TableCell></TableRow>
                ) : audienciasFiltradas.map(a => {
                  const isPastPending = a.status === 'agendada' && isBefore(parseISO(a.data_hora), new Date());
                  return (
                    <TableRow key={a.id} className={isPastPending ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {format(parseISO(a.data_hora), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge className={TIPO_AUDIENCIA_COLORS[a.tipo as keyof typeof TIPO_AUDIENCIA_COLORS] || 'bg-gray-100 text-gray-800'}>
                          {TIPO_AUDIENCIA_LABELS[a.tipo as keyof typeof TIPO_AUDIENCIA_LABELS] || a.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a.processo ? (
                          <button onClick={() => navigate(`/juridico/processos/${a.processo!.id}`)} className="text-primary hover:underline text-sm">
                            {a.processo.numero || a.processo.numero_processo}
                          </button>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {a.processo ? `Pratic x ${a.processo.parte_contraria_nome}` : '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {a.modalidade === 'virtual' ? (
                          <span className="flex items-center gap-1"><Video className="h-3 w-3" /> Virtual</span>
                        ) : getForumDisplay(a)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{a.advogado?.nome || '-'}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_AUDIENCIA_COLORS[a.status as keyof typeof STATUS_AUDIENCIA_COLORS] || 'bg-gray-100 text-gray-800'}>
                          {STATUS_AUDIENCIA_LABELS[a.status as keyof typeof STATUS_AUDIENCIA_LABELS] || a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {a.resultado_tipo ? (a.resultado_resumo?.slice(0, 40) || a.resultado_tipo) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/juridico/audiencias/${a.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isPastPending && (
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/juridico/audiencias/${a.id}`)}>
                              <FileEdit className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Sheet lateral do calendário */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ''}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100dvh-120px)] mt-4">
            {audienciasDodia.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma audiência neste dia.</p>
            ) : (
              <div className="space-y-3">
                {audienciasDodia.map(a => {
                  const isPastPending = a.status === 'agendada' && isBefore(parseISO(a.data_hora), new Date());
                  return (
                    <Card key={a.id} className={`p-3 ${isPastPending ? 'border-red-300 bg-red-50' : ''}`}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{format(parseISO(a.data_hora), 'HH:mm')}</span>
                          <Badge className={STATUS_AUDIENCIA_COLORS[a.status as keyof typeof STATUS_AUDIENCIA_COLORS] || ''}>
                            {STATUS_AUDIENCIA_LABELS[a.status as keyof typeof STATUS_AUDIENCIA_LABELS] || a.status}
                          </Badge>
                        </div>
                        <Badge className={TIPO_AUDIENCIA_COLORS[a.tipo as keyof typeof TIPO_AUDIENCIA_COLORS] || 'bg-gray-100 text-gray-800'}>
                          {TIPO_AUDIENCIA_LABELS[a.tipo as keyof typeof TIPO_AUDIENCIA_LABELS] || a.tipo}
                        </Badge>
                        {a.processo && (
                          <div>
                            <button onClick={() => navigate(`/juridico/processos/${a.processo!.id}`)} className="text-primary hover:underline text-sm">
                              {a.processo.numero || a.processo.numero_processo}
                            </button>
                            <p className="text-xs text-muted-foreground">Pratic x {a.processo.parte_contraria_nome}</p>
                          </div>
                        )}
                        {a.advogado && <p className="text-xs text-muted-foreground">Adv: {a.advogado.nome}</p>}
                        {a.forum && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{a.forum}{a.vara ? ` — ${a.vara}` : ''}</p>}
                        {a.link_videoconferencia && (
                          <a href={a.link_videoconferencia} target="_blank" rel="noopener" className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Video className="h-3 w-3" /> Entrar na Videoconferência <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" onClick={() => { setSheetOpen(false); navigate(`/juridico/audiencias/${a.id}`); }}>
                            <Eye className="h-3 w-3 mr-1" /> Ver Detalhe
                          </Button>
                          {isPastPending && (
                            <Button size="sm" variant="destructive" onClick={() => { setSheetOpen(false); navigate(`/juridico/audiencias/${a.id}`); }}>
                              <FileEdit className="h-3 w-3 mr-1" /> Registrar
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <NovaAudienciaModal open={novaAudienciaOpen} onClose={() => setNovaAudienciaOpen(false)} />
    </div>
  );
}
