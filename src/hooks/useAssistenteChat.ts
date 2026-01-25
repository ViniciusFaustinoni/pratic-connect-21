import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

export function useAssistenteChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    // Add user message and placeholder for assistant
    const assistantPlaceholder: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, assistantPlaceholder]);
    setIsLoading(true);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke('assistente-chat', {
        body: {
          messages: [{ role: 'user', content: content.trim() }],
          conversationHistory,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao processar mensagem');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantContent = data?.content || 'Desculpe, não consegui processar sua solicitação.';

      // Update the placeholder with actual response
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantPlaceholder.id
            ? { ...msg, content: assistantContent, isLoading: false }
            : msg
        )
      );
    } catch (error) {
      console.error('[useAssistenteChat] Erro:', error);
      
      // Remove placeholder and show error
      setMessages(prev => prev.filter(msg => msg.id !== assistantPlaceholder.id));
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (errorMessage.includes('429') || errorMessage.includes('Limite')) {
        toast({
          title: 'Limite de requisições',
          description: 'Aguarde alguns segundos e tente novamente.',
          variant: 'destructive',
        });
      } else if (errorMessage.includes('402') || errorMessage.includes('Créditos')) {
        toast({
          title: 'Serviço indisponível',
          description: 'O serviço de IA está temporariamente indisponível.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro',
          description: 'Não foi possível processar sua mensagem. Tente novamente.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  };
}
