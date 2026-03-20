import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MoreVertical,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BarChart,
  Edit,
  UserX,
  Umbrella,
  Wrench,
  Navigation,
  Signal,
  SignalZero,
  Radio,
  Clock,
  TrendingUp,
  MessageCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ProfissionalEquipe, StatusProfissional, StatusOperacional } from '@/hooks/useEquipe';
import { cn } from '@/lib/utils';

interface EquipeCardProps {
  profissional: ProfissionalEquipe;
  onEditar: (prof: ProfissionalEquipe) => void;
  onDesativar: (prof: ProfissionalEquipe) => void;
  onRelatorio: (prof: ProfissionalEquipe) => void;
}

const STATUS_CONFIG: Record<StatusProfissional, { label: string; className: string }> = {
  disponivel: {
    label: 'Disponível',
    className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  indisponivel: {
    label: 'Indisponível',
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  ferias: {
    label: 'Férias',
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  afastado: {
    label: 'Afastado',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

const STATUS_OPERACIONAL_CONFIG: Record<StatusOperacional, { 
  label: string; 
  className: string; 
  icon: React.ReactNode;
  dotColor: string;
}> = {
  em_andamento: {
    label: 'Realizando Tarefa',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: <Wrench className="h-3 w-3" />,
    dotColor: 'bg-blue-500',
  },
  em_rota: {
    label: 'Em Rota',
    className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: <Navigation className="h-3 w-3" />,
    dotColor: 'bg-purple-500',
  },
  em_contato: {
    label: 'Em Contato',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: <MessageCircle className="h-3 w-3" />,
    dotColor: 'bg-amber-500',
  },
  disponivel_operacional: {
    label: 'Aguardando Atribuição',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: <Signal className="h-3 w-3" />,
    dotColor: 'bg-emerald-500 animate-pulse',
  },
  offline: {
    label: 'Offline',
    className: 'bg-muted text-muted-foreground border-border',
    icon: <SignalZero className="h-3 w-3" />,
    dotColor: 'bg-muted-foreground',
  },
};

export function EquipeCard({ profissional, onEditar, onDesativar, onRelatorio }: EquipeCardProps) {
  const getInitials = (nome: string) =>
    nome
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const formatUltimaAtividade = (data: string) => {
    const date = new Date(data);
    const hoje = new Date();
    if (format(date, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd')) {
      return `Hoje às ${format(date, 'HH:mm')}`;
    }
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  };

  const capacidadePercent = (profissional.tarefas_hoje / profissional.capacidade_diaria) * 100;
  const statusOp = STATUS_OPERACIONAL_CONFIG[profissional.status_operacional];
  const statusProf = STATUS_CONFIG[profissional.status];

  return (
    <Card className="group relative overflow-hidden border-border/50 bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
      {/* Indicador de status online no topo */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        profissional.status_operacional === 'disponivel_operacional' && 'bg-gradient-to-r from-emerald-500 to-emerald-400',
        profissional.status_operacional === 'em_andamento' && 'bg-gradient-to-r from-blue-500 to-blue-400',
        profissional.status_operacional === 'em_rota' && 'bg-gradient-to-r from-purple-500 to-purple-400',
        profissional.status_operacional === 'em_contato' && 'bg-gradient-to-r from-amber-500 to-amber-400',
        profissional.status_operacional === 'offline' && 'bg-muted',
      )} />

      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-14 w-14 border-2 border-border">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold text-lg">
                  {getInitials(profissional.nome)}
                </AvatarFallback>
              </Avatar>
              {/* Status indicator dot */}
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card",
                statusOp.dotColor
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate leading-tight">
                {profissional.nome}
              </h3>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Badge variant="outline" className={cn("text-xs", statusProf.className)}>
                  {statusProf.label}
                </Badge>
                <Badge variant="outline" className={cn("text-xs flex items-center gap-1", statusOp.className)}>
                  {statusOp.icon}
                  {statusOp.label}
                </Badge>
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onEditar(profissional)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Calendar className="mr-2 h-4 w-4" />
                Ver agenda
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Umbrella className="mr-2 h-4 w-4" />
                Marcar férias
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={profissional.ativo ? "text-destructive" : "text-emerald-500"}
                onClick={() => onDesativar(profissional)}
              >
                <UserX className="mr-2 h-4 w-4" />
                {profissional.ativo ? 'Desativar' : 'Ativar'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Contato */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{profissional.email}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span>{profissional.telefone || 'Não informado'}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {profissional.regioes_atendimento.length > 0 
                ? profissional.regioes_atendimento.slice(0, 2).join(', ')
                : 'Nenhuma região'
              }
              {profissional.regioes_atendimento.length > 2 && (
                <span className="text-primary"> +{profissional.regioes_atendimento.length - 2}</span>
              )}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Capacidade Diária */}
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Hoje</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">
                {profissional.tarefas_hoje}
              </span>
              <span className="text-sm text-muted-foreground">
                /{profissional.capacidade_diaria}
              </span>
            </div>
            <Progress
              value={capacidadePercent}
              className="h-1.5 mt-2"
            />
          </div>

          {/* Rastreadores em Posse */}
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Radio className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Em Posse</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">
                {profissional.rastreadores_atribuidos}
              </span>
              <span className="text-sm text-muted-foreground">
                rastreadores
              </span>
            </div>
          </div>
        </div>

        {/* Última atividade */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 py-2 border-t border-border/50">
          <Clock className="h-3 w-3" />
          <span>
            Última atividade: {profissional.ultima_atividade 
              ? formatUltimaAtividade(profissional.ultima_atividade)
              : 'Sem atividade registrada'
            }
          </span>
        </div>

        {/* Ação */}
        <Button 
          variant="secondary" 
          size="sm" 
          className="w-full"
          onClick={() => onRelatorio(profissional)}
        >
          <BarChart className="mr-2 h-4 w-4" />
          Ver Relatório de Produtividade
        </Button>
      </CardContent>
    </Card>
  );
}
