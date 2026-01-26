import { cn } from '@/lib/utils';
import { Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { LocationButton } from './LocationButton';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  onLocationCapture?: (latitude: number, longitude: number) => void;
}

export function ChatMessage({ role, content, timestamp, isLoading, onLocationCapture }: ChatMessageProps) {
  const isUser = role === 'user';
  
  // Verificar se a mensagem contém o marcador de botão de localização
  const hasLocationButton = !isUser && content.includes('[BOTAO_LOCALIZACAO]');
  
  // Remover o marcador do conteúdo para exibição
  const displayContent = content.replace('[BOTAO_LOCALIZACAO]', '').trim();
  return (
    <div
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-1',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-2',
            isUser
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-bl-md bg-muted'
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-2 py-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Digitando...</span>
            </div>
          ) : isUser ? (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  // Style links
                  a: ({ children, ...props }) => (
                    <a {...props} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  // Style lists
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 my-2">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 my-2">{children}</ol>
                  ),
                  // Style paragraphs
                  p: ({ children }) => (
                    <p className="my-1 leading-relaxed">{children}</p>
                  ),
                  // Style code
                  code: ({ children }) => (
                    <code className="bg-background/50 px-1 py-0.5 rounded text-xs">
                      {children}
                    </code>
                  ),
                  // Style strong
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                }}
              >
                {displayContent}
              </ReactMarkdown>
              
              {/* Renderizar botão de localização se necessário */}
              {hasLocationButton && onLocationCapture && (
                <LocationButton 
                  onLocationCapture={onLocationCapture}
                  disabled={isLoading}
                />
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground px-1">
          {timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
