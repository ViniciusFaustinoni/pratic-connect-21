import { supabase } from '@/integrations/supabase/client';

export interface ExportFilters {
  roles?: string[]; // se vazio/undefined => todos os perfis (exceto associado)
  tipo?: 'funcionario' | 'prestador' | 'agencia' | 'todos';
  status?: 'ativo' | 'inativo' | 'todos';
}

export interface UsuarioExportRow {
  id: string;
  user_id: string | null;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  tipo: string | null;
  ativo: boolean | null;
  bloqueado: boolean | null;
  codigo_sga_voluntario: string | null;
  created_at: string | null;
  data_ultimo_acesso: string | null;
  roles: string[];
}

const CHUNK = 1000;

/** Busca usuários (sem paginação) com seus roles, aplicando filtros server-side. */
export async function fetchUsuariosForExport(
  filters: ExportFilters
): Promise<UsuarioExportRow[]> {
  // 1) Resolver user_ids pelos roles selecionados (se houver seleção)
  let userIdsByRole: string[] | null = null;
  if (filters.roles && filters.roles.length > 0) {
    const { data: rolesData, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', filters.roles as any);
    if (error) throw error;
    userIdsByRole = Array.from(new Set((rolesData || []).map(r => r.user_id).filter(Boolean) as string[]));
    if (userIdsByRole.length === 0) return [];
  }

  // 2) Buscar profiles em chunks (rompe limite de 1000 do Supabase)
  const allProfiles: any[] = [];
  let from = 0;
  // Ordem estável por nome
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase
      .from('profiles')
      .select('id, user_id, nome, email, telefone, cpf, tipo, ativo, bloqueado, codigo_sga_voluntario, created_at, data_ultimo_acesso')
      .neq('tipo', 'associado')
      .order('nome', { ascending: true })
      .range(from, from + CHUNK - 1);

    if (userIdsByRole) q = q.in('user_id', userIdsByRole);
    if (filters.tipo && filters.tipo !== 'todos') q = q.eq('tipo', filters.tipo);
    if (filters.status === 'ativo') q = q.eq('ativo', true);
    if (filters.status === 'inativo') q = q.eq('ativo', false);

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    allProfiles.push(...data);
    if (data.length < CHUNK) break;
    from += CHUNK;
  }

  if (allProfiles.length === 0) return [];

  // 3) Buscar TODOS os roles desses user_ids (chunked por segurança em IN())
  const userIds = Array.from(new Set(allProfiles.map(p => p.user_id).filter(Boolean) as string[]));
  const rolesByUser = new Map<string, string[]>();

  for (let i = 0; i < userIds.length; i += 500) {
    const slice = userIds.slice(i, i + 500);
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', slice);
    if (error) throw error;
    (data || []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) || [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
  }

  return allProfiles.map(p => ({
    ...p,
    roles: p.user_id ? (rolesByUser.get(p.user_id) || []) : [],
  })) as UsuarioExportRow[];
}

/** Conta usuários que serão exportados (preview rápido, sem trazer dados). */
export async function countUsuariosForExport(filters: ExportFilters): Promise<number> {
  let userIdsByRole: string[] | null = null;
  if (filters.roles && filters.roles.length > 0) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', filters.roles as any);
    if (error) throw error;
    userIdsByRole = Array.from(new Set((data || []).map(r => r.user_id).filter(Boolean) as string[]));
    if (userIdsByRole.length === 0) return 0;
  }

  let q = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .neq('tipo', 'associado');

  if (userIdsByRole) q = q.in('user_id', userIdsByRole);
  if (filters.tipo && filters.tipo !== 'todos') q = q.eq('tipo', filters.tipo);
  if (filters.status === 'ativo') q = q.eq('ativo', true);
  if (filters.status === 'inativo') q = q.eq('ativo', false);

  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}
