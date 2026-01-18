import { useState, useMemo } from 'react';
import { format, addDays, subDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, MapPin, User, 
  Eye, Edit, Clock, CheckCircle, AlertTriangle, Play, 
  XCircle, Loader2, Route, Search, Wrench, Home
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  useRotas, 
  useRota, 
  useInstalacoesDisponiveis, 
  useInstaladores,
  useProfissionaisSemRota,
  STATUS_ROTA_LABELS,
  STATUS_ROTA_COLORS,
  type RotaWithRelations,
  type StatusRota 
} from '@/hooks/useRotas';
import { RotaModal } from '@/components/monitoramento/RotaModal';
import { RotaDetailDrawer } from '@/components/rotas/RotaDetailDrawer';
import { toast } from 'sonner';

// Configuração de status
const STATUS_ROTA_CONFIG: Record<StatusRota, { 
  label: string; 
  className: string; 
  icon: typeof Clock;
}> = {
  pendente: { 
    label: 'Planejada', 
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    icon: Clock 
  },
  em_andamento: { 
    label: 'Em Andamento', 
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    icon: Play 
  },
  concluida: { 
    label: 'Concluída', 
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    icon: CheckCircle 
  },
  cancelada: { 
    label: 'Cancelada', 
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    icon: XCircle 
  },
};

const STATUS_TAREFA_CONFIG = {
  agendada: { label: 'Aguardando', icon: Clock, className: 'text-muted-foreground' },
  em_andamento: { label: 'Em andamento', icon: Loader2, className: 'text-amber-600' },
  concluida: { label: 'Concluída', icon: CheckCircle, className: 'text-green-600' },
  cancelada: { label: 'Cancelada', icon: XCircle, className: 'text-red-600' },
  reagendada: { label: 'Reagendada', icon: Clock, className: 'text-blue-600' },
};

export default function GestaoRotas() {
  const [dataSelecionada, setDataSelecionada] = useState<Date>(new Date());
  const [formRotaOpen, setFormRotaOpen] = useState(false);
  const [rotaParaEditar, setRotaParaEditar] = useState<RotaWithRelations | null>(null);
  const [rotaDetalheId, setRotaDetalheId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Buscar rotas do dia
  const { data: rotasDia = [], isLoading: loadingRotas } = useRotas({
    dataInicio: dataSelecionada,
    dataFim: dataSelecionada,
  });

  // Buscar instalações sem rota para a data
  const { data: instalacoesDisponiveis = [], isLoading: loadingInstalacoes } = useInstalacoesDisponiveis(dataSelecionada);

  // Buscar profissionais sem rota
  const { data: profissionaisSemRota = [], isLoading: loadingProfissionais } = useProfissionaisSemRota(dataSelecionada);

  // Calcular métricas
  const metricas = useMemo(() => {
    const totalRotas = rotasDia.length;
    const tarefasAgendadas = rotasDia.reduce((acc, rota) => acc + (rota.instalacoes?.length || 0), 0);
    const emAndamento = rotasDia.filter(r => r.status === 'em_andamento').length;
    const concluidas = rotasDia.filter(r => r.status === 'concluida').length;

    return { totalRotas, tarefasAgendadas, emAndamento, concluidas };
  }, [rotasDia]);

  // Navegação de data
  const handleDiaAnterior = () => setDataSelecionada(prev => subDays(prev, 1));
  const handleProximoDia = () => setDataSelecionada(prev => addDays(prev, 1));
  const handleHoje = () => setDataSelecionada(new Date());

  // Formatação de data
  const dataFormatada = format(dataSelecionada, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  // Calcular progresso de tarefas por rota
  const calcularProgresso = (rota: RotaWithRelations) => {
    const instalacoes = rota.instalacoes || [];
    const total = instalacoes.length;
    if (total === 0) return { total: 0, concluidas: 0, percentual: 0 };
    
    const concluidas = instalacoes.filter(i => i.status === 'concluida').length;
    return {
      total,
      concluidas,
      percentual: Math.round((concluidas / total) * 100),
    };
  };

  const isLoading = loadingRotas || loadingInstalacoes || loadingProfissionais;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/dashboard" className="flex items-center gap-1 hover:text-foreground">
              <Home className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span>Monitoramento</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Gestão de Rotas</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Rotas</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                {format(dataSelecionada, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="single"
                selected={dataSelecionada}
                onSelect={(date) => {
                  if (date) {
                    setDataSelecionada(date);
                    setCalendarOpen(false);
                  }
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          
          <Button onClick={() => setFormRotaOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Rota
          </Button>
        </div>
      </div>

      {/* Navegação de Data */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
        <Button variant="ghost" size="sm" onClick={handleDiaAnterior} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        
        <div className="text-center">
          <p className="text-lg font-semibold">Rotas de {dataCapitalizada}</p>
          {isToday(dataSelecionada) && (
            <Badge variant="secondary" className="mt-1">Hoje</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isToday(dataSelecionada) && (
            <Button variant="outline" size="sm" onClick={handleHoje}>
              Hoje
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleProximoDia} className="gap-1">
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Rotas</CardTitle>
            <Route className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.totalRotas}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas Agendadas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.tarefasAgendadas}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Play className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.emAndamento}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.concluidas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Grid de Rotas */}
      {!isLoading && rotasDia.length > 0 && (
        <div className="space-y-4">
          {rotasDia.map((rota) => {
            const progresso = calcularProgresso(rota);
            const statusConfig = STATUS_ROTA_CONFIG[rota.status as StatusRota] || STATUS_ROTA_CONFIG.pendente;
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={rota.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{rota.codigo}</CardTitle>
                        <Badge className={cn('gap-1', statusConfig.className)}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {rota.instalador?.nome || 'Sem instalador'}
                        </span>
                        {rota.cidade && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {rota.cidade}
                            {rota.regiao && `, ${rota.regiao}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Barra de Progresso */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Progresso: {progresso.concluidas} de {progresso.total} tarefas
                      </span>
                      <span className="font-medium">{progresso.percentual}%</span>
                    </div>
                    <Progress value={progresso.percentual} className="h-2" />
                  </div>

                  {/* Tabela de Tarefas */}
                  {rota.instalacoes && rota.instalacoes.length > 0 && (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead className="w-20">Hora</TableHead>
                            <TableHead className="w-28">Tipo</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Veículo</TableHead>
                            <TableHead className="w-32">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rota.instalacoes.map((instalacao, index) => {
                            const statusTarefa = STATUS_TAREFA_CONFIG[instalacao.status as keyof typeof STATUS_TAREFA_CONFIG] 
                              || STATUS_TAREFA_CONFIG.agendada;
                            const TarefaIcon = statusTarefa.icon;

                            return (
                              <TableRow key={instalacao.id}>
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                <TableCell>
                                  {instalacao.periodo === 'manha' ? '09:00' : '14:00'}
                                </TableCell>
                                <TableCell>
                                  <span className="flex items-center gap-1">
                                    <Wrench className="h-4 w-4" />
                                    Instalação
                                  </span>
                                </TableCell>
                                <TableCell>{instalacao.associados?.nome || '-'}</TableCell>
                                <TableCell>
                                  {instalacao.veiculos 
                                    ? `${instalacao.veiculos.marca} ${instalacao.veiculos.modelo} - ${instalacao.veiculos.placa}`
                                    : '-'
                                  }
                                </TableCell>
                                <TableCell>
                                  <span className={cn('flex items-center gap-1', statusTarefa.className)}>
                                    <TarefaIcon className="h-4 w-4" />
                                    {statusTarefa.label}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Sem tarefas */}
                  {(!rota.instalacoes || rota.instalacoes.length === 0) && (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Nenhuma tarefa atribuída a esta rota
                    </div>
                  )}

                  <Separator />

                  {/* Ações */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1" disabled>
                      <MapPin className="h-4 w-4" />
                      Ver no Mapa
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1"
                      onClick={() => setRotaDetalheId(rota.id)}
                    >
                      <Eye className="h-4 w-4" />
                      Detalhes
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1"
                      onClick={() => {
                        setRotaParaEditar(rota);
                        setFormRotaOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      Editar Rota
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sem rotas */}
      {!isLoading && rotasDia.length === 0 && (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Route className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Nenhuma rota para esta data</h3>
            <p className="text-muted-foreground mt-1">
              Crie uma nova rota ou selecione outra data
            </p>
            <Button className="mt-4 gap-2" onClick={() => setFormRotaOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova Rota
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Profissionais Sem Rota */}
      {!isLoading && profissionaisSemRota.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5" />
            Profissionais Disponíveis
          </h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profissionaisSemRota.map((profissional) => (
              <Card key={profissional.id} className="border-dashed">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{profissional.nome}</span>
                    </div>
                    <Badge variant="outline">Sem Rota</Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>Região: -</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Disponível mas sem tarefas atribuídas</span>
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4 w-full gap-1"
                    onClick={() => {
                      // TODO: Abrir modal de criação de rota pré-preenchido
                      setFormRotaOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Criar Rota para {profissional.nome?.split(' ')[0]}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tarefas Não Atribuídas */}
      {!isLoading && instalacoesDisponiveis.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Tarefas sem rota para {format(dataSelecionada, 'dd/MM/yyyy')} 
              <Badge variant="secondary">{instalacoesDisponiveis.length}</Badge>
            </h2>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => toast.info('Distribuição automática em desenvolvimento')}
            >
              Distribuir Automaticamente
            </Button>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {instalacoesDisponiveis.slice(0, 5).map((instalacao) => (
                  <div 
                    key={instalacao.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{instalacao.associados?.nome || 'Cliente'}</p>
                        <p className="text-sm text-muted-foreground">
                          {instalacao.veiculos 
                            ? `${instalacao.veiculos.marca} ${instalacao.veiculos.modelo} - ${instalacao.veiculos.placa}`
                            : 'Veículo não informado'
                          }
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {instalacao.periodo === 'manha' ? 'Manhã' : 'Tarde'}
                    </Badge>
                  </div>
                ))}
                
                {instalacoesDisponiveis.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    E mais {instalacoesDisponiveis.length - 5} tarefas...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialogs */}
      <RotaModal
        open={formRotaOpen}
        onOpenChange={(open) => {
          setFormRotaOpen(open);
          if (!open) setRotaParaEditar(null);
        }}
        rota={rotaParaEditar}
        data={dataSelecionada}
      />

      <RotaDetailDrawer
        rotaId={rotaDetalheId || undefined}
        open={!!rotaDetalheId}
        onOpenChange={(open) => !open && setRotaDetalheId(null)}
        onAddInstalacoes={() => {}}
        onEdit={() => {}}
      />
    </div>
  );
}
