import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useRef } from 'react';

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
  const hasSyncedRef = useRef(false);

  const query = useQuery<AutentiqueStatusResponse>({
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
      return 10000; // 10 segundos - sincronização automática
    },
    staleTime: 8000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff: 1s, 2s, 4s, max 10s
  });

  // Efeito para atualizar queries quando status mudar para assinado
  // Também chama a função de sync para garantir que o banco seja atualizado
  useEffect(() => {
    if (query.data?.document?.status === 'signed' && contratoToken && !hasSyncedRef.current) {
      console.log('[useAutentiqueStatusPublico] Documento assinado detectado via polling!');
      hasSyncedRef.current = true;
      
      // Atualização otimista dos dados do contrato
      queryClient.setQueryData(['contrato-publico', contratoToken], (old: any) => {
        if (old) {
          return { 
            ...old, 
            status: 'assinado', 
            autentique_status: 'signed',
            data_assinatura: new Date().toISOString()
          };
        }
        return old;
      });
      
      // Chamar a função de sync para garantir que o banco foi atualizado
      // Isso serve como backup caso o webhook não tenha funcionado
      console.log('[useAutentiqueStatusPublico] Chamando autentique-sync-contrato para garantir atualização...');
      supabase.functions.invoke('autentique-sync-contrato', {
        body: { contratoToken }
      }).then((result) => {
        console.log('[useAutentiqueStatusPublico] Sync result:', result.data);
        if (result.data?.atualizado) {
          console.log('[useAutentiqueStatusPublico] Banco atualizado com sucesso!');
        }
        // Invalidar e forçar refetch
        queryClient.invalidateQueries({ queryKey: ['contrato-publico', contratoToken] });
        queryClient.refetchQueries({ queryKey: ['contrato-publico', contratoToken] });
      }).catch((error) => {
        console.error('[useAutentiqueStatusPublico] Erro ao sincronizar:', error);
        // Ainda assim invalidar queries
        queryClient.invalidateQueries({ queryKey: ['contrato-publico', contratoToken] });
      });
    }
  }, [query.data?.document?.status, contratoToken, queryClient]);

  // Reset sync flag quando contratoToken mudar
  useEffect(() => {
    hasSyncedRef.current = false;
  }, [contratoToken]);

  return query;
}
