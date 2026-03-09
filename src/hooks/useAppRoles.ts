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
  permissions: string[];
  area_icon: string;
  area_color: string;
  is_operational: boolean;
  redirect_path: string | null;
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
      return (data || []).map((r: any) => ({
        ...r,
        permissions: Array.isArray(r.permissions) ? r.permissions : [],
      })) as AppRoleConfig[];
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

  /**
   * Retorna union de permissions para um conjunto de roles do usuário.
   * Usado por usePermissions para derivar canXxx do banco.
   */
  const getPermissionsForRoles = (userRoles: string[]): Set<string> => {
    const perms = new Set<string>();
    for (const ur of userRoles) {
      const config = roles.find(r => r.role === ur);
      if (config?.permissions) {
        for (const p of config.permissions) {
          perms.add(p);
        }
      }
    }
    return perms;
  };

  /**
   * Retorna dados de área (icon, color) a partir dos roles registrados.
   * Usado por Perfis.tsx para styling dinâmico.
   */
  const getAreaStyles = (): Record<string, { icon: string; color: string }> => {
    const map: Record<string, { icon: string; color: string }> = {};
    roles.forEach(r => {
      if (!map[r.area]) {
        map[r.area] = { icon: r.area_icon, color: r.area_color };
      }
    });
    return map;
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
    getPermissionsForRoles,
    getAreaStyles,
    roleLabelsMap,
  };
}
