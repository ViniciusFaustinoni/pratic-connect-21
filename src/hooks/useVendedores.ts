import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

export interface Vendedor extends Profile {
  roles?: string[];
}

export function useVendedores() {
  return useQuery({
    queryKey: ['vendedores'],
    queryFn: async () => {
      // Buscar profiles que têm roles de vendedor
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['vendedor_clt', 'vendedor_externo', 'supervisor_vendas', 'gerente_comercial', 'diretor']);

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) return [];

      // Pegar IDs únicos de usuários com roles de vendas
      const userIds = [...new Set(roles.map((r) => r.user_id))];

      // Buscar profiles desses usuários
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds)
        .eq('ativo', true)
        .order('nome');

      if (profilesError) throw profilesError;

      // Associar roles aos profiles
      return (profiles || []).map((profile) => ({
        ...profile,
        roles: roles
          .filter((r) => r.user_id === profile.user_id)
          .map((r) => r.role),
      })) as Vendedor[];
    },
  });
}
