import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CampanhaDesconto, CampanhaDescontoFormData } from '@/types/campanha-desconto';

// ============================================
// HOOK: LISTAR CAMPANHAS
// ============================================

export function useCampanhasDesconto(filtros?: { 
  status?: string;
  incluirExpiradas?: boolean;
}) {
  return useQuery({
    queryKey: ['campanhas-desconto', filtros],
    queryFn: async () => {
      let query = supabase
        .from('campanhas_desconto')
        .select('*')
        .order('created_at', { ascending: false });

      if (filtros?.status && filtros.status !== 'todos') {
        query = query.eq('status', filtros.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []) as CampanhaDesconto[];
    },
  });
}

// ============================================
// HOOK: CAMPANHAS VIGENTES (para cotação)
// ============================================

export function useCampanhasDescontoVigentes() {
  return useQuery({
    queryKey: ['campanhas-desconto-vigentes'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('campanhas_desconto')
        .select('*')
        .eq('status', 'ativa')
        .lte('data_inicio', hoje)
        .gte('data_fim', hoje)
        .order('nome');

      if (error) throw error;
      
      return (data || []) as CampanhaDesconto[];
    },
  });
}

// ============================================
// HOOK: BUSCAR CAMPANHA POR ID
// ============================================

export function useCampanhaDesconto(id: string | undefined) {
  return useQuery({
    queryKey: ['campanha-desconto', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não informado');

      const { data, error } = await supabase
        .from('campanhas_desconto')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as CampanhaDesconto;
    },
    enabled: !!id,
  });
}

// ============================================
// HOOK: CRIAR CAMPANHA
// ============================================

export function useCreateCampanhaDesconto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dados: CampanhaDescontoFormData) => {
      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      let criadoPor: string | null = null;
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        criadoPor = profile?.id || null;
      }

      const { data, error } = await supabase
        .from('campanhas_desconto')
        .insert({
          ...dados,
          criado_por: criadoPor,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas-desconto'] });
      queryClient.invalidateQueries({ queryKey: ['campanhas-desconto-vigentes'] });
      toast.success('Campanha criada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao criar campanha:', error);
      toast.error('Erro ao criar campanha');
    },
  });
}

// ============================================
// HOOK: ATUALIZAR CAMPANHA
// ============================================

export function useUpdateCampanhaDesconto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<CampanhaDescontoFormData> }) => {
      const { data, error } = await supabase
        .from('campanhas_desconto')
        .update(dados)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campanhas-desconto'] });
      queryClient.invalidateQueries({ queryKey: ['campanhas-desconto-vigentes'] });
      queryClient.invalidateQueries({ queryKey: ['campanha-desconto', variables.id] });
      toast.success('Campanha atualizada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar campanha:', error);
      toast.error('Erro ao atualizar campanha');
    },
  });
}

// ============================================
// HOOK: EXCLUIR CAMPANHA
// ============================================

export function useDeleteCampanhaDesconto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campanhas_desconto')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas-desconto'] });
      queryClient.invalidateQueries({ queryKey: ['campanhas-desconto-vigentes'] });
      toast.success('Campanha excluída com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao excluir campanha:', error);
      toast.error('Erro ao excluir campanha');
    },
  });
}

// ============================================
// HOOK: ALTERNAR STATUS
// ============================================

export function useToggleCampanhaDescontoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, novoStatus }: { id: string; novoStatus: 'ativa' | 'inativa' }) => {
      const { data, error } = await supabase
        .from('campanhas_desconto')
        .update({ status: novoStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campanhas-desconto'] });
      queryClient.invalidateQueries({ queryKey: ['campanhas-desconto-vigentes'] });
      toast.success(variables.novoStatus === 'ativa' ? 'Campanha ativada!' : 'Campanha desativada!');
    },
    onError: (error) => {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status da campanha');
    },
  });
}
