import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bell,
  BellOff,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Receipt,
  FileText,
  MapPin,
  Phone,
  ChevronRight,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMyNotificacoes,
  useMarkAsRead,
  useMarkAllAsRead,
  Notificacao,
} from '@/hooks/useMyNotificacoes';
import { cn } from '@/lib/utils';

const tipoConfig: Record<string, { icon: React.ElementType; className: string }> = {
  info: { icon: Info, className: 'text-blue-500 bg-blue-50' },
  warning: { icon: AlertTriangle, className: 'text-yellow-600 bg-yellow-50' },
  success: { icon: CheckCircle, className: 'text-green-500 bg-green-50' },
  error: { icon: XCircle, className: 'text-red-500 bg-red-50' },
  boleto: { icon: Receipt, className: 'text-orange-500 bg-orange-50' },
  documento: { icon: FileText, className: 'text-purple-500 bg-purple-50' },
  rastreador: { icon: MapPin, className: 'text-blue-500 bg-blue-50' },
  sinistro: { icon: AlertTriangle, className: 'text-red-500 bg-red-50' },
  chamado: { icon: Phone, className: 'text-green-500 bg-green-50' },
};

function getNotificacaoConfig(tipo: string) {
  return tipoConfig[tipo] || tipoConfig.info;
}

function groupNotificacoes(notificacoes: Notificacao[]) {
  const groups: { label: string; items: Notificacao[] }[] = [
    { label: 'Hoje', items: [] },
    { label: 'Ontem', items: [] },
    { label: 'Esta semana', items: [] },
    { label: 'Anteriores', items: [] },
  ];

  notificacoes.forEach((n) => {
    const date = new Date(n.created_at);
    if (isToday(date)) {
      groups[0].items.push(n);
    } else if (isYesterday(date)) {
      groups[1].items.push(n);
    } else if (isThisWeek(date)) {
      groups[2].items.push(n);
    } else {
      groups[3].items.push(n);
    }
  });

  return groups.filter((g) => g.items.length > 0);
}

interface NotificacaoCardProps {
  notificacao: Notificacao;
  onRead: (id: string) => void;
  onNavigate: (link: string) => void;
}

function NotificacaoCard({ notificacao, onRead, onNavigate }: NotificacaoCardProps) {
  const config = getNotificacaoConfig(notificacao.tipo);
  const Icon = config.icon;

  const handleClick = () => {
    if (!notificacao.lida) {
      onRead(notificacao.id);
    }
    if (notificacao.link) {
      onNavigate(notificacao.link);
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:bg-muted/50',
        !notificacao.lida && 'bg-primary/5 border-primary/20'
      )}
      onClick={handleClick}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', config.className)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-sm font-medium', !notificacao.lida && 'text-foreground')}>
              {notificacao.titulo}
            </p>
            {!notificacao.lida && (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
            {notificacao.mensagem}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notificacao.created_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
        </div>
        {notificacao.link && (
          <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <BellOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium">Nenhuma notificação</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Você não tem notificações no momento
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="flex items-start gap-3 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AppNotificacoes() {
  const navigate = useNavigate();
  const { data: notificacoes, isLoading } = useMyNotificacoes();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const hasUnread = notificacoes?.some((n) => !n.lida);
  const groups = notificacoes ? groupNotificacoes(notificacoes) : [];

  const handleRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleNavigate = (link: string) => {
    navigate(link);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe seus alertas e comunicados
          </p>
        </div>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={markAllAsRead.isPending}
            className="shrink-0"
          >
            <CheckCheck className="mr-1 h-4 w-4" />
            Marcar todas
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h2>
              <div className="space-y-3">
                {group.items.map((notificacao) => (
                  <NotificacaoCard
                    key={notificacao.id}
                    notificacao={notificacao}
                    onRead={handleRead}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
