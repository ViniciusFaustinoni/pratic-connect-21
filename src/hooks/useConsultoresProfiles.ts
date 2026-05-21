import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolve nomes de consultores a partir de IDs heterogêneos:
 * - `profileIds`: valores que casam com `profiles.id` (ex.: solicitacoes_troca_titularidade.criado_por, solicitacoes_migracao.consultor_id)
 * - `userIds`: valores que casam com `profiles.user_id` (ex.: substituicoes_veiculo.criado_por, cotacoes.vendedor_id)
 *
 * Leitura pura, sem side-effects. Usada apenas para exibir o nome no card.
 */
export function useConsultoresProfiles(
  profileIds: (string | null | undefined)[],
  userIds: (string | null | undefined)[],
) {
  const pIds = useMemo(
    () => Array.from(new Set(profileIds.filter(Boolean) as string[])),
    [profileIds],
  );
  const uIds = useMemo(
    () => Array.from(new Set(userIds.filter(Boolean) as string[])),
    [userIds],
  );

  const enabled = pIds.length > 0 || uIds.length > 0;

  return useQuery({
    queryKey: ['consultores-processos', pIds, uIds],
    enabled,
    queryFn: async () => {
      const byProfileId: Record<string, { nome: string }> = {};
      const byUserId: Record<string, { nome: string }> = {};

      const promises: Promise<unknown>[] = [];

      if (pIds.length > 0) {
        promises.push(
          (async () => {
            const { data } = await supabase
              .from('profiles')
              .select('id, user_id, nome')
              .in('id', pIds);
            (data || []).forEach((p: any) => {
              if (p.nome) {
                byProfileId[p.id] = { nome: p.nome };
                if (p.user_id) byUserId[p.user_id] = { nome: p.nome };
              }
            });
          })(),
        );
      }

      if (uIds.length > 0) {
        promises.push(
          (async () => {
            const { data } = await supabase
              .from('profiles')
              .select('id, user_id, nome')
              .in('user_id', uIds);
            (data || []).forEach((p: any) => {
              if (p.nome) {
                byUserId[p.user_id] = { nome: p.nome };
                byProfileId[p.id] = { nome: p.nome };
              }
            });
          })(),
        );
      }

      await Promise.all(promises);
      return { byProfileId, byUserId };
    },
  });
}
