import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { PRAZOS_DEFAULT, type PrazosPorUF } from '@/lib/agendamento/janelaInstalacao';

/**
 * Hook público (anon) para ler os prazos de instalação por UF a partir de
 * `configuracoes`. Usa a RPC `get_app_config()` (STABLE + SECURITY DEFINER,
 * GRANT EXECUTE TO anon) — mesma fonte do cron de suspensão de cobertura.
 *
 * Cache global de 10 min para evitar refetch em cada etapa do link público.
 */
export function usePrazosInstalacaoPublic(): PrazosPorUF {
  const { data } = useQuery({
    queryKey: ['prazos-instalacao-public'],
    queryFn: async (): Promise<PrazosPorUF> => {
      const { data, error } = await publicSupabase.rpc('get_app_config');
      if (error || !data || typeof data !== 'object') return PRAZOS_DEFAULT;

      const map = data as Record<string, unknown>;
      const parse = (v: unknown, fallback: number) => {
        const n = parseInt(String(v ?? ''), 10);
        return Number.isFinite(n) && n > 0 ? n : fallback;
      };
      return {
        rj: parse(map['prazo_instalacao_horas_rj'], PRAZOS_DEFAULT.rj),
        sp: parse(map['prazo_instalacao_horas_sp'], PRAZOS_DEFAULT.sp),
        default: parse(map['prazo_instalacao_autovistoria_horas'], PRAZOS_DEFAULT.default),
      };
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });

  return data ?? PRAZOS_DEFAULT;
}
