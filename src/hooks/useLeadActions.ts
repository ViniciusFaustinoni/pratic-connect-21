import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

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
      // Pegar usuário atual para registrar histórico
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: lead, error } = await supabase
        .from('leads')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico
      try {
        await supabase.from('leads_historico').insert({
          lead_id: lead.id,
          usuario_id: user?.id || null,
          acao: 'criou_lead',
          descricao: `Lead "${lead.nome}" criado`,
        });
      } catch (histError) {
        console.error('Erro ao registrar histórico:', histError);
        // Não interrompe o fluxo principal
      }

      return lead;
    },
    onSuccess: (data) => {
      invalidateLeadQueries(data.id);
      queryClient.invalidateQueries({ queryKey: ['leads', data.id, 'historico'] });
      toast.success('Lead criado com sucesso!');
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
    onSuccess: (_, variables) => {
      invalidateLeadQueries(variables.id);
      toast.success('Lead atualizado com sucesso!');
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
    onSuccess: () => {
      invalidateLeadQueries();
      toast.success('Lead excluído com sucesso!');
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
