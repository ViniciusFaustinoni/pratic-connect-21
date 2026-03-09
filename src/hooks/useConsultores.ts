import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Consultor {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  avatar_url: string | null;
  ativo: boolean;
  codigo_sga_voluntario: string | null;
  roles: string[];
  total_leads: number;
  total_propostas: number;
}

/**
 * Busca usuários com roles da área Comercial dinamicamente.
 * Substitui lista hardcoded de roles comerciais.
 */
export function useConsultores() {
  return useQuery({
    queryKey: ['consultores'],
    queryFn: async (): Promise<Consultor[]> => {
      // Buscar roles da área Comercial do banco
      const { data: configs } = await supabase
        .from('app_roles_config')
        .select('role')
        .eq('area', 'Comercial')
        .eq('is_active', true);

      const rolesComerciais = (configs || []).map((c: any) => c.role);
      if (rolesComerciais.length === 0) return [];

      // Buscar usuários com roles comerciais
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', rolesComerciais);

      if (rolesError) throw rolesError;

      if (!userRoles || userRoles.length === 0) {
        return [];
      }

      // Agrupar roles por user_id
      const rolesByUserId = userRoles.reduce((acc, ur) => {
        if (!acc[ur.user_id]) acc[ur.user_id] = [];
        acc[ur.user_id].push(ur.role);
        return acc;
      }, {} as Record<string, string[]>);

      const userIds = Object.keys(rolesByUserId);

      // Buscar profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, nome, email, telefone, avatar_url, ativo, codigo_sga_voluntario')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      if (!profiles) return [];

      // Buscar contagem de leads por vendedor
      const { data: leadsCount } = await supabase
        .from('leads')
        .select('vendedor_id')
        .in('vendedor_id', profiles.map(p => p.id));

      // Buscar contagem de contratos por vendedor
      const { data: contratosCount } = await supabase
        .from('contratos')
        .select('vendedor_id')
        .in('vendedor_id', profiles.map(p => p.id));

      // Montar resultado
      return profiles.map(profile => {
        const leadsByVendedor = leadsCount?.filter(l => l.vendedor_id === profile.id).length || 0;
        const contratosByVendedor = contratosCount?.filter(c => c.vendedor_id === profile.id).length || 0;

        return {
          id: profile.id,
          nome: profile.nome || 'Sem nome',
          email: profile.email,
          telefone: profile.telefone,
          avatar_url: profile.avatar_url,
          ativo: profile.ativo ?? true,
          codigo_sga_voluntario: profile.codigo_sga_voluntario,
          roles: rolesByUserId[profile.user_id!] || [],
          total_leads: leadsByVendedor,
          total_propostas: contratosByVendedor,
        };
      });
    },
  });
}

export function useUpdateConsultor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, codigo_sga_voluntario }: { id: string; codigo_sga_voluntario: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ codigo_sga_voluntario })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultores'] });
      toast.success('Consultor atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar consultor', {
        description: error.message,
      });
    },
  });
}
