import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WhatsAppMediaType } from '@/types/whatsapp';

interface SendMediaParams {
  telefone: string;
  media_url?: string;
  media_base64?: string;
  media_type: WhatsAppMediaType;
  mimetype: string;
  filename?: string;
  caption?: string;
  instancia_id?: string;
  referencia_tipo?: string;
  referencia_id?: string;
}

interface SendMediaResponse {
  success: boolean;
  mensagem_id?: string;
  message_id?: string;
  error?: string;
}

export function useWhatsAppSendMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendMediaParams): Promise<SendMediaResponse> => {
      const { data, error } = await supabase.functions.invoke('whatsapp-send-media', {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-mensagens'] });
      toast.success('Mídia enviada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar mídia: ${error.message}`);
    },
  });
}

// Função utilitária para detectar media_type pelo mimetype
export function detectMediaType(mimetype: string): WhatsAppMediaType {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  return 'document';
}

// Função utilitária para gerar filename a partir de URL
export function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'arquivo';
    return decodeURIComponent(filename);
  } catch {
    return 'arquivo';
  }
}
