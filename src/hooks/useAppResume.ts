import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que detecta quando o app volta ao foreground (visibilitychange/focus)
 * e tenta recuperar a sessão Supabase, evitando tela branca.
 */
export function useAppResume() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const lastResumeRef = useRef(0);

  useEffect(() => {
    const handleResume = async () => {
      // Throttle: no máximo 1 tentativa a cada 5 segundos
      const now = Date.now();
      if (now - lastResumeRef.current < 5000) return;
      lastResumeRef.current = now;

      if (document.visibilityState !== 'visible') return;

      console.log('[useAppResume] App voltou ao foreground, verificando sessão...');

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.warn('[useAppResume] Sessão inválida, tentando refresh...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError || !refreshData.session) {
            console.error('[useAppResume] Refresh falhou, redirecionando para login');
            navigate('/instalador/login', { replace: true });
            return;
          }

          console.log('[useAppResume] Sessão restaurada via refresh');
        }

        // Sessão OK - invalidar queries stale para atualizar dados
        queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
        queryClient.invalidateQueries({ queryKey: ['servicos'] });
      } catch (err) {
        console.error('[useAppResume] Erro ao verificar sessão:', err);
        navigate('/instalador/login', { replace: true });
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, [queryClient, navigate]);
}
