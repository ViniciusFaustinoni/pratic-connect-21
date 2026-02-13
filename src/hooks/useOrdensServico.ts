import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { OrdemServico, OrdemServicoItem, StatusOrdemServico } from '@/types/database';

export interface OSFilters {
  status?: StatusOrdemServico;
  oficina_id?: string;
  associado_id?: string;
  sinistro_id?: string;
  search?: string;
  data_inicio?: string;
  data_fim?: string;
}

export function useOrdensServico(filters?: OSFilters) {
  return useQuery({
    queryKey: ['ordens_servico', filters],
    queryFn: async () => {
      let query = supabase
        .from('ordens_servico')
        .select(`
          *,
          oficina:oficinas(id, nome_fantasia, razao_social, cidade),
          veiculo:veiculos(id, placa, marca, modelo),
          associado:associados(id, nome, telefone),
          sinistro:sinistros(id, protocolo)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status as any);
      }
      if (filters?.oficina_id) {
        query = query.eq('oficina_id', filters.oficina_id);
      }
      if (filters?.associado_id) {
        query = query.eq('associado_id', filters.associado_id);
      }
      if (filters?.sinistro_id) {
        query = query.eq('sinistro_id', filters.sinistro_id);
      }
      if (filters?.search) {
        query = query.ilike('numero', `%${filters.search}%`);
      }
      if (filters?.data_inicio) {
        query = query.gte('created_at', filters.data_inicio);
      }
      if (filters?.data_fim) {
        query = query.lte('created_at', filters.data_fim);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OrdemServico[];
    },
  });
}

export function useOrdemServico(id: string | undefined) {
  return useQuery({
    queryKey: ['ordem_servico', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(`
          *,
          oficina:oficinas(*),
          veiculo:veiculos(*),
          associado:associados(id, nome, telefone, whatsapp, email),
          sinistro:sinistros(id, protocolo, tipo, status),
          criado_por_profile:profiles!ordens_servico_criado_por_fkey(nome),
          aprovado_por_profile:profiles!ordens_servico_aprovado_por_fkey(nome)
        `)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as OrdemServico & {
        sinistro?: { id: string; protocolo: string; tipo: string; status: string };
        criado_por_profile?: { nome: string };
        aprovado_por_profile?: { nome: string };
      };
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.status === 'pendente_assinatura' && !(data as any).termo_saida_assinado) {
        return 10000;
      }
      return false;
    },
  });
}

export function useOSItens(osId: string | undefined) {
  return useQuery({
    queryKey: ['os_itens', osId],
    queryFn: async () => {
      if (!osId) return [];
      const { data, error } = await supabase
        .from('ordens_servico_itens')
        .select('*')
        .eq('ordem_servico_id', osId)
        .order('created_at');
      if (error) throw error;
      return data as OrdemServicoItem[];
    },
    enabled: !!osId,
  });
}

interface CreateOSParams {
  oficina_id: string;
  veiculo_id: string;
  associado_id: string;
  sinistro_id?: string;
  data_entrada?: string;
  data_previsao?: string;
  observacoes?: string;
}

export function useCreateOrdemServico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateOSParams) => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .insert({
          ...params,
          numero: '', // Trigger will generate
          status: 'rascunho',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
      toast.success('Ordem de serviço criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar OS: ' + error.message);
    },
  });
}

export function useUpdateOSStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, observacao }: { id: string; status: StatusOrdemServico; observacao?: string }) => {
      const { error } = await supabase
        .from('ordens_servico')
        .update({ status: status as any, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      // Add to history if there's an observation
      if (observacao) {
        await supabase.from('ordens_servico_historico').insert({
          ordem_servico_id: id,
          status_novo: status,
          observacao,
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
      queryClient.invalidateQueries({ queryKey: ['ordem_servico', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['os_historico', variables.id] });
      toast.success('Status atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });
}

export function useAddOSItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<OrdemServicoItem, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('ordens_servico_itens')
        .insert(item)
        .select()
        .single();
      if (error) throw error;

      // Update OS total
      const { data: items } = await supabase
        .from('ordens_servico_itens')
        .select('valor_total')
        .eq('ordem_servico_id', item.ordem_servico_id);
      
      const total = items?.reduce((sum, i) => sum + Number(i.valor_total), 0) || 0;
      await supabase
        .from('ordens_servico')
        .update({ valor_orcamento: total })
        .eq('id', item.ordem_servico_id);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['os_itens', data.ordem_servico_id] });
      queryClient.invalidateQueries({ queryKey: ['ordem_servico', data.ordem_servico_id] });
      toast.success('Item adicionado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar item: ' + error.message);
    },
  });
}

export function useDeleteOSItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ordem_servico_id }: { id: string; ordem_servico_id: string }) => {
      const { error } = await supabase
        .from('ordens_servico_itens')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Update OS total
      const { data: items } = await supabase
        .from('ordens_servico_itens')
        .select('valor_total')
        .eq('ordem_servico_id', ordem_servico_id);
      
      const total = items?.reduce((sum, i) => sum + Number(i.valor_total), 0) || 0;
      await supabase
        .from('ordens_servico')
        .update({ valor_orcamento: total })
        .eq('id', ordem_servico_id);

      return { ordem_servico_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['os_itens', data.ordem_servico_id] });
      queryClient.invalidateQueries({ queryKey: ['ordem_servico', data.ordem_servico_id] });
      toast.success('Item removido!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover item: ' + error.message);
    },
  });
}

export function useOSHistorico(osId: string | undefined) {
  return useQuery({
    queryKey: ['os_historico', osId],
    queryFn: async () => {
      if (!osId) return [];
      const { data, error } = await supabase
        .from('ordens_servico_historico')
        .select(`
          *,
          usuario:profiles(nome)
        `)
        .eq('ordem_servico_id', osId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!osId,
  });
}
