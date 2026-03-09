import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Verifica se o usuário possui uma permissão específica usando a função SQL has_permission.
 * Substitui os checks hardcoded de roles nas edge functions.
 * 
 * @param userId - UUID do usuário (auth.users.id)
 * @param permission - Chave de permissão (ex: 'canCreateUser', 'canDeleteCotacao')
 * @returns boolean
 */
export async function checkPermission(userId: string, permission: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase.rpc('has_permission', {
    _user_id: userId,
    _permission: permission,
  });

  if (error) {
    console.error(`[check-permission] Erro ao verificar permissão '${permission}':`, error);
    return false;
  }

  return data === true;
}

/**
 * Busca user_ids que possuem uma determinada permissão.
 * Substitui queries como `.eq('role', 'diretor')` para notificações.
 * 
 * @param permission - Chave de permissão
 * @returns Array de user_ids
 */
export async function getUsersWithPermission(permission: string): Promise<string[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, role');

  if (error) {
    console.error(`[check-permission] Erro ao buscar users com permissão '${permission}':`, error);
    return [];
  }

  // Buscar configs de roles que possuem essa permissão
  const { data: configs } = await supabase
    .from('app_roles_config')
    .select('role, permissions')
    .eq('is_active', true);

  if (!configs) return [];

  const rolesWithPerm = new Set(
    configs
      .filter(c => {
        const perms = Array.isArray(c.permissions) ? c.permissions : [];
        return perms.includes(permission);
      })
      .map(c => c.role)
  );

  const userIds = [...new Set(
    (data || [])
      .filter(r => rolesWithPerm.has(r.role))
      .map(r => r.user_id)
  )];

  return userIds;
}

/**
 * Busca user_ids que possuem um role específico.
 * Para casos onde realmente precisa do role (notificações a analistas específicos).
 */
export async function getUsersWithRole(role: string): Promise<string[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', role);

  if (error) {
    console.error(`[check-permission] Erro ao buscar users com role '${role}':`, error);
    return [];
  }

  return (data || []).map(r => r.user_id);
}

/**
 * Busca user_ids por área funcional (ex: 'Comercial', 'Monitoramento').
 * Substitui queries com listas hardcoded de roles.
 */
export async function getUsersByArea(area: string): Promise<string[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Buscar roles da área
  const { data: configs } = await supabase
    .from('app_roles_config')
    .select('role')
    .eq('area', area)
    .eq('is_active', true);

  if (!configs?.length) return [];

  const areaRoles = configs.map(c => c.role);

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', areaRoles);

  return [...new Set((userRoles || []).map(r => r.user_id))];
}
