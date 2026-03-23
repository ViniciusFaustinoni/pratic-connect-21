import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Profile, PerfilAcesso } from '@/types/auth';

// ============================================
// TIPOS
// ============================================
export interface RoleRecord {
  id: string;
  role: PerfilAcesso;
  created_at: string;
}

export interface ProfileWithRoles extends Profile {
  roles: PerfilAcesso[];
  roleRecords?: RoleRecord[];
}

export interface UsuarioFilters {
  search?: string;
  tipo?: 'funcionario' | 'associado' | 'prestador' | 'todos';
  perfil?: PerfilAcesso | 'todos';
  status?: 'ativo' | 'inativo' | 'bloqueado' | 'todos';
}

export interface UsuarioPagination {
  page: number;
  pageSize: number;
  total: number;
}

interface UseUsuariosParams {
  filters?: UsuarioFilters;
  pagination?: { page: number; pageSize: number };
}

interface UseUsuariosReturn {
  usuarios: ProfileWithRoles[];
  pagination: UsuarioPagination;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ============================================
// HOOK PRINCIPAL
// ============================================
export function useUsuarios({ 
  filters = {}, 
  pagination = { page: 1, pageSize: 20 } 
}: UseUsuariosParams = {}): UseUsuariosReturn {

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['usuarios', filters, pagination],
    queryFn: async () => {
      // Construir query base
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });

      // Filtro por tipo
      if (filters.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo);
      }

      // Filtro por status
      if (filters.status === 'ativo') {
        query = query.eq('ativo', true).or('bloqueado.is.null,bloqueado.eq.false');
      } else if (filters.status === 'inativo') {
        query = query.eq('ativo', false);
      } else if (filters.status === 'bloqueado') {
        query = query.eq('bloqueado', true);
      }

      // Filtro por busca
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(`nome.ilike.${searchTerm},email.ilike.${searchTerm},cpf.ilike.${searchTerm}`);
      }

      // Ordenação
      query = query.order('nome', { ascending: true });

      // Paginação
      const from = (pagination.page - 1) * pagination.pageSize;
      const to = from + pagination.pageSize - 1;
      query = query.range(from, to);

      const { data: profiles, count, error: profilesError } = await query;

      if (profilesError) throw profilesError;

      // Buscar roles para todos os usuários retornados
      const userIds = (profiles || [])
        .map(p => p.user_id)
        .filter((id): id is string => id !== null);

      let rolesMap: Record<string, PerfilAcesso[]> = {};
      
      if (userIds.length > 0) {
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);

        if (rolesError) throw rolesError;

        roles?.forEach(r => {
          if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
          rolesMap[r.user_id].push(r.role as PerfilAcesso);
        });
      }

      // Montar dados com roles
      let usuarios = (profiles || []).map(profile => ({
        ...profile,
        roles: profile.user_id ? (rolesMap[profile.user_id] || []) : [],
      })) as ProfileWithRoles[];

      // Filtrar por perfil (precisa ser feito após o fetch por causa do join)
      if (filters.perfil && filters.perfil !== 'todos') {
        usuarios = usuarios.filter(u => 
          u.roles.includes(filters.perfil as PerfilAcesso)
        );
      }

      return {
        usuarios,
        total: count || 0,
      };
    },
  });

  return {
    usuarios: data?.usuarios || [],
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: data?.total || 0,
    },
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================
// HOOK DE AÇÕES
// ============================================
export function useUsuarioActions() {
  const queryClient = useQueryClient();

  // Desativar usuário
  const desativarUsuario = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário desativado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao desativar usuário: ' + error.message);
    },
  });

  // Ativar usuário
  const ativarUsuario = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ ativo: true, updated_at: new Date().toISOString() })
        .eq('id', profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário ativado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao ativar usuário: ' + error.message);
    },
  });

  // Bloquear usuário
  const bloquearUsuario = useMutation({
    mutationFn: async ({ profileId, motivo }: { profileId: string; motivo?: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          bloqueado: true, 
          motivo_bloqueio: motivo || 'Bloqueado pelo administrador',
          updated_at: new Date().toISOString() 
        })
        .eq('id', profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário bloqueado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao bloquear usuário: ' + error.message);
    },
  });

  // Desbloquear usuário
  const desbloquearUsuario = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          bloqueado: false, 
          motivo_bloqueio: null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário desbloqueado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao desbloquear usuário: ' + error.message);
    },
  });

  // Resetar senha (via Supabase Auth) - envia email
  const resetarSenhaEmail = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Email de redefinição de senha enviado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar email: ' + error.message);
    },
  });

  // Resetar senha administrativamente (define nova senha diretamente)
  const resetarSenhaAdmin = useMutation({
    mutationFn: async ({ userId, novaSenha }: { userId: string; novaSenha: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/admin-reset-password',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ userId, novaSenha }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao redefinir senha');
      }
      return result;
    },
    onSuccess: () => {
      toast.success('Senha redefinida com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Excluir usuário permanentemente
  const excluirUsuario = useMutation({
    mutationFn: async ({ profileId, userId }: { profileId: string; userId?: string | null }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/delete-user',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ profileId, userId }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir usuário');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário excluído permanentemente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Atualizar usuário
  const atualizarUsuario = useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: Partial<{
        nome: string;
        email: string;
        telefone: string | null;
        tipo: 'funcionario' | 'associado' | 'prestador' | 'agencia';
        ativo: boolean;
      }>;
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          ...data, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['usuario'] });
      toast.success('Usuário atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar usuário: ' + error.message);
    },
  });

  // Adicionar perfil ao usuário
  const adicionarPerfil = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: PerfilAcesso }) => {
      // Verificar se já existe
      const { data: existente } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', role as any)
        .maybeSingle();

      if (existente) {
        throw new Error('Este perfil já está atribuído ao usuário');
      }

      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: role as any });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuario'] });
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Perfil adicionado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Remover perfil do usuário
  const removerPerfil = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuario'] });
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Perfil removido com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover perfil: ' + error.message);
    },
  });

  return {
    desativarUsuario: desativarUsuario.mutate,
    ativarUsuario: ativarUsuario.mutate,
    bloquearUsuario: bloquearUsuario.mutate,
    desbloquearUsuario: desbloquearUsuario.mutate,
    resetarSenhaEmail: resetarSenhaEmail.mutate,
    resetarSenhaAdmin: resetarSenhaAdmin.mutateAsync,
    excluirUsuario: excluirUsuario.mutateAsync,
    atualizarUsuario: atualizarUsuario.mutate,
    adicionarPerfil: adicionarPerfil.mutate,
    removerPerfil: removerPerfil.mutate,
    isLoading: 
      desativarUsuario.isPending || 
      ativarUsuario.isPending || 
      bloquearUsuario.isPending ||
      desbloquearUsuario.isPending ||
      resetarSenhaEmail.isPending,
    isResettingPassword: resetarSenhaAdmin.isPending,
    isDeletingUser: excluirUsuario.isPending,
    isUpdating: atualizarUsuario.isPending,
    isAddingPerfil: adicionarPerfil.isPending,
    isRemovingPerfil: removerPerfil.isPending,
  };
}

// ============================================
// HOOK PARA BUSCAR UM USUÁRIO
// ============================================
export function useUsuario(profileId: string | undefined) {
  return useQuery({
    queryKey: ['usuario', profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (profileError) throw profileError;

      // Buscar roles com id e created_at para poder gerenciar
      let roles: PerfilAcesso[] = [];
      let roleRecords: RoleRecord[] = [];
      
      if (profile.user_id) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('id, role, created_at')
          .eq('user_id', profile.user_id);

        if (rolesError) throw rolesError;
        
        roleRecords = rolesData?.map(r => ({
          id: r.id,
          role: r.role as PerfilAcesso,
          created_at: r.created_at,
        })) || [];
        
        roles = roleRecords.map(r => r.role);
      }

      return {
        ...profile,
        roles,
        roleRecords,
      } as ProfileWithRoles;
    },
    enabled: !!profileId,
  });
}
