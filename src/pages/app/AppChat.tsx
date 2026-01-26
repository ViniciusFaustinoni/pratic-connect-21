import { useEffect, useRef } from 'react';
import { ArrowLeft, Trash2, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/components/app/chat/ChatMessage';
import { ChatInput } from '@/components/app/chat/ChatInput';
import { ChatSuggestions } from '@/components/app/chat/ChatSuggestions';
import { useAssistenteChat } from '@/hooks/useAssistenteChat';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function AppChat() {
  const navigate = useNavigate();
  const { messages, isLoading, isTranscribing, sendMessage, sendAudio, clearMessages } = useAssistenteChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-background">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/app')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold">Assistente PRATIC</h1>
              <p className="text-xs text-muted-foreground">
                {isTranscribing ? 'Transcrevendo...' : isLoading ? 'Digitando...' : 'Online'}
              </p>
            </div>
          </div>
        </div>

        {hasMessages && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="h-5 w-5 text-muted-foreground" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar conversa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todas as mensagens serão removidas. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={clearMessages}>
                  Limpar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {hasMessages ? (
          <div className="flex flex-col">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                timestamp={message.timestamp}
                isLoading={message.isLoading}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <ChatSuggestions onSelect={sendMessage} disabled={isLoading} />
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        onSend={sendMessage}
        onSendAudio={sendAudio}
        isLoading={isLoading}
        isTranscribing={isTranscribing}
        placeholder="Digite ou grave sua mensagem..."
      />
    </div>
  );
}
