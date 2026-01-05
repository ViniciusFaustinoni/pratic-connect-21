import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type EmailTemplate = 
  | 'boas-vindas'
  | 'boleto-gerado'
  | 'pagamento-confirmado'
  | 'sinistro-status'
  | 'contrato-ativado'
  | 'boleto-vencendo'
  | 'recuperacao-senha'
  | 'generico';

interface EnviarEmailParams {
  template: EmailTemplate;
  to: string;
  data: Record<string, unknown>;
}

export function useEnviarEmail() {
  return useMutation({
    mutationFn: async (params: EnviarEmailParams) => {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: params,
      });
      
      if (error) {
        console.error('Erro ao enviar email:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success('Email enviado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao enviar email:', error);
      toast.error('Erro ao enviar email. Tente novamente.');
    },
  });
}

// Hook para envio silencioso (sem toast)
export function useEnviarEmailSilencioso() {
  return useMutation({
    mutationFn: async (params: EnviarEmailParams) => {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: params,
      });
      
      if (error) {
        console.error('Erro ao enviar email:', error);
        throw error;
      }
      
      return data;
    },
  });
}
