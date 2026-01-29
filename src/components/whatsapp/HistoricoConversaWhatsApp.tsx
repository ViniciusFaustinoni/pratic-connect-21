import { useState, useRef, useEffect } from 'react';
import { MessageCircle, RefreshCw, Loader2, AlertCircle, ArrowDown, User, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWhatsAppHistorico, useSincronizarHistorico } from '@/hooks/useWhatsAppHistorico';
import { cn } from '@/lib/utils';

interface Props {
  telefone: string | null | undefined;
  titulo?: string;
  altura?: string;
  mostrarHeader?: boolean;
}

export function HistoricoConversaWhatsApp({ 
  telefone, 
  titulo = 'Conversas WhatsApp',
  altura = 'h-[400px]',
  mostrarHeader = true,
}: Props) {
  const { data: mensagens, isLoading, error, refetch } = useWhatsAppHistorico(telefone);
  const sincronizar = useSincronizarHistorico();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto scroll para última mensagem
  useEffect(() => {
    if (autoScroll && scrollRef.current && mensagens?.length) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens, autoScroll]);

  const handleSincronizar = () => {
    if (telefone) {
      sincronizar.mutate(telefone);
    }
  };

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);

    if (data.toDateString() === hoje.toDateString()) {
      return `Hoje ${format(data, 'HH:mm')}`;
    }
    if (data.toDateString() === ontem.toDateString()) {
      return `Ontem ${format(data, 'HH:mm')}`;
    }
    return format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'lida':
        return '✓✓';
      case 'entregue':
        return '✓✓';
      case 'enviada':
        return '✓';
      case 'erro':
        return '✗';
      default:
        return '⏳';
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'lida') return 'text-blue-500';
    if (status === 'erro') return 'text-red-500';
    return 'text-muted-foreground';
  };

  if (!telefone) {
    return (
      <Card>
        {mostrarHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              {titulo}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhum telefone informado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {mostrarHeader && (
        <CardHeader className="pb-3 flex-row justify-between items-center">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            {titulo}
            {mensagens && mensagens.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {mensagens.length} {mensagens.length === 1 ? 'mensagem' : 'mensagens'}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSincronizar}
              disabled={sincronizar.isPending}
            >
              {sincronizar.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                <Skeleton className="h-16 w-3/4 rounded-lg" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-destructive">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">Erro ao carregar mensagens</p>
            <Button variant="link" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : !mensagens || mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhuma mensagem encontrada</p>
            <p className="text-xs mt-1">Clique em "Sincronizar" para buscar do WhatsApp</p>
          </div>
        ) : (
          <div className="relative">
            <ScrollArea className={altura} ref={scrollRef}>
              <div className="space-y-3 pr-4">
                {mensagens.map((msg, index) => {
                  const isEntrada = msg.direcao === 'entrada';
                  const showDate = index === 0 || 
                    new Date(mensagens[index - 1].created_at).toDateString() !== 
                    new Date(msg.created_at).toDateString();

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <Badge variant="secondary" className="text-xs font-normal">
                            {format(new Date(msg.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </Badge>
                        </div>
                      )}
                      <div className={cn("flex", isEntrada ? "justify-start" : "justify-end")}>
                        <div
                          className={cn(
                            "max-w-[80%] p-3 rounded-lg shadow-sm",
                            isEntrada
                              ? "bg-muted rounded-tl-none"
                              : "bg-green-100 dark:bg-green-900/30 rounded-tr-none"
                          )}
                        >
                          {/* Header com nome/tipo */}
                          <div className="flex items-center gap-1.5 mb-1">
                            {isEntrada ? (
                              <>
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">
                                  {msg.nome_contato || 'Cliente'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Bot className="h-3 w-3 text-green-600" />
                                <span className="text-xs font-medium text-green-600">
                                  Sistema
                                </span>
                              </>
                            )}
                          </div>

                          {/* Conteúdo */}
                          {msg.tipo === 'text' || !msg.tipo ? (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.mensagem}
                            </p>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {msg.tipo === 'image' && '📷 Imagem'}
                              {msg.tipo === 'document' && `📄 ${msg.media_filename || 'Documento'}`}
                              {msg.tipo === 'audio' && '🎵 Áudio'}
                              {msg.tipo === 'video' && '🎬 Vídeo'}
                              {msg.mensagem && (
                                <span className="text-foreground">{msg.mensagem}</span>
                              )}
                            </div>
                          )}

                          {/* Footer com hora e status */}
                          <div className="flex items-center justify-end gap-1.5 mt-1.5">
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </span>
                            {!isEntrada && (
                              <span className={cn("text-[10px]", getStatusColor(msg.status))}>
                                {getStatusIcon(msg.status)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Botão para scroll down */}
            {!autoScroll && (
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-2 right-2 rounded-full shadow-lg"
                onClick={() => {
                  setAutoScroll(true);
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                  }
                }}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
