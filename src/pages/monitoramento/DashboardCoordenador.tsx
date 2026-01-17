import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Calendar, Clock, Search, Wrench, AlertTriangle, MapPin, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

// Mock data for team section
const mockEquipeHoje = [
  {
    id: '1',
    nome: 'Pedro Silva',
    status: 'online',
    tarefasConcluidas: 3,
    tarefasTotal: 5,
    regiao: 'Centro',
  },
  {
    id: '2',
    nome: 'João Santos',
    status: 'online',
    tarefasConcluidas: 4,
    tarefasTotal: 4,
    regiao: 'Zona Sul',
  },
  {
    id: '3',
    nome: 'Maria Oliveira',
    status: 'offline',
    tarefasConcluidas: 2,
    tarefasTotal: 6,
    regiao: 'Campinas',
  },
  {
    id: '4',
    nome: 'Carlos Mendes',
    status: 'online',
    tarefasConcluidas: 1,
    tarefasTotal: 3,
    regiao: 'Zona Norte',
  },
];

const mockAlertas = [
  { id: '1', mensagem: '3 vistorias sem vistoriador atribuído', tipo: 'warning' },
  { id: '2', mensagem: '2 auto-vistorias aguardando há mais de 24h', tipo: 'warning' },
  { id: '3', mensagem: '1 profissional com capacidade excedida', tipo: 'warning' },
];

const acoesRapidas = [
  { label: 'Ver Fila de Vistorias', href: '/monitoramento/vistorias', icon: ClipboardList },
  { label: 'Gestão de Rotas', href: '/monitoramento/rotas', icon: MapPin },
  { label: 'Equipe', href: '/monitoramento/equipe', icon: ClipboardList },
  { label: 'Instalações', href: '/monitoramento/instalacoes', icon: Wrench },
];

export default function DashboardCoordenador() {
  const navigate = useNavigate();
  const { data: vistoriasMetricas, isLoading: loadingVistorias } = useVistoriasMetricas();
  const { data: instalacoesContagem, isLoading: loadingInstalacoes } = useInstalacoesContagem();

  const kpiCards = [
    {
      title: 'Vistorias Pendentes',
      value: vistoriasMetricas?.pendentes ?? 0,
      label: 'Aguardando agendamento',
      icon: ClipboardList,
      iconColor: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'Vistorias Hoje',
      value: vistoriasMetricas?.em_andamento ?? 0,
      label: 'Agendadas para hoje',
      icon: Calendar,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Em Andamento',
      value: vistoriasMetricas?.em_andamento ?? 0,
      label: 'Vistoriador em campo',
      icon: Clock,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Aguardando Análise',
      value: vistoriasMetricas?.concluidas ?? 0,
      label: 'Fotos enviadas',
      icon: Search,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Instalações Pendentes',
      value: instalacoesContagem?.agendadas ?? 0,
      label: 'Vistorias aprovadas',
      icon: Wrench,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

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
            <BreadcrumbLink asChild>
              <Link to="/monitoramento">Monitoramento</Link>
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
        <p className="text-muted-foreground">Visão geral de vistorias e instalações</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loadingVistorias || loadingInstalacoes ? '...' : kpi.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Equipe de Hoje */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Equipe de Hoje</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/monitoramento/equipe')}>
            Ver todos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockEquipeHoje.map((profissional) => (
            <Card key={profissional.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {profissional.nome.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{profissional.nome}</p>
                    <Badge
                      variant="outline"
                      className={
                        profissional.status === 'online'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-gray-100 text-gray-800 border-gray-200'
                      }
                    >
                      {profissional.status === 'online' ? 'Online' : 'Offline'}
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
                    value={(profissional.tarefasConcluidas / profissional.tarefasTotal) * 100}
                    className="h-2"
                  />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {profissional.regiao}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Alertas e Pendências */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Alertas e Pendências</h2>
        <Card>
          <CardContent className="p-4">
            {mockAlertas.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum alerta no momento</p>
            ) : (
              <div className="space-y-3">
                {mockAlertas.map((alerta) => (
                  <div
                    key={alerta.id}
                    className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                  >
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    <span className="text-sm text-yellow-800 dark:text-yellow-200">{alerta.mensagem}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {acoesRapidas.map((acao) => (
            <Button
              key={acao.href}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate(acao.href)}
            >
              <acao.icon className="h-6 w-6" />
              <span className="text-sm">{acao.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
