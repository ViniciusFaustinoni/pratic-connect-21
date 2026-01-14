import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AutentiqueStatusPublicoParams {
  documentoId: string | undefined;
  contratoToken?: string;
  enabled?: boolean;
}

interface SignatureStatus {
  name: string;
  email: string;
  status: 'pending' | 'viewed' | 'signed' | 'rejected';
  signed: string | null;
  rejected: { date: string; reason: string } | null;
}

interface AutentiqueStatusResponse {
  success: boolean;
  error?: string;
  document?: {
    id: string;
    name: string;
    status: 'pending' | 'in_progress' | 'signed' | 'rejected';
    signedFileUrl: string | null;
  };
  signatures?: SignatureStatus[];
}

export function useAutentiqueStatusPublico({
  documentoId,
  contratoToken,
  enabled = true
}: AutentiqueStatusPublicoParams) {
  const queryClient = useQueryClient();

  return useQuery<AutentiqueStatusResponse>({
    queryKey: ['autentique-status-publico', documentoId],
    queryFn: async () => {
      if (!documentoId) throw new Error('Document ID não fornecido');

      console.log('[useAutentiqueStatusPublico] Verificando status do documento:', documentoId);

      const { data, error } = await supabase.functions.invoke('autentique-status', {
        body: { documentId: documentoId },
      });

      if (error) {
        console.error('[useAutentiqueStatusPublico] Erro:', error);
        throw error;
      }

      console.log('[useAutentiqueStatusPublico] Resposta:', data);

      // Se assinado, invalidar queries do contrato para atualizar a UI
      if (data?.document?.status === 'signed' && contratoToken) {
        console.log('[useAutentiqueStatusPublico] Documento assinado! Invalidando queries...');
        queryClient.invalidateQueries({ queryKey: ['contrato-publico', contratoToken] });
      }

      return data;
    },
    enabled: enabled && !!documentoId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Parar polling quando assinado ou rejeitado
      if (data?.document?.status === 'signed' || data?.document?.status === 'rejected') {
        console.log('[useAutentiqueStatusPublico] Polling parado - status final:', data?.document?.status);
        return false;
      }
      return 15000; // 15 segundos
    },
    staleTime: 10000,
    retry: 2,
  });
}
