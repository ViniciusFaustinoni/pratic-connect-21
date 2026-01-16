import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Signatario {
  nome: string;
  email: string;
  telefone?: string;
  funcao: 'assinar' | 'testemunha' | 'aprovar';
}

interface EnviarParaAssinaturaParams {
  documentoGeradoId: string;
  nomeDocumento: string;
  pdfBase64: string;
  signatarios: Signatario[];
  mensagem?: string;
  prazoHoras?: number;
}

interface StatusAssinatura {
  status: string;
  assinados: number;
  totalSignatarios: number;
  urlAssinado?: string;
  detalhes: any[];
}

export function useAutentiqueDocumento() {
  const [enviando, setEnviando] = useState(false);
  const [consultando, setConsultando] = useState(false);

  // Converter Uint8Array para Base64
  const arrayBufferToBase64 = (buffer: Uint8Array): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Enviar documento para assinatura
  const enviarParaAssinatura = async (params: EnviarParaAssinaturaParams) => {
    try {
      setEnviando(true);

      const { data, error } = await supabase.functions.invoke('autentique-documento', {
        body: {
          action: 'enviar',
          ...params,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Documento enviado para assinatura!');
        return {
          success: true,
          assinaturaId: data.assinatura.id,
          linkAssinatura: data.linkAssinatura,
        };
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Erro ao enviar para assinatura:', error);
      toast.error(`Erro ao enviar: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      setEnviando(false);
    }
  };

  // Consultar status da assinatura
  const consultarStatus = async (assinaturaId: string): Promise<StatusAssinatura | null> => {
    try {
      setConsultando(true);

      const { data, error } = await supabase.functions.invoke('autentique-documento', {
        body: {
          action: 'status',
          assinaturaId,
        },
      });

      if (error) throw error;

      if (data.success) {
        return {
          status: data.status,
          assinados: data.assinados,
          totalSignatarios: data.totalSignatarios,
          urlAssinado: data.urlAssinado,
          detalhes: data.detalhes,
        };
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Erro ao consultar status:', error);
      toast.error(`Erro ao consultar: ${error.message}`);
      return null;
    } finally {
      setConsultando(false);
    }
  };

  // Cancelar assinatura
  const cancelarAssinatura = async (assinaturaId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('autentique-documento', {
        body: {
          action: 'cancelar',
          assinaturaId,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Assinatura cancelada');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Erro ao cancelar:', error);
      toast.error(`Erro ao cancelar: ${error.message}`);
      return false;
    }
  };

  // Buscar assinaturas de um documento
  const buscarAssinaturas = async (documentoGeradoId: string) => {
    const { data, error } = await supabase
      .from('documento_assinaturas')
      .select('*')
      .eq('documento_gerado_id', documentoGeradoId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar assinaturas:', error);
      return [];
    }

    return data;
  };

  return {
    enviarParaAssinatura,
    consultarStatus,
    cancelarAssinatura,
    buscarAssinaturas,
    arrayBufferToBase64,
    enviando,
    consultando,
  };
}
