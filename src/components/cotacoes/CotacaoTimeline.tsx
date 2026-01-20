import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, FileText, Send, Eye, Check, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  tipo: 'criacao' | 'pdf' | 'envio' | 'visualizacao' | 'aceite' | 'recusa' | 'expiracao';
  titulo: string;
  data: string;
  autor?: string;
}

interface CotacaoTimelineProps {
  cotacao: {
    id: string;
    created_at: string;
    updated_at?: string;
    status: string;
    vendedor?: { nome?: string } | null;
  };
}

const formatDateTime = (date: string) => {
  const d = new Date(date);
  return `${d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })} às ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

const getEventoConfig = (tipo: TimelineEvent['tipo']) => {
  switch (tipo) {
    case 'criacao':
      return {
        icon: <FileText className="h-4 w-4" />,
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-600 dark:text-blue-400',
      };
    case 'pdf':
      return {
        icon: <FileText className="h-4 w-4" />,
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        textColor: 'text-purple-600 dark:text-purple-400',
      };
    case 'envio':
      return {
        icon: <Send className="h-4 w-4" />,
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-600 dark:text-green-400',
      };
    case 'visualizacao':
      return {
        icon: <Eye className="h-4 w-4" />,
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        textColor: 'text-amber-600 dark:text-amber-400',
      };
    case 'aceite':
      return {
        icon: <Check className="h-4 w-4" />,
        bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
        textColor: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'recusa':
      return {
        icon: <X className="h-4 w-4" />,
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        textColor: 'text-red-600 dark:text-red-400',
      };
    case 'expiracao':
      return {
        icon: <Clock className="h-4 w-4" />,
        bgColor: 'bg-gray-100 dark:bg-gray-900/30',
        textColor: 'text-gray-600 dark:text-gray-400',
      };
    default:
      return {
        icon: <FileText className="h-4 w-4" />,
        bgColor: 'bg-muted',
        textColor: 'text-muted-foreground',
      };
  }
};

export function CotacaoTimeline({ cotacao }: CotacaoTimelineProps) {
  // Montar eventos baseado nos dados da cotação
  const eventos: TimelineEvent[] = [
    {
      id: 'criacao',
      tipo: 'criacao',
      titulo: 'Cotação criada',
      data: cotacao.created_at,
      autor: cotacao.vendedor?.nome,
    },
  ];

  // Adicionar evento baseado no status atual
  if (cotacao.status === 'enviada') {
    eventos.push({
      id: 'envio',
      tipo: 'envio',
      titulo: 'Cotação enviada',
      data: cotacao.updated_at || cotacao.created_at,
    });
  } else if (cotacao.status === 'aceita') {
    eventos.push({
      id: 'envio',
      tipo: 'envio',
      titulo: 'Cotação enviada',
      data: cotacao.created_at,
    });
    eventos.push({
      id: 'aceite',
      tipo: 'aceite',
      titulo: 'Cliente aceitou a cotação',
      data: cotacao.updated_at || cotacao.created_at,
    });
  } else if (cotacao.status === 'recusada') {
    eventos.push({
      id: 'recusa',
      tipo: 'recusa',
      titulo: 'Cliente recusou a cotação',
      data: cotacao.updated_at || cotacao.created_at,
    });
  } else if (cotacao.status === 'expirada') {
    eventos.push({
      id: 'expiracao',
      tipo: 'expiracao',
      titulo: 'Cotação expirada',
      data: cotacao.updated_at || cotacao.created_at,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Histórico
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {eventos.map((evento, idx) => {
            const config = getEventoConfig(evento.tipo);
            const isLast = idx === eventos.length - 1;

            return (
              <div key={evento.id} className="flex gap-3">
                {/* Indicador com linha */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      config.bgColor,
                      config.textColor
                    )}
                  >
                    {config.icon}
                  </div>
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-border mt-2" />
                  )}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 pb-4">
                  <p className="font-medium text-sm">{evento.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(evento.data)}
                  </p>
                  {evento.autor && (
                    <p className="text-xs text-muted-foreground">
                      por {evento.autor}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
