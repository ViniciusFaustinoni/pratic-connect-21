import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Lock, Unlock, MapPin, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useHistoricoComandos,
  useAtualizarStatusComando,
  STATUS_COMANDO_LABELS,
  STATUS_COMANDO_COLORS,
  TIPO_COMANDO_LABELS,
  ORIGEM_COMANDO_LABELS,
  type ComandoRastreador,
} from '@/hooks/useComandosRastreador';

interface HistoricoComandosProps {
  rastreadorId?: string;
  maxItems?: number;
  showActions?: boolean;
}

const TIPO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bloquear: Lock,
  desbloquear: Unlock,
  localizar_agora: MapPin,
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pendente: Clock,
  autorizado: CheckCircle,
  enviado: Clock,
  confirmado: CheckCircle,
  erro: XCircle,
  cancelado: XCircle,
};

function ComandoItem({ 
  comando, 
  showActions,
  onConfirmar,
  onCancelar,
}: { 
  comando: ComandoRastreador;
  showActions?: boolean;
  onConfirmar?: (id: string) => void;
  onCancelar?: (id: string) => void;
}) {
  const TipoIcon = TIPO_ICONS[comando.tipo_comando] || Lock;
  const StatusIcon = STATUS_ICONS[comando.status] || AlertCircle;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className={`rounded-full p-2 ${
        comando.tipo_comando === 'bloquear' 
          ? 'bg-red-100 text-red-600' 
          : 'bg-green-100 text-green-600'
      }`}>
        <TipoIcon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm">
            {TIPO_COMANDO_LABELS[comando.tipo_comando] || comando.tipo_comando}
          </span>
          <Badge className={`text-xs ${STATUS_COMANDO_COLORS[comando.status]}`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {STATUS_COMANDO_LABELS[comando.status]}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2">
          {comando.motivo}
        </p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{comando.solicitado_por_nome || 'Sistema'}</span>
          <span>•</span>
          <span>{ORIGEM_COMANDO_LABELS[comando.origem]}</span>
          <span>•</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                {format(new Date(comando.solicitado_em), "dd/MM HH:mm", { locale: ptBR })}
              </TooltipTrigger>
              <TooltipContent>
                {format(new Date(comando.solicitado_em), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {comando.erro_mensagem && (
          <p className="text-xs text-destructive mt-1">
            Erro: {comando.erro_mensagem}
          </p>
        )}

        {showActions && comando.status === 'pendente' && (
          <div className="flex gap-2 mt-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-xs"
              onClick={() => onConfirmar?.(comando.id)}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Confirmar
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 text-xs text-destructive"
              onClick={() => onCancelar?.(comando.id)}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function HistoricoComandos({ 
  rastreadorId, 
  maxItems = 10,
  showActions = false,
}: HistoricoComandosProps) {
  const { data: comandos, isLoading, error } = useHistoricoComandos(rastreadorId);
  const atualizarStatus = useAtualizarStatusComando();

  const handleConfirmar = (id: string) => {
    atualizarStatus.mutate({ comandoId: id, status: 'confirmado' });
  };

  const handleCancelar = (id: string) => {
    atualizarStatus.mutate({ 
      comandoId: id, 
      status: 'cancelado',
      observacoes: 'Cancelado manualmente pelo operador',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm">Erro ao carregar histórico</p>
      </div>
    );
  }

  if (!comandos || comandos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum comando registrado</p>
      </div>
    );
  }

  const items = comandos.slice(0, maxItems);

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2 pr-4">
        {items.map((comando) => (
          <ComandoItem 
            key={comando.id} 
            comando={comando}
            showActions={showActions}
            onConfirmar={handleConfirmar}
            onCancelar={handleCancelar}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
