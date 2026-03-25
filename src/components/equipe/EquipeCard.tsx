import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MoreVertical,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  LogIn,
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
  shortLabel: string;
  className: string; 
  icon: React.ReactNode;
  dotColor: string;
}> = {
  em_andamento: {
    label: 'Realizando Tarefa',
    shortLabel: 'Em Tarefa',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: <Wrench className="h-3 w-3" />,
    dotColor: 'bg-blue-500',
  },
  em_rota: {
    label: 'Em Rota',
    shortLabel: 'Em Rota',
    className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: <Navigation className="h-3 w-3" />,
    dotColor: 'bg-purple-500',
  },
  em_contato: {
    label: 'Em Contato',
    shortLabel: 'Contato',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: <MessageCircle className="h-3 w-3" />,
    dotColor: 'bg-amber-500',
  },
  disponivel_operacional: {
    label: 'Aguardando Atribuição',
    shortLabel: 'Aguardando',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: <Signal className="h-3 w-3" />,
    dotColor: 'bg-emerald-500 animate-pulse',
  },
  offline: {
    label: 'Offline',
    shortLabel: 'Offline',
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

  const statusOp = STATUS_OPERACIONAL_CONFIG[profissional.status_operacional];
  const statusProf = STATUS_CONFIG[profissional.status];

  return (
    <Card className="group relative overflow-hidden border-border/50 bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
      {/* Top status bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        profissional.status_operacional === 'disponivel_operacional' && 'bg-gradient-to-r from-emerald-500 to-emerald-400',
        profissional.status_operacional === 'em_andamento' && 'bg-gradient-to-r from-blue-500 to-blue-400',
        profissional.status_operacional === 'em_rota' && 'bg-gradient-to-r from-purple-500 to-purple-400',
        profissional.status_operacional === 'em_contato' && 'bg-gradient-to-r from-amber-500 to-amber-400',
        profissional.status_operacional === 'offline' && 'bg-muted',
      )} />

      <CardContent className="p-3 sm:p-4">
        {/* Header: Avatar + Name + Menu */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative flex-shrink-0">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-border">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold text-sm sm:text-base">
                {getInitials(profissional.nome)}
              </AvatarFallback>
            </Avatar>
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card",
              statusOp.dotColor
            )} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm sm:text-base leading-tight break-words" title={profissional.nome}>
              {profissional.nome}
            </h3>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] sm:text-xs px-1.5 py-0", statusProf.className)}>
                {statusProf.label}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] sm:text-xs px-1.5 py-0 flex items-center gap-0.5", statusOp.className)}>
                {statusOp.icon}
                <span className="hidden sm:inline">{statusOp.label}</span>
                <span className="sm:hidden">{statusOp.shortLabel}</span>
              </Badge>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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

        {/* Contact info - compact */}
        <div className="space-y-1.5 mb-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate" title={profissional.email}>{profissional.email}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{profissional.telefone || 'Não informado'}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
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

        {/* Inline stats row */}
        <div className="flex items-center gap-2 mb-3">
          {/* Login */}
          <div className="flex items-center gap-1 text-xs">
            <LogIn className="h-3 w-3 text-muted-foreground" />
            {profissional.inicio_turno ? (
              <span className="text-emerald-500 font-medium">
                {format(new Date(profissional.inicio_turno), 'HH:mm')}
              </span>
            ) : (
              <span className="text-muted-foreground">--:--</span>
            )}
          </div>
          
          <span className="text-border">•</span>

          {/* Tarefas hoje */}
          <div className="flex items-center gap-1 text-xs">
            <TrendingUp className="h-3 w-3 text-primary" />
            <span className="font-semibold text-foreground">{profissional.tarefas_hoje}</span>
            <span className="text-muted-foreground">/{profissional.capacidade_diaria}</span>
          </div>

          <span className="text-border">•</span>

          {/* Rastreadores */}
          <div className="flex items-center gap-1 text-xs">
            <Radio className="h-3 w-3 text-orange-500" />
            <span className="font-semibold text-foreground">{profissional.rastreadores_atribuidos}</span>
          </div>

          <span className="text-border">•</span>

          {/* Localização */}
          <div className="flex items-center gap-1 text-xs">
            <Navigation className="h-3 w-3 text-muted-foreground" />
            {profissional.latitude && profissional.longitude ? (
              <a
                href={`https://www.google.com/maps?q=${profissional.latitude},${profissional.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-0.5"
              >
                Mapa
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : (
              <span className="text-muted-foreground">N/A</span>
            )}
          </div>
        </div>

        {/* Footer: última atividade + botão */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {profissional.ultima_atividade 
                ? formatUltimaAtividade(profissional.ultima_atividade)
                : 'Sem atividade'
              }
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs gap-1 text-primary hover:text-primary"
            onClick={() => onRelatorio(profissional)}
          >
            <BarChart className="h-3 w-3" />
            Relatório
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
