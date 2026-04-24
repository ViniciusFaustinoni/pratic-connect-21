import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const VENDOR_ROLES = ['vendedor_clt', 'vendedor_externo', 'agencia'];

/**
 * Retorna o conjunto de profile.id de vendedores ativos (vendedor_clt, vendedor_externo, agencia)
 * que ainda não possuem `codigo_sga_voluntario` cadastrado.
 *
 * Usado para alertar na tela de Atribuição de Grades — sem esse código a sincronização
 * com o SGA Hinova é bloqueada (erro `vendedor_sem_codigo_sga`).
 */
export function useVendedoresSemCodigoSga() {
  return useQuery({
    queryKey: ['vendedores-sem-codigo-sga'],
    queryFn: async () => {
      // 1) auth_user_ids dos roles de vendedor
      const { data: roles, error: rolesErr } = await (supabase as any)
        .from('user_roles')
        .select('user_id, role')
        .in('role', VENDOR_ROLES);
      if (rolesErr) throw rolesErr;

      const authUserIds = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (authUserIds.length === 0) {
        return { ids: new Set<string>(), total: 0 };
      }

      // 2) profiles desses auth.users — apenas os SEM codigo_sga_voluntario
      const { data: profiles, error: profErr } = await (supabase as any)
        .from('profiles')
        .select('id, codigo_sga_voluntario, ativo, tipo')
        .in('user_id', authUserIds)
        .neq('tipo', 'associado');
      if (profErr) throw profErr;

      const semCodigo = (profiles || []).filter(
        (p: any) =>
          (p.ativo ?? true) &&
          (!p.codigo_sga_voluntario || String(p.codigo_sga_voluntario).trim() === ''),
      );

      return {
        ids: new Set<string>(semCodigo.map((p: any) => p.id as string)),
        total: semCodigo.length,
      };
    },
    staleTime: 60 * 1000,
  });
}
