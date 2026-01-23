import { Link, useNavigate } from 'react-router-dom';
import { 
  ClipboardList, 
  Calendar, 
  Clock, 
  Search, 
  Wrench, 
  AlertTriangle, 
  MapPin, 
  ArrowRight,
  Route,
  CheckCircle2,
  TrendingUp,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useVistoriasMetricas } from '@/hooks/useVistorias';
import { useInstalacoesContagem } from '@/hooks/useInstalacoes';
import { 
  useEquipeHoje, 
  useAlertasCoordenador, 
  useRotasHojeMetricas 
} from '@/hooks/useDashboardCoordenador';
import { cn } from '@/lib/utils';

const acoesRapidas = [
  { label: 'Ver Fila de Vistorias', href: '/monitoramento/vistorias', icon: ClipboardList },
  { label: 'Gestão de Rotas', href: '/monitoramento/rotas', icon: MapPin },
  { label: 'Equipe', href: '/monitoramento/equipe', icon: Users },
  { label: 'Instalações', href: '/monitoramento/instalacoes', icon: Wrench },
];

export default function DashboardCoordenador() {
  const navigate = useNavigate();
  const { data: vistoriasMetricas, isLoading: loadingVistorias } = useVistoriasMetricas();
  const { data: instalacoesContagem, isLoading: loadingInstalacoes } = useInstalacoesContagem();
  const { data: equipeHoje, isLoading: loadingEquipe } = useEquipeHoje();
  const { data: alertas, isLoading: loadingAlertas } = useAlertasCoordenador();
  const { data: rotasMetricas, isLoading: loadingRotas } = useRotasHojeMetricas();

  const isLoading = loadingVistorias || loadingInstalacoes || loadingRotas;

  const kpiCards = [
    {
      title: 'Rotas Hoje',
      value: rotasMetricas?.totalRotas ?? 0,
      label: 'Total programadas',
      icon: Route,
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Em Execução',
      value: rotasMetricas?.emAndamento ?? 0,
      label: 'Rotas em andamento',
      icon: Clock,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Vistorias Pendentes',
      value: vistoriasMetricas?.pendentes ?? 0,
      label: 'Aguardando agendamento',
      icon: ClipboardList,
      iconColor: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'Instalações Hoje',
      value: instalacoesContagem?.agendadas ?? 0,
      label: 'Agendadas para hoje',
      icon: Wrench,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Taxa de Conclusão',
      value: `${rotasMetricas?.taxaConclusao ?? 0}%`,
      label: 'Rotas concluídas',
      icon: TrendingUp,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_rota':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      case 'online':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'em_rota':
        return 'Em Rota';
      case 'online':
        return 'Disponível';
      default:
        return 'Offline';
    }
  };

  const getAlertColor = (tipo: string) => {
    switch (tipo) {
      case 'error':
        return 'bg-destructive/10 border-destructive/30 dark:bg-destructive/20';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  const getAlertIconColor = (tipo: string) => {
    switch (tipo) {
      case 'error':
        return 'text-destructive';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Central de Monitoramento</h1>
        <p className="text-muted-foreground">Visão geral de rotas, vistorias e instalações</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="border-border bg-card hover:border-border-hover transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : kpi.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grid: Equipe + Alertas */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Equipe de Hoje - 2 colunas */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Equipe em Campo</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/monitoramento/equipe')}>
              Ver todos
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          
          {loadingEquipe ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-2 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : equipeHoje && equipeHoje.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {equipeHoje.slice(0, 4).map((profissional) => (
                <Card key={profissional.id} className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {profissional.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{profissional.nome}</p>
                        <Badge variant="outline" className={getStatusColor(profissional.status)}>
                          {getStatusLabel(profissional.status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Tarefas</span>
                        <span className="font-medium text-foreground">
                          {profissional.tarefasConcluidas} de {profissional.tarefasTotal}
                        </span>
                      </div>
                      <Progress
                        value={profissional.tarefasTotal > 0 
                          ? (profissional.tarefasConcluidas / profissional.tarefasTotal) * 100 
                          : 0}
                        className="h-2"
                      />
                      {profissional.regiao && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {profissional.regiao}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum profissional em rota ainda</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Rotas são criadas automaticamente quando profissionais iniciam o serviço
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Alertas e Pendências - 1 coluna */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Alertas e Pendências</h2>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              {loadingAlertas ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : alertas && alertas.length > 0 ? (
                <div className="space-y-3">
                  {alertas.map((alerta) => (
                    <div
                      key={alerta.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity",
                        getAlertColor(alerta.tipo)
                      )}
                      onClick={() => alerta.link && navigate(alerta.link)}
                    >
                      <AlertTriangle className={cn("h-5 w-5 flex-shrink-0", getAlertIconColor(alerta.tipo))} />
                      <span className="text-sm text-foreground flex-1">{alerta.mensagem}</span>
                      {alerta.link && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum alerta no momento</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ações Rápidas */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {acoesRapidas.map((acao) => (
            <Button
              key={acao.href}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 border-border hover:border-border-hover hover:bg-card-hover"
              onClick={() => navigate(acao.href)}
            >
              <acao.icon className="h-6 w-6 text-primary" />
              <span className="text-sm">{acao.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
