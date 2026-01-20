import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  History, 
  FileText, 
  Send, 
  Eye, 
  Check, 
  X, 
  Clock, 
  MessageSquare, 
  Mail, 
  Copy,
  Pencil,
  Link,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EventoHistorico } from '@/hooks/useCotacaoHistorico';

interface TimelineEvent {
  id: string;
  tipo: 'criacao' | 'pdf' | 'envio' | 'visualizacao' | 'aceite' | 'recusa' | 'expiracao' | 'whatsapp' | 'email' | 'duplicada' | 'editada' | 'link' | 'plano_escolhido' | 'status';
  titulo: string;
  data: string;
  autor?: string;
  detalhes?: string;
}

interface CotacaoTimelineProps {
  cotacao: {
    id: string;
    created_at: string;
    updated_at?: string;
    status: string;
    vendedor?: { nome?: string } | null;
  };
  historico?: EventoHistorico[];
  isLoading?: boolean;
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

const mapAcaoToTipo = (acao: string): TimelineEvent['tipo'] => {
  const mapa: Record<string, TimelineEvent['tipo']> = {
    'criacao': 'criacao',
    'pdf_baixado': 'pdf',
    'whatsapp_enviado': 'whatsapp',
    'email_enviado': 'email',
    'status_alterado': 'status',
    'duplicada': 'duplicada',
    'editada': 'editada',
    'visualizada_cliente': 'visualizacao',
    'plano_escolhido': 'plano_escolhido',
    'link_copiado': 'link',
  };
  return mapa[acao] || 'envio';
};

const getTituloEvento = (acao: string, detalhes?: Record<string, unknown> | null): string => {
  const titulos: Record<string, string> = {
    'pdf_baixado': 'PDF baixado',
    'whatsapp_enviado': 'Enviada por WhatsApp',
    'email_enviado': 'Enviada por email',
    'status_alterado': `Status alterado para ${(detalhes?.novo_status as string) || 'novo status'}`,
    'duplicada': 'Cotação duplicada',
    'editada': 'Cotação editada',
    'visualizada_cliente': 'Cliente visualizou',
    'plano_escolhido': 'Cliente escolheu plano',
    'link_copiado': 'Link público copiado',
  };
  return titulos[acao] || acao;
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
    case 'whatsapp':
      return {
        icon: <MessageSquare className="h-4 w-4" />,
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-600 dark:text-green-400',
      };
    case 'email':
      return {
        icon: <Mail className="h-4 w-4" />,
        bgColor: 'bg-sky-100 dark:bg-sky-900/30',
        textColor: 'text-sky-600 dark:text-sky-400',
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
    case 'plano_escolhido':
      return {
        icon: <User className="h-4 w-4" />,
        bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
        textColor: 'text-indigo-600 dark:text-indigo-400',
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
    case 'duplicada':
      return {
        icon: <Copy className="h-4 w-4" />,
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        textColor: 'text-orange-600 dark:text-orange-400',
      };
    case 'editada':
      return {
        icon: <Pencil className="h-4 w-4" />,
        bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
        textColor: 'text-cyan-600 dark:text-cyan-400',
      };
    case 'link':
      return {
        icon: <Link className="h-4 w-4" />,
        bgColor: 'bg-violet-100 dark:bg-violet-900/30',
        textColor: 'text-violet-600 dark:text-violet-400',
      };
    case 'status':
      return {
        icon: <FileText className="h-4 w-4" />,
        bgColor: 'bg-slate-100 dark:bg-slate-900/30',
        textColor: 'text-slate-600 dark:text-slate-400',
      };
    default:
      return {
        icon: <FileText className="h-4 w-4" />,
        bgColor: 'bg-muted',
        textColor: 'text-muted-foreground',
      };
  }
};

export function CotacaoTimeline({ cotacao, historico = [], isLoading }: CotacaoTimelineProps) {
  // Construir lista de eventos combinando histórico real + evento de criação
  const eventos: TimelineEvent[] = useMemo(() => {
    const lista: TimelineEvent[] = [];
    
    // Evento de criação (sempre presente)
    lista.push({
      id: 'criacao',
      tipo: 'criacao',
      titulo: 'Cotação criada',
      data: cotacao.created_at,
      autor: cotacao.vendedor?.nome,
    });
    
    // Adicionar eventos do histórico real
    historico.forEach((h) => {
      lista.push({
        id: h.id,
        tipo: mapAcaoToTipo(h.acao),
        titulo: getTituloEvento(h.acao, h.detalhes),
        data: h.created_at,
        autor: h.autor_nome || undefined,
      });
    });
    
    // Se não há histórico, adicionar eventos inferidos do status
    if (historico.length === 0) {
      if (cotacao.status === 'enviada') {
        lista.push({
          id: 'envio',
          tipo: 'envio',
          titulo: 'Cotação enviada',
          data: cotacao.updated_at || cotacao.created_at,
        });
      } else if (cotacao.status === 'aceita') {
        lista.push({
          id: 'aceite',
          tipo: 'aceite',
          titulo: 'Cliente aceitou a cotação',
          data: cotacao.updated_at || cotacao.created_at,
        });
      } else if (cotacao.status === 'recusada') {
        lista.push({
          id: 'recusa',
          tipo: 'recusa',
          titulo: 'Cliente recusou a cotação',
          data: cotacao.updated_at || cotacao.created_at,
        });
      } else if (cotacao.status === 'expirada') {
        lista.push({
          id: 'expiracao',
          tipo: 'expiracao',
          titulo: 'Cotação expirada',
          data: cotacao.updated_at || cotacao.created_at,
        });
      }
    }
    
    // Ordenar por data
    return lista.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  }, [cotacao, historico]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Histórico
          {historico.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({eventos.length} eventos)
            </span>
          )}
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
