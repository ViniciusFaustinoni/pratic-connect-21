import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePerfilUsuarios() {
  // Busca contagem de usuários por perfil
  const { data: contagemPorPerfil, isLoading: isLoadingContagem } = useQuery({
    queryKey: ['perfil-usuarios-contagem'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role');
      
      if (error) throw error;

      // Agrupa por role e conta
      const contagem: Record<string, number> = {};
      data?.forEach(item => {
        contagem[item.role] = (contagem[item.role] || 0) + 1;
      });

      return contagem;
    },
  });

  // Busca lista de usuários por perfil específico
  const useUsuariosPorPerfil = (perfilId: string) => {
    return useQuery({
      queryKey: ['perfil-usuarios', perfilId],
      queryFn: async () => {
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', perfilId as any);
        
        if (roleError) throw roleError;

        if (!roleData || roleData.length === 0) {
          return [];
        }

        const userIds = roleData.map(r => r.user_id);
        
        // CORREÇÃO: userIds são auth.users.id (de user_roles.user_id)
        // Portanto devemos buscar profiles por user_id, não por id
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, nome, email, user_id')
          .in('user_id', userIds);

        if (profileError) throw profileError;

        return profiles || [];
      },
      enabled: !!perfilId,
    });
  };

  return {
    contagemPorPerfil: contagemPorPerfil || {},
    isLoadingContagem,
    useUsuariosPorPerfil,
  };
}
