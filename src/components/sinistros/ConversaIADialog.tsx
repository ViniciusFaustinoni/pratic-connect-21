import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bot, User, X, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MensagemChat {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface ConversaIADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensagens: MensagemChat[];
  associadoNome?: string;
  dataConversa?: string;
}

export function ConversaIADialog({
  open,
  onOpenChange,
  mensagens,
  associadoNome,
  dataConversa,
}: ConversaIADialogProps) {
  const formatTime = (date: string) => {
    return format(new Date(date), "HH:mm", { locale: ptBR });
  };

  const formatFullDate = (date: string) => {
    return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversa com Assistente IA
          </DialogTitle>
          {(associadoNome || dataConversa) && (
            <p className="text-sm text-muted-foreground">
              {associadoNome && <span className="font-medium">{associadoNome}</span>}
              {associadoNome && dataConversa && ' • '}
              {dataConversa && formatFullDate(dataConversa)}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4 py-4">
            {mensagens.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma mensagem encontrada
              </p>
            ) : (
              mensagens.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role !== 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2",
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {/* Remove marcadores de UI do conteúdo exibido */}
                      {msg.content
                        .replace(/\[BOTAO_LOCALIZACAO\]/g, '')
                        .replace(/\[UPLOAD_BO\]/g, '')
                        .replace(/\[UPLOAD_FOTOS\]/g, '')
                        .replace(/\[UPLOAD_DOCUMENTO\]/g, '')
                        .replace(/\[LINK_AUTO_VISTORIA\]/g, '📋 (Link de auto-vistoria enviado)')
                        .trim()}
                    </p>
                    <p
                      className={cn(
                        "text-xs mt-1",
                        msg.role === 'user'
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      )}
                    >
                      {formatTime(msg.created_at)}
                    </p>
                  </div>

                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
