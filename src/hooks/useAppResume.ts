import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook que detecta quando o app volta ao foreground e apenas
 * invalida queries stale para refetch normal do React Query.
 *
 * NÃO chama supabase.auth.getSession()/refreshSession() manualmente:
 * o cliente Supabase já faz autoRefreshToken sozinho. Chamar aqui
 * causava cascata de refresh quando o backend estava degradado
 * (loop eterno de login).
 */
export function useAppResume() {
  const queryClient = useQueryClient();
  const lastResumeRef = useRef(0);

  useEffect(() => {
    const handleResume = () => {
      // Throttle: no máximo 1 invalidação a cada 30 segundos
      const now = Date.now();
      if (now - lastResumeRef.current < 30000) return;
      lastResumeRef.current = now;

      if (document.visibilityState !== 'visible') return;

      // Apenas invalidar queries operacionais para refetch.
      // O React Query trata staleTime e o Supabase trata refresh do token.
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, [queryClient]);
}
