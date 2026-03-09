import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MembroEquipe {
  id: string;
  supervisor_id: string;
  vendedor_id: string;
  created_at: string;
  vendedor_nome?: string;
  vendedor_email?: string;
}

/**
 * Retorna os vendedores da equipe do supervisor logado
 */
export function useMinhaEquipe() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['minha-equipe', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('equipes_comerciais')
        .select('id, supervisor_id, vendedor_id, created_at')
        .eq('supervisor_id', user.id);

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Buscar nomes dos vendedores
      const vendedorIds = data.map(d => d.vendedor_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .in('user_id', vendedorIds);

      return data.map(item => ({
        ...item,
        vendedor_nome: profiles?.find(p => p.user_id === item.vendedor_id)?.nome,
        vendedor_email: profiles?.find(p => p.user_id === item.vendedor_id)?.email,
      })) as MembroEquipe[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Retorna os profile IDs dos vendedores da equipe do supervisor logado
 * Útil para filtrar dados client-side
 */
export function useMinhaEquipeProfileIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['minha-equipe-profile-ids', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: equipe, error } = await supabase
        .from('equipes_comerciais')
        .select('vendedor_id')
        .eq('supervisor_id', user.id);

      if (error) throw error;
      if (!equipe || equipe.length === 0) return [];

      const vendedorUserIds = equipe.map(e => e.vendedor_id);

      // Converter user_ids para profile_ids (vendedor_id em leads é profile.id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id')
        .in('user_id', vendedorUserIds);

      return profiles?.map(p => p.id) || [];
    },
    enabled: !!user?.id,
  });
}

/**
 * Retorna todas as equipes comerciais (para gerência)
 */
export function useEquipesComerciais() {
  return useQuery({
    queryKey: ['equipes-comerciais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipes_comerciais')
        .select('id, supervisor_id, vendedor_id, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Buscar nomes de todos os envolvidos
      const allUserIds = [...new Set([
        ...data.map(d => d.supervisor_id),
        ...data.map(d => d.vendedor_id),
      ])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .in('user_id', allUserIds);

      return data.map(item => ({
        ...item,
        supervisor_nome: profiles?.find(p => p.user_id === item.supervisor_id)?.nome,
        vendedor_nome: profiles?.find(p => p.user_id === item.vendedor_id)?.nome,
        vendedor_email: profiles?.find(p => p.user_id === item.vendedor_id)?.email,
      }));
    },
  });
}

/**
 * Mutation para adicionar vendedor à equipe
 */
export function useAdicionarVendedorEquipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ supervisorId, vendedorId }: { supervisorId: string; vendedorId: string }) => {
      const { data, error } = await supabase
        .from('equipes_comerciais')
        .insert({ supervisor_id: supervisorId, vendedor_id: vendedorId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes-comerciais'] });
      queryClient.invalidateQueries({ queryKey: ['minha-equipe'] });
      queryClient.invalidateQueries({ queryKey: ['minha-equipe-profile-ids'] });
      toast.success('Vendedor adicionado à equipe');
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        toast.error('Vendedor já está nesta equipe');
      } else {
        toast.error('Erro ao adicionar vendedor à equipe');
      }
    },
  });
}

/**
 * Mutation para remover vendedor da equipe
 */
export function useRemoverVendedorEquipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipes_comerciais')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes-comerciais'] });
      queryClient.invalidateQueries({ queryKey: ['minha-equipe'] });
      queryClient.invalidateQueries({ queryKey: ['minha-equipe-profile-ids'] });
      toast.success('Vendedor removido da equipe');
    },
    onError: () => {
      toast.error('Erro ao remover vendedor da equipe');
    },
  });
}
