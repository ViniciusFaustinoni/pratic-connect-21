import { useEffect, useState } from 'react';
import { publicSupabase } from '@/integrations/supabase/publicClient';

interface BiometricStatusResult {
  biometric_status: 'review' | 'rejected' | null;
  loading: boolean;
}

/**
 * Hook leve que faz polling do `autentique-sync-contrato` para detectar
 * o estado "biometric_review" — quando o cliente concluiu a selfie mas o
 * Autentique exige aprovação manual da biometria.
 *
 * Usa intervalo conservador (60s) para não consumir créditos da API.
 */
export function useAutentiqueBiometricStatus(
  contratoId: string | null,
  enabled: boolean = true,
): BiometricStatusResult {
  const [status, setStatus] = useState<'review' | 'rejected' | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !contratoId) return;

    let mounted = true;

    const check = async () => {
      try {
        setLoading(true);
        const { data } = await publicSupabase.functions.invoke('autentique-sync-contrato', {
          body: { contratoId },
        });
        if (!mounted) return;
        const bio = (data?.biometric_status as 'review' | 'rejected' | null) ?? null;
        setStatus(bio);
      } catch (err) {
        console.error('[useAutentiqueBiometricStatus] erro:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [contratoId, enabled]);

  return { biometric_status: status, loading };
}
