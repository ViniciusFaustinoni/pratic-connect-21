import { useContratoHistorico } from '@/hooks/useContratos';
import { 
  FileText, CheckCircle, XCircle, Clock, Send, Eye, 
  AlertTriangle, User, Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContratoTimelineProps {
  contratoId: string;
}

const eventConfig: Record<string, { icon: typeof FileText; color: string; bgColor: string }> = {
  contrato_criado: { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  gerado_de_cotacao: { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  status_alterado: { icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  documento_enviado: { icon: Send, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  documento_visualizado: { icon: Eye, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  assinatura_parcial: { icon: User, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  documento_assinado: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  assinatura_rejeitada: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  prazo_expirado: { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  contrato_ativado: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  contrato_cancelado: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
};

export function ContratoTimeline({ contratoId }: ContratoTimelineProps) {
  const { data: historico, isLoading } = useContratoHistorico(contratoId);

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!historico || historico.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum evento registrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {historico.map((item, index) => {
        const config = eventConfig[item.evento] || { 
          icon: Clock, 
          color: 'text-gray-600', 
          bgColor: 'bg-gray-100' 
        };
        const Icon = config.icon;

        return (
          <div key={item.id} className="relative flex gap-4">
            {/* Linha conectora */}
            {index < historico.length - 1 && (
              <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
            )}

            {/* Ícone */}
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
              config.bgColor
            )}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {item.descricao || item.evento.replace(/_/g, ' ')}
                  </p>
                  {item.usuario && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      por {item.usuario.nome}
                    </p>
                  )}
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateTime(item.created_at)}
                </time>
              </div>

              {/* Dados extras */}
              {item.dados && Object.keys(item.dados).length > 0 && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                  {Object.entries(item.dados).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
