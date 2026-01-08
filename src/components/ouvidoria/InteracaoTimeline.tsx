import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, MessageSquare, StickyNote, Send, Paperclip, RefreshCw, User } from "lucide-react";
import type { Interacao, TipoInteracao } from "@/types/ouvidoria";
import { TIPO_INTERACAO_LABELS } from "@/types/ouvidoria";
import { cn } from "@/lib/utils";

interface InteracaoTimelineProps {
  interacoes: Interacao[];
  isLoading?: boolean;
}

const TIPO_CONFIG: Record<TipoInteracao, { icon: React.ReactNode; bgColor: string; borderColor: string }> = {
  mensagem_associado: {
    icon: <User className="h-4 w-4" />,
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  resposta_interna: {
    icon: <Send className="h-4 w-4" />,
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  nota_interna: {
    icon: <StickyNote className="h-4 w-4" />,
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  encaminhamento: {
    icon: <RefreshCw className="h-4 w-4" />,
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  anexo: {
    icon: <Paperclip className="h-4 w-4" />,
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  },
  status_change: {
    icon: <RefreshCw className="h-4 w-4" />,
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  resposta_ia: {
    icon: <Bot className="h-4 w-4" />,
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
};

export function InteracaoTimeline({ interacoes, isLoading }: InteracaoTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-16 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (interacoes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma interação registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {interacoes.map((interacao, index) => {
        const config = TIPO_CONFIG[interacao.tipo];
        const isLast = index === interacoes.length - 1;

        return (
          <div key={interacao.id} className="flex gap-3">
            {/* Timeline Line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  config.bgColor,
                  "border",
                  config.borderColor
                )}
              >
                {config.icon}
              </div>
              {!isLast && <div className="w-px h-full bg-border min-h-[20px]" />}
            </div>

            {/* Content */}
            <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">
                  {interacao.tipo === "resposta_ia"
                    ? "Assistente Virtual"
                    : interacao.usuario?.nome || "Sistema"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(interacao.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                {!interacao.visivel_associado && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                    Interno
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  config.bgColor,
                  config.borderColor
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{interacao.mensagem}</p>
                {interacao.anexo_url && (
                  <a
                    href={interacao.anexo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 mt-2"
                  >
                    <Paperclip className="h-3 w-3" />
                    Ver anexo
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
