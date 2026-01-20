import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { registrarLog } from './useAuditLog';

type LeadInsert = TablesInsert<'leads'>;
type LeadUpdate = TablesUpdate<'leads'>;

// ============================================
// HOOK DE ACTIONS (MUTATIONS)
// ============================================

export function useLeadActions() {
  const queryClient = useQueryClient();

  // Helper para invalidar todas as queries de leads
  const invalidateLeadQueries = (leadId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['leads-contagem'] });
    queryClient.invalidateQueries({ queryKey: ['leads-by-etapa'] });
    if (leadId) {
      queryClient.invalidateQueries({ queryKey: ['leads', leadId] });
    }
  };

  // ============================================
  // CRIAR LEAD
  // ============================================
  const criarLead = useMutation({
    mutationFn: async (data: LeadInsert) => {
      const { data: lead, error } = await supabase
        .from('leads')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return lead;
    },
    onSuccess: (data) => {
      invalidateLeadQueries();
      toast.success('Lead criado com sucesso!');
      registrarLog({
        acao: 'criar',
        modulo: 'leads',
        descricao: `Lead "${data.nome}" criado`,
        entidade_id: data.id,
        dados_novos: { nome: data.nome, telefone: data.telefone, email: data.email },
      });
    },
    onError: (error: Error) => {
      console.error('Erro ao criar lead:', error);
      toast.error('Erro ao criar lead: ' + error.message);
    },
  });

  // ============================================
  // ATUALIZAR LEAD
  // ============================================
  const atualizarLead = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LeadUpdate }) => {
      const { data: lead, error } = await supabase
        .from('leads')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return lead;
    },
    onSuccess: (data, variables) => {
      invalidateLeadQueries(variables.id);
      toast.success('Lead atualizado com sucesso!');
      registrarLog({
        acao: 'editar',
        modulo: 'leads',
        descricao: `Lead "${data.nome}" atualizado`,
        entidade_id: data.id,
      });
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar lead:', error);
      toast.error('Erro ao atualizar lead: ' + error.message);
    },
  });

  // ============================================
  // ATRIBUIR VENDEDOR
  // ============================================
  const atribuirVendedor = useMutation({
    mutationFn: async ({ 
      leadId, 
      vendedorId 
    }: { 
      leadId: string; 
      vendedorId: string | null;
    }) => {
      const { error } = await supabase
        .from('leads')
        .update({ vendedor_id: vendedorId })
        .eq('id', leadId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      invalidateLeadQueries(variables.leadId);
      toast.success('Vendedor atribuído com sucesso!');
      registrarLog({
        acao: 'atribuir',
        modulo: 'leads',
        descricao: `Vendedor atribuído ao lead`,
        entidade_id: variables.leadId,
        dados_novos: { vendedor_id: variables.vendedorId },
      });
    },
    onError: (error: Error) => {
      toast.error('Erro ao atribuir vendedor: ' + error.message);
    },
  });

  // ============================================
  // EXCLUIR LEAD
  // ============================================
  const excluirLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, id) => {
      invalidateLeadQueries();
      toast.success('Lead excluído com sucesso!');
      registrarLog({
        acao: 'excluir',
        modulo: 'leads',
        descricao: 'Lead excluído',
        entidade_id: id,
      });
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir lead:', error);
      toast.error('Erro ao excluir lead: ' + error.message);
    },
  });

  // ============================================
  // RETURN
  // ============================================
  return {
    // Mutations
    criarLead: criarLead.mutateAsync,
    atualizarLead: atualizarLead.mutateAsync,
    atribuirVendedor: atribuirVendedor.mutate,
    excluirLead: excluirLead.mutateAsync,
    
    // Loading states
    isCreating: criarLead.isPending,
    isUpdating: atualizarLead.isPending,
    isAssigning: atribuirVendedor.isPending,
    isDeleting: excluirLead.isPending,
  };
}
