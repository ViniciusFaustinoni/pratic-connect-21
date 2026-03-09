import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AppRoleConfig {
  role: string;
  label: string;
  description: string;
  area: string;
  sigla: string;
  color: string;
  icon_name: string;
  sort_order: number;
  is_active: boolean;
}

/**
 * Hook centralizado que busca app_roles_config do banco.
 * Fonte única de verdade para roles/perfis no sistema.
 * Stale time de 30min — dados raramente mudam.
 */
export function useAppRoles() {
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['app-roles-config'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('app_roles_config')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as AppRoleConfig[];
    },
    staleTime: 30 * 60 * 1000, // 30 min
  });

  /** Label para exibição de um role */
  const getRoleLabel = (role: string): string => {
    return roles.find(r => r.role === role)?.label || role;
  };

  /** Cor base do role (ex: 'purple', 'blue') */
  const getRoleColor = (role: string): string => {
    return roles.find(r => r.role === role)?.color || 'gray';
  };

  /** Sigla do role */
  const getRoleSigla = (role: string): string => {
    return roles.find(r => r.role === role)?.sigla || role.substring(0, 3).toUpperCase();
  };

  /** Descrição do role */
  const getRoleDescription = (role: string): string => {
    return roles.find(r => r.role === role)?.description || '';
  };

  /** Área do role */
  const getRoleArea = (role: string): string => {
    return roles.find(r => r.role === role)?.area || 'Outros';
  };

  /** Roles agrupados por área */
  const getRolesByArea = (): Record<string, AppRoleConfig[]> => {
    const grouped: Record<string, AppRoleConfig[]> = {};
    roles.forEach(r => {
      if (!grouped[r.area]) grouped[r.area] = [];
      grouped[r.area].push(r);
    });
    return grouped;
  };

  /** Lista de áreas únicas (ordenadas pelo primeiro role de cada área) */
  const getAreas = (): string[] => {
    const seen = new Set<string>();
    const areas: string[] = [];
    roles.forEach(r => {
      if (!seen.has(r.area)) {
        seen.add(r.area);
        areas.push(r.area);
      }
    });
    return areas;
  };

  /** Options para Select/filtros — exclui 'associado' por default */
  const getRoleOptions = (excludeAssociado = true): { value: string; label: string }[] => {
    return roles
      .filter(r => !excludeAssociado || r.role !== 'associado')
      .map(r => ({ value: r.role, label: r.label }));
  };

  /** Gera classe CSS de badge baseado na cor do role */
  const getRoleBadgeClass = (role: string): string => {
    const color = getRoleColor(role);
    return `bg-${color}-500/20 text-${color}-400 border-${color}-500/30`;
  };

  /** Config completa do role (para rolesConfig-style usage) */
  const getRoleConfig = (role: string): AppRoleConfig | undefined => {
    return roles.find(r => r.role === role);
  };

  /** Mapa label por role (substituto de PERFIL_ACESSO_LABELS) */
  const roleLabelsMap: Record<string, string> = {};
  roles.forEach(r => { roleLabelsMap[r.role] = r.label; });

  return {
    roles,
    isLoading,
    getRoleLabel,
    getRoleColor,
    getRoleSigla,
    getRoleDescription,
    getRoleArea,
    getRolesByArea,
    getAreas,
    getRoleOptions,
    getRoleBadgeClass,
    getRoleConfig,
    roleLabelsMap,
  };
}
