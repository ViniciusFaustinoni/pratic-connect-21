import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, Search, ChevronLeft, ChevronRight, 
  MapPin, Video, ExternalLink, Clock, 
  CheckCircle, XCircle, AlertCircle, CalendarDays,
  List, LayoutGrid
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useAudiencias, Audiencia } from '@/hooks/useAudiencias';

const TIPO_AUDIENCIA_LABELS: Record<string, string> = {
  conciliacao: 'Conciliação',
  instrucao: 'Instrução',
  julgamento: 'Julgamento',
  una: 'Una',
  especial: 'Especial',
};

const STATUS_AUDIENCIA_LABELS: Record<string, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  adiada: 'Adiada',
  cancelada: 'Cancelada',
  redesignada: 'Redesignada',
};

const STATUS_AUDIENCIA_COLORS: Record<string, string> = {
  agendada: 'bg-blue-100 text-blue-800',
  realizada: 'bg-green-100 text-green-800',
  adiada: 'bg-yellow-100 text-yellow-800',
  cancelada: 'bg-red-100 text-red-800',
  redesignada: 'bg-purple-100 text-purple-800',
};

export default function AudienciasAgenda() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendario' | 'lista'>('calendario');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [filters, setFilters] = useState({
    busca: '',
    status: 'todos',
    tipo: 'todos',
    dataInicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    dataFim: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  const [resultadoModalOpen, setResultadoModalOpen] = useState(false);
  const [audienciaSelecionada, setAudienciaSelecionada] = useState<Audiencia | null>(null);
  const [formResultado, setFormResultado] = useState({
    status: 'realizada',
    resultado: '',
    advogado_presente: true,
    parte_presente: true,
    observacoes: '',
  });

  // Query de audiências
  const { audiencias, isLoading, atualizarStatus, isAtualizando } = useAudiencias({
    status: filters.status,
    tipo: filters.tipo,
    dataInicio: filters.dataInicio,
    dataFim: filters.dataFim,
  });

  // Filtrar por busca (client-side)
  const audienciasFiltradas = useMemo(() => {
    if (!filters.busca) return audiencias;
    
    const termo = filters.busca.toLowerCase();
    return audiencias.filter(a => 
      a.processo?.numero?.toLowerCase().includes(termo) ||
      a.processo?.numero_processo?.toLowerCase().includes(termo) ||
      a.processo?.parte_contraria_nome?.toLowerCase().includes(termo) ||
      a.local?.toLowerCase().includes(termo) ||
      a.pauta?.toLowerCase().includes(termo)
    );
  }, [audiencias, filters.busca]);

  // Audiências agrupadas por data para o calendário
  const audienciasPorData = useMemo(() => {
    const map = new Map<string, Audiencia[]>();
    audienciasFiltradas.forEach(a => {
      const dateKey = format(parseISO(a.data_hora), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, a]);
    });
    return map;
  }, [audienciasFiltradas]);

  // Métricas
  const metricas = useMemo(() => ({
    total: audienciasFiltradas.length,
    agendadas: audienciasFiltradas.filter(a => a.status === 'agendada').length,
    realizadas: audienciasFiltradas.filter(a => a.status === 'realizada').length,
    adiadas: audienciasFiltradas.filter(a => a.status === 'adiada' || a.status === 'redesignada').length,
  }), [audienciasFiltradas]);

  // Gerar dias do calendário
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: ptBR });
    const end = endOfWeek(endOfMonth(currentMonth), { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handlePreviousMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setFilters(prev => ({
      ...prev,
      dataInicio: format(startOfMonth(newMonth), 'yyyy-MM-dd'),
      dataFim: format(endOfMonth(newMonth), 'yyyy-MM-dd'),
    }));
  };

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setFilters(prev => ({
      ...prev,
      dataInicio: format(startOfMonth(newMonth), 'yyyy-MM-dd'),
      dataFim: format(endOfMonth(newMonth), 'yyyy-MM-dd'),
    }));
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
  };

  const handleRegistrarResultado = (audiencia: Audiencia) => {
    setAudienciaSelecionada(audiencia);
    setFormResultado({
      status: 'realizada',
      resultado: audiencia.resultado || '',
      advogado_presente: audiencia.advogado_presente ?? true,
      parte_presente: audiencia.parte_presente ?? true,
      observacoes: audiencia.observacoes || '',
    });
    setResultadoModalOpen(true);
  };

  const handleSalvarResultado = () => {
    if (!audienciaSelecionada) return;
    atualizarStatus({
      audienciaId: audienciaSelecionada.id,
      ...formResultado,
    });
    setResultadoModalOpen(false);
    setAudienciaSelecionada(null);
  };

  const audienciasDodia = selectedDate 
    ? audienciasFiltradas.filter(a => isSameDay(parseISO(a.data_hora), selectedDate))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda de Audiências</h1>
          <p className="text-muted-foreground">
            Gerencie a agenda de audiências judiciais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'calendario' | 'lista')}>
            <TabsList>
              <TabsTrigger value="calendario" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Calendário
              </TabsTrigger>
              <TabsTrigger value="lista" className="gap-2">
                <List className="h-4 w-4" />
                Lista
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Total no Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metricas.total}</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Agendadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{metricas.agendadas}</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Realizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{metricas.realizadas}</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Adiadas/Redesignadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{metricas.adiadas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por processo, local..."
                value={filters.busca}
                onChange={(e) => setFilters(prev => ({ ...prev, busca: e.target.value }))}
                className="pl-10"
              />
            </div>

            <Select 
              value={filters.status} 
              onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}
            >
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="agendada">Agendada</SelectItem>
                <SelectItem value="realizada">Realizada</SelectItem>
                <SelectItem value="adiada">Adiada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="redesignada">Redesignada</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.tipo} 
              onValueChange={(v) => setFilters(prev => ({ ...prev, tipo: v }))}
            >
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="conciliacao">Conciliação</SelectItem>
                <SelectItem value="instrucao">Instrução</SelectItem>
                <SelectItem value="julgamento">Julgamento</SelectItem>
                <SelectItem value="una">Una</SelectItem>
                <SelectItem value="especial">Especial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo Principal */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'calendario' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendário */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-lg">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                Hoje
              </Button>
            </CardHeader>
            <CardContent>
              {/* Dias da semana */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Grid de dias */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map(day => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayAudiencias = audienciasPorData.get(dateKey) || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDayClick(day)}
                      className={`
                        min-h-20 p-1 border rounded-lg text-left transition-colors
                        ${!isCurrentMonth ? 'text-muted-foreground bg-muted/30' : 'bg-background'}
                        ${isToday(day) ? 'border-primary border-2' : 'border-border'}
                        ${isSelected ? 'ring-2 ring-primary' : ''}
                        hover:bg-accent
                      `}
                    >
                      <div className="text-sm font-medium mb-1">{format(day, 'd')}</div>
                      <div className="space-y-0.5">
                        {dayAudiencias.slice(0, 2).map(a => (
                          <div 
                            key={a.id} 
                            className={`text-xs px-1 py-0.5 rounded truncate ${STATUS_AUDIENCIA_COLORS[a.status] || 'bg-muted'}`}
                          >
                            {format(parseISO(a.data_hora), 'HH:mm')}
                          </div>
                        ))}
                        {dayAudiencias.length > 2 && (
                          <div className="text-xs text-muted-foreground px-1">
                            +{dayAudiencias.length - 2} mais
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Detalhe do dia selecionado */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedDate 
                  ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                  : 'Selecione um dia'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-muted-foreground text-sm">
                  Clique em um dia do calendário para ver as audiências.
                </p>
              ) : audienciasDodia.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhuma audiência neste dia.
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {audienciasDodia.map(audiencia => (
                      <Card key={audiencia.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {format(parseISO(audiencia.data_hora), 'HH:mm')}
                              </span>
                              <Badge className={STATUS_AUDIENCIA_COLORS[audiencia.status]}>
                                {STATUS_AUDIENCIA_LABELS[audiencia.status]}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium truncate">
                              {audiencia.processo?.numero || 'Sem processo'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {audiencia.processo?.parte_contraria_nome || '-'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {TIPO_AUDIENCIA_LABELS[audiencia.tipo]}
                              </Badge>
                            </div>
                            {audiencia.local && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                {audiencia.local}
                              </p>
                            )}
                            {audiencia.link_videoconferencia && (
                              <a 
                                href={audiencia.link_videoconferencia}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
                              >
                                <Video className="h-3 w-3" />
                                Videoconferência
                              </a>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => navigate(`/juridico/processos/${audiencia.processo_id}`)}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                            {audiencia.status === 'agendada' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleRegistrarResultado(audiencia)}
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Visualização em Lista */
        <Card>
          <CardContent className="p-0">
            {audienciasFiltradas.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma audiência encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audienciasFiltradas.map((audiencia) => (
                    <TableRow key={audiencia.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {format(parseISO(audiencia.data_hora), 'dd/MM/yyyy')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(audiencia.data_hora), 'HH:mm')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {audiencia.processo?.numero || 'Sem processo'}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {audiencia.processo?.parte_contraria_nome || '-'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TIPO_AUDIENCIA_LABELS[audiencia.tipo]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          {audiencia.local && (
                            <p className="text-sm flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              {audiencia.local}
                            </p>
                          )}
                          {audiencia.link_videoconferencia && (
                            <a 
                              href={audiencia.link_videoconferencia}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary flex items-center gap-1 hover:underline"
                            >
                              <Video className="h-3 w-3" />
                              Videoconferência
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_AUDIENCIA_COLORS[audiencia.status]}>
                          {STATUS_AUDIENCIA_LABELS[audiencia.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/juridico/processos/${audiencia.processo_id}`)}
                            title="Ver processo"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          {audiencia.status === 'agendada' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRegistrarResultado(audiencia)}
                              title="Registrar resultado"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal de Resultado */}
      <Dialog open={resultadoModalOpen} onOpenChange={setResultadoModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Resultado da Audiência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formResultado.status} 
                onValueChange={(v) => setFormResultado(prev => ({ ...prev, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realizada">Realizada</SelectItem>
                  <SelectItem value="adiada">Adiada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="redesignada">Redesignada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="advogado_presente">Advogado presente</Label>
              <Switch
                id="advogado_presente"
                checked={formResultado.advogado_presente}
                onCheckedChange={(v) => setFormResultado(prev => ({ ...prev, advogado_presente: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="parte_presente">Parte presente</Label>
              <Switch
                id="parte_presente"
                checked={formResultado.parte_presente}
                onCheckedChange={(v) => setFormResultado(prev => ({ ...prev, parte_presente: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Resultado / Decisão</Label>
              <Textarea
                value={formResultado.resultado}
                onChange={(e) => setFormResultado(prev => ({ ...prev, resultado: e.target.value }))}
                placeholder="Descreva o resultado da audiência..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formResultado.observacoes}
                onChange={(e) => setFormResultado(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultadoModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarResultado} disabled={isAtualizando}>
              Salvar Resultado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
