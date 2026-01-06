import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { StatusContrato } from '@/types/vendas';

type Contrato = Tables<'contratos'>;
type ContratoInsert = TablesInsert<'contratos'>;
type ContratoUpdate = TablesUpdate<'contratos'>;

export interface ContratoWithRelations extends Contrato {
  planos?: Tables<'planos'> | null;
  cotacoes?: Tables<'cotacoes'> | null;
  associados?: Tables<'associados'> | null;
  leads?: Tables<'leads'> | null;
  vendedor?: {
    id: string;
    nome: string;
    email: string;
  } | null;
}

export function useContratos() {
  return useQuery({
    queryKey: ['contratos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          planos (*),
          cotacoes (*),
          associados (*),
          leads (*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ContratoWithRelations[];
    },
  });
}

export function useContrato(id: string | undefined) {
  return useQuery({
    queryKey: ['contratos', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          planos (*),
          cotacoes (*),
          associados (*),
          leads (*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;

      // Buscar vendedor separadamente se existir vendedor_id
      let vendedor = null;
      if (data.vendedor_id) {
        const { data: vendedorData } = await supabase
          .from('profiles')
          .select('id, nome, email')
          .eq('id', data.vendedor_id)
          .single();
        vendedor = vendedorData;
      }
      
      return { ...data, vendedor } as ContratoWithRelations;
    },
    enabled: !!id,
  });
}

// Hook para ações do contrato
export function useContratoActions() {
  const queryClient = useQueryClient();

  const reenviarAssinaturaMutation = useMutation({
    mutationFn: async (id: string) => {
      // Atualiza status para enviado (integração Autentique será feita depois)
      const { error } = await supabase
        .from('contratos')
        .update({ 
          status: 'enviado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      toast.success('Contrato reenviado para assinatura!');
    },
    onError: () => {
      toast.error('Erro ao reenviar contrato');
    },
  });

  const cancelarContratoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contratos')
        .update({ 
          status: 'cancelado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      toast.success('Contrato cancelado');
    },
    onError: () => {
      toast.error('Erro ao cancelar contrato');
    },
  });

  return {
    reenviarAssinatura: reenviarAssinaturaMutation.mutate,
    cancelarContrato: cancelarContratoMutation.mutate,
    isReenviando: reenviarAssinaturaMutation.isPending,
    isCancelando: cancelarContratoMutation.isPending,
  };
}

export function useCreateContrato() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contrato: Omit<ContratoInsert, 'numero'>) => {
      const { data, error } = await supabase
        .from('contratos')
        .insert({
          ...contrato,
          numero: 'TEMP', // Trigger will generate
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Contrato;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
  });
}

export function useUpdateContrato() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: ContratoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('contratos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Contrato;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['contratos', data.id] });
    },
  });
}

// Hook para buscar contrato de um lead específico
export function useContratoByLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ['contratos', 'lead', leadId],
    queryFn: async () => {
      if (!leadId) return null;

      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          planos (*)
        `)
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error) throw error;
      return data as ContratoWithRelations | null;
    },
    enabled: !!leadId,
  });
}

// Hook para ativar contrato e criar associado automaticamente
export function useAtivarContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contratoId: string) => {
      // 1. Buscar contrato completo com lead
      const { data: contrato, error: contratoError } = await supabase
        .from('contratos')
        .select('*, leads(*), planos(*)')
        .eq('id', contratoId)
        .single();

      if (contratoError) throw contratoError;
      if (!contrato) throw new Error('Contrato não encontrado');

      // 2. Se já tem associado, apenas ativar o contrato
      if (contrato.associado_id) {
        const { error: updateError } = await supabase
          .from('contratos')
          .update({ status: 'ativo' })
          .eq('id', contratoId);

        if (updateError) throw updateError;
        return { ...contrato, status: 'ativo' as const };
      }

      const lead = contrato.leads as Tables<'leads'> | null;
      if (!lead) throw new Error('Contrato sem lead vinculado');

      // 3. Validar dados obrigatórios
      if (!lead.email) throw new Error('Email do lead é obrigatório para criar associado');

      // 4. Criar associado
      const { data: novoAssociado, error: associadoError } = await supabase
        .from('associados')
        .insert({
          nome: lead.nome,
          email: lead.email,
          telefone: lead.telefone,
          cpf: lead.cpf || '',
          plano_id: contrato.plano_id,
          contrato_id: contratoId,
          status: 'em_analise',
          data_adesao: new Date().toISOString().split('T')[0],
          dia_vencimento: contrato.dia_vencimento || 10,
        })
        .select()
        .single();

      if (associadoError) throw associadoError;

      // 5. Criar veículo se houver dados
      if (lead.veiculo_marca && lead.veiculo_placa) {
        const { error: veiculoError } = await supabase
          .from('veiculos')
          .insert({
            associado_id: novoAssociado.id,
            marca: lead.veiculo_marca,
            modelo: lead.veiculo_modelo || 'N/I',
            ano_fabricacao: lead.veiculo_ano || new Date().getFullYear(),
            ano_modelo: lead.veiculo_ano || new Date().getFullYear(),
            placa: lead.veiculo_placa,
            codigo_fipe: lead.codigo_fipe,
            valor_fipe: lead.veiculo_fipe,
            status: 'em_analise',
          });

        if (veiculoError) console.error('Erro ao criar veículo:', veiculoError);
      }

      // 6. Atualizar contrato com associado_id e status ativo
      const { error: updateContratoError } = await supabase
        .from('contratos')
        .update({
          associado_id: novoAssociado.id,
          status: 'ativo',
        })
        .eq('id', contratoId);

      if (updateContratoError) throw updateContratoError;

      // 7. Atualizar lead para ganho
      const { error: updateLeadError } = await supabase
        .from('leads')
        .update({
          associado_id: novoAssociado.id,
          etapa: 'ganho',
          data_conversao: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (updateLeadError) console.error('Erro ao atualizar lead:', updateLeadError);

      // 8. Registrar histórico
      await supabase.from('leads_historico').insert({
        lead_id: lead.id,
        acao: 'ganho',
        descricao: `Contrato ${contrato.numero} ativado. Associado criado automaticamente.`,
        etapa_nova: 'ganho',
      });

      // 9. Criar notificação para vendedor
      if (lead.vendedor_id) {
        await supabase.from('notificacoes').insert({
          user_id: lead.vendedor_id,
          titulo: 'Contrato Ativado!',
          mensagem: `O contrato ${contrato.numero} de ${lead.nome} foi ativado e o associado foi criado.`,
          tipo: 'sucesso',
          link: `/cadastro/associados/${novoAssociado.id}`,
        });
      }

      return { 
        ...contrato, 
        associado_id: novoAssociado.id, 
        status: 'ativo' as const,
        novoAssociadoId: novoAssociado.id,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
