import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnviarDocumentoWhatsAppParams {
  telefone: string;
  nomeDocumento: string;
  pdfBase64: string;
  mensagem?: string;
  nomeArquivo?: string;
  referenciaId?: string;
  referenciaTipo?: string;
}

interface EnviarDocumentoResult {
  success: boolean;
  mensagemId?: string;
  error?: string;
}

export function useEnviarWhatsApp() {
  const [enviando, setEnviando] = useState(false);

  // Formatar telefone para WhatsApp (55 + DDD + número)
  const formatarTelefone = (telefone: string): string => {
    const numeros = telefone.replace(/\D/g, '');
    if (numeros.startsWith('55') && numeros.length >= 12) {
      return numeros;
    }
    return `55${numeros}`;
  };

  // Converter Uint8Array para Base64
  const arrayBufferToBase64 = (buffer: Uint8Array): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Enviar documento via Evolution API
  const enviarDocumento = async ({
    telefone,
    nomeDocumento,
    pdfBase64,
    mensagem = 'Segue o documento solicitado.',
    nomeArquivo,
    referenciaId,
    referenciaTipo,
  }: EnviarDocumentoWhatsAppParams): Promise<EnviarDocumentoResult> => {
    try {
      setEnviando(true);

      const telefoneFmt = formatarTelefone(telefone);
      const arquivo = nomeArquivo || `${nomeDocumento.replace(/\s/g, '_')}.pdf`;

      // Usar edge function existente whatsapp-send-media
      const { data, error } = await supabase.functions.invoke('whatsapp-send-media', {
        body: {
          telefone: telefoneFmt,
          media_base64: pdfBase64,
          media_type: 'document',
          mimetype: 'application/pdf',
          filename: arquivo,
          caption: mensagem,
          referencia_id: referenciaId,
          referencia_tipo: referenciaTipo,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Documento enviado por WhatsApp!');
        return { success: true, mensagemId: data.mensagem_id };
      } else {
        throw new Error(data.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      console.error('Erro ao enviar WhatsApp:', error);
      toast.error(`Erro ao enviar: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      setEnviando(false);
    }
  };

  // Abrir WhatsApp Web com mensagem (fallback sem API)
  const abrirWhatsAppWeb = (telefone: string, mensagem: string = '') => {
    const telefoneFmt = formatarTelefone(telefone);
    const mensagemEncoded = encodeURIComponent(mensagem);
    const url = `https://wa.me/${telefoneFmt}?text=${mensagemEncoded}`;
    window.open(url, '_blank');
  };

  return {
    enviarDocumento,
    abrirWhatsAppWeb,
    formatarTelefone,
    arrayBufferToBase64,
    enviando,
  };
}
