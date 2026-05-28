import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EnviarTestePayload {
  destinatario: string;
  variaveis?: {
    nome_cliente?: string;
    motivo_suspensao?: string;
    data?: string;
  };
}

export interface EnviarTesteResultado {
  ok: boolean;
  status: 'entregue' | 'falhou' | string;
  erro?: string;
  http_status?: number;
  id?: string;
}

export function useEnviarEmailTeste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: EnviarTestePayload): Promise<EnviarTesteResultado> => {
      const { data, error } = await supabase.functions.invoke(
        'enviar-email-suspensao-teste',
        { body: payload },
      );
      if (error) {
        throw new Error(error.message || 'Falha ao chamar o serviço de envio');
      }
      return data as EnviarTesteResultado;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['email-suspensao', 'envios'] });
      qc.invalidateQueries({ queryKey: ['email-suspensao', 'fluxos-distintos'] });
      if (res.ok) {
        toast.success('E-mail de teste enviado');
      } else {
        toast.error(`Falha no envio: ${res.erro ?? 'erro desconhecido'}`);
      }
    },
    onError: (e: any) => {
      qc.invalidateQueries({ queryKey: ['email-suspensao', 'envios'] });
      toast.error(e?.message || 'Erro ao enviar e-mail de teste');
    },
  });
}
