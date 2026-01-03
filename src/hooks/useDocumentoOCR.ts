import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OCRResult {
  tipo: string;
  nome: string | null;
  cpf: string | null;
  validade: string | null;
  legivel: boolean;
  valido: boolean;
  sugestao: 'aprovar' | 'reprovar' | 'revisar';
  motivo: string;
  confianca: number;
}

interface OCRRequest {
  url: string;
  tipoEsperado?: string;
  cpfEsperado?: string;
  nomeEsperado?: string;
}

export function useDocumentoOCR() {
  return useMutation({
    mutationFn: async ({ url, tipoEsperado, cpfEsperado, nomeEsperado }: OCRRequest) => {
      const { data, error } = await supabase.functions.invoke('document-ocr', {
        body: { 
          url, 
          tipoEsperado,
          cpfEsperado,
          nomeEsperado,
        },
      });

      if (error) throw error;
      return data as OCRResult;
    },
  });
}
