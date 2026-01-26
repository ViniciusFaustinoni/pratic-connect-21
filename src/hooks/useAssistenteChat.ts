import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  isAudio?: boolean;
}

export function useAssistenteChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

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
        toast.error('Limite de requisições. Aguarde alguns segundos.');
      } else if (errorMessage.includes('402') || errorMessage.includes('Créditos')) {
        toast.error('Serviço de IA temporariamente indisponível.');
      } else {
        toast.error('Não foi possível processar sua mensagem.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const sendAudio = useCallback(async (audioBlob: Blob) => {
    if (isLoading || isTranscribing) return;

    // Placeholder para feedback visual
    const userMessageId = crypto.randomUUID();
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: '🎤 Transcrevendo áudio...',
      timestamp: new Date(),
      isAudio: true,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setIsTranscribing(true);

    try {
      // 1. Transcrever áudio via Edge Function
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const { data, error } = await supabase.functions.invoke('transcrever-audio', {
        body: formData,
      });

      if (error) {
        console.error('[useAssistenteChat] Erro na transcrição:', error);
        throw new Error('Falha na transcrição do áudio');
      }

      if (!data?.text) {
        throw new Error('Nenhum texto foi transcrito');
      }

      const transcribedText = data.text;
      console.log('[useAssistenteChat] Áudio transcrito:', transcribedText);

      // 2. Atualizar mensagem do usuário com texto transcrito
      setMessages(prev => prev.map(m => 
        m.id === userMessageId 
          ? { ...m, content: transcribedText, isAudio: false }
          : m
      ));

      setIsTranscribing(false);

      // 3. Adicionar placeholder do assistente
      const assistantPlaceholder: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      };

      setMessages(prev => [...prev, assistantPlaceholder]);

      // 4. Enviar texto para a IA
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data: aiData, error: aiError } = await supabase.functions.invoke('assistente-chat', {
        body: {
          messages: [{ role: 'user', content: transcribedText }],
          conversationHistory,
        },
      });

      if (aiError) {
        throw new Error(aiError.message || 'Erro ao processar mensagem');
      }

      const assistantContent = aiData?.content || 'Desculpe, não consegui processar sua solicitação.';

      // 5. Atualizar placeholder com resposta
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantPlaceholder.id
            ? { ...msg, content: assistantContent, isLoading: false }
            : msg
        )
      );

    } catch (error) {
      console.error('[useAssistenteChat] Erro ao processar áudio:', error);
      
      // Remover mensagem do usuário em caso de erro
      setMessages(prev => prev.filter(m => m.id !== userMessageId));
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(errorMessage || 'Não foi possível processar o áudio');
    } finally {
      setIsLoading(false);
      setIsTranscribing(false);
    }
  }, [messages, isLoading, isTranscribing]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    isTranscribing,
    sendMessage,
    sendAudio,
    clearMessages,
  };
}
