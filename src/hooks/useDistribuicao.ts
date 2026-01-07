import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  ConfiguracaoDistribuicao,
  VendedorDistribuicao,
  HistoricoDistribuicao,
  EstatisticasDistribuicao,
  StatusDistribuicao,
} from '@/types/distribuicao';

// ============================================
// CONFIGURAÇÃO
// ============================================

export function useConfiguracaoDistribuicao() {
  return useQuery({
    queryKey: ['distribuicao-config'],
    queryFn: async (): Promise<ConfiguracaoDistribuicao | null> => {
      const { data, error } = await supabase
        .from('distribuicao_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Buscar fallback usuário se existir
      let fallback_usuario = null;
      if (data.fallback_usuario_id) {
        const { data: usuario } = await supabase
          .from('profiles')
          .select('id, nome')
          .eq('id', data.fallback_usuario_id)
          .single();
        fallback_usuario = usuario;
      }

      return {
        id: data.id,
        ativo: data.ativo ?? true,
        limite_diario_padrao: data.limite_diario_padrao ?? 20,
        resetar_contadores_hora: data.resetar_contadores_hora ?? 0,
        fallback_usuario_id: data.fallback_usuario_id,
        distribuir_fins_semana: data.distribuir_fins_semana ?? false,
        created_at: data.created_at ?? '',
        updated_at: data.updated_at ?? '',
        fallback_usuario,
      };
    },
  });
}

export function useAtualizarConfiguracao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<ConfiguracaoDistribuicao>) => {
      const { data: existing } = await supabase
        .from('distribuicao_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      const updateData = {
        ...payload,
        updated_at: new Date().toISOString(),
      };

      // Remove campos que não existem na tabela
      delete (updateData as any).fallback_usuario;

      if (existing) {
        const { error } = await supabase
          .from('distribuicao_config')
          .update(updateData)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('distribuicao_config')
          .insert(updateData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-config'] });
      toast.success('Configuração atualizada');
    },
    onError: (error) => {
      console.error('Erro ao atualizar config:', error);
      toast.error('Erro ao atualizar configuração');
    },
  });
}

// ============================================
// VENDEDORES
// ============================================

export function useVendedoresDistribuicao() {
  return useQuery({
    queryKey: ['distribuicao-vendedores'],
    queryFn: async (): Promise<VendedorDistribuicao[]> => {
      const { data, error } = await supabase
        .from('distribuicao_vendedores')
        .select(`
          *,
          vendedor:profiles!vendedor_id(id, nome, email, telefone)
        `)
        .order('ordem', { ascending: true });

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        vendedor_id: item.vendedor_id,
        status: (item.status as StatusDistribuicao) || 'ativo',
        limite_diario: item.limite_diario ?? 0,
        leads_hoje: item.leads_hoje ?? 0,
        total_leads: item.total_leads ?? 0,
        ultima_atribuicao: item.ultima_atribuicao,
        ordem: item.ordem ?? 0,
        created_at: item.created_at ?? '',
        updated_at: item.updated_at ?? '',
        vendedor: item.vendedor,
      }));
    },
  });
}

export function useAdicionarVendedorDistribuicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendedor_id: string) => {
      // Buscar próxima ordem
      const { data: existing } = await supabase
        .from('distribuicao_vendedores')
        .select('ordem')
        .order('ordem', { ascending: false })
        .limit(1)
        .maybeSingle();

      const proximaOrdem = (existing?.ordem ?? 0) + 1;

      const { error } = await supabase
        .from('distribuicao_vendedores')
        .insert({
          vendedor_id,
          status: 'ativo',
          limite_diario: 0,
          leads_hoje: 0,
          total_leads: 0,
          ordem: proximaOrdem,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['vendedores-disponiveis'] });
      toast.success('Vendedor adicionado à distribuição');
    },
    onError: (error) => {
      console.error('Erro ao adicionar vendedor:', error);
      toast.error('Erro ao adicionar vendedor');
    },
  });
}

export function useRemoverVendedorDistribuicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('distribuicao_vendedores')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['vendedores-disponiveis'] });
      toast.success('Vendedor removido da distribuição');
    },
    onError: (error) => {
      console.error('Erro ao remover vendedor:', error);
      toast.error('Erro ao remover vendedor');
    },
  });
}

export function useAtualizarStatusVendedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusDistribuicao }) => {
      const { error } = await supabase
        .from('distribuicao_vendedores')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicao-estatisticas'] });
      toast.success('Status atualizado');
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    },
  });
}

export function useAtualizarLimiteVendedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, limite_diario }: { id: string; limite_diario: number }) => {
      const { error } = await supabase
        .from('distribuicao_vendedores')
        .update({ limite_diario, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-vendedores'] });
      toast.success('Limite atualizado');
    },
    onError: (error) => {
      console.error('Erro ao atualizar limite:', error);
      toast.error('Erro ao atualizar limite');
    },
  });
}

// ============================================
// VENDEDORES DISPONÍVEIS (para adicionar)
// ============================================

export function useVendedoresDisponiveis() {
  return useQuery({
    queryKey: ['vendedores-disponiveis'],
    queryFn: async () => {
      // Buscar vendedores já na distribuição
      const { data: jaAdicionados } = await supabase
        .from('distribuicao_vendedores')
        .select('vendedor_id');

      const idsJaAdicionados = (jaAdicionados || []).map(v => v.vendedor_id);

      // Buscar profiles que são vendedores e não estão na distribuição
      const { data: vendedores, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('tipo', 'funcionario')
        .eq('ativo', true);

      if (error) throw error;

      // Filtrar os que já estão na distribuição
      return (vendedores || []).filter(v => !idsJaAdicionados.includes(v.id));
    },
  });
}

// ============================================
// HISTÓRICO
// ============================================

export function useHistoricoDistribuicao(leadId?: string) {
  return useQuery({
    queryKey: ['distribuicao-historico', leadId],
    queryFn: async (): Promise<HistoricoDistribuicao[]> => {
      let query = supabase
        .from('distribuicao_historico')
        .select(`
          *,
          lead:leads!lead_id(id, nome, telefone),
          vendedor:profiles!vendedor_id(id, nome)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (leadId) {
        query = query.eq('lead_id', leadId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        lead_id: item.lead_id,
        vendedor_id: item.vendedor_id,
        atribuido_automaticamente: item.atribuido_automaticamente ?? true,
        motivo: item.motivo ?? 'round_robin',
        created_at: item.created_at ?? '',
        lead: item.lead,
        vendedor: item.vendedor,
      }));
    },
  });
}

// ============================================
// ESTATÍSTICAS
// ============================================

export function useEstatisticasDistribuicao() {
  return useQuery({
    queryKey: ['distribuicao-estatisticas'],
    queryFn: async (): Promise<EstatisticasDistribuicao> => {
      const hoje = new Date().toISOString().split('T')[0];

      // Vendedores ativos
      const { data: vendedores } = await supabase
        .from('distribuicao_vendedores')
        .select('vendedor_id, leads_hoje, status')
        .eq('status', 'ativo');

      // Buscar nomes
      const vendedorIds = (vendedores || []).map(v => v.vendedor_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', vendedorIds.length > 0 ? vendedorIds : ['00000000-0000-0000-0000-000000000000']);

      const profileMap = new Map(profiles?.map(p => [p.id, p.nome]) || []);

      // Leads hoje
      const { count: leadsHoje } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${hoje}T00:00:00`);

      // Leads sem vendedor
      const { count: leadsSemVendedor } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .is('vendedor_id', null);

      // Distribuídos hoje
      const { count: distribuidosHoje } = await supabase
        .from('distribuicao_historico')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${hoje}T00:00:00`);

      const vendedoresAtivos = vendedores || [];
      const totalVendedoresAtivos = vendedoresAtivos.length;

      // Calcular mais/menos leads
      let vendedor_mais_leads = null;
      let vendedor_menos_leads = null;

      if (vendedoresAtivos.length > 0) {
        const sorted = [...vendedoresAtivos].sort(
          (a, b) => (b.leads_hoje || 0) - (a.leads_hoje || 0)
        );

        const mais = sorted[0];
        const menos = sorted[sorted.length - 1];

        if (mais) {
          vendedor_mais_leads = {
            vendedor: profileMap.get(mais.vendedor_id) || 'Vendedor',
            quantidade: mais.leads_hoje || 0,
          };
        }

        if (menos) {
          vendedor_menos_leads = {
            vendedor: profileMap.get(menos.vendedor_id) || 'Vendedor',
            quantidade: menos.leads_hoje || 0,
          };
        }
      }

      return {
        total_vendedores_ativos: totalVendedoresAtivos,
        total_leads_hoje: leadsHoje || 0,
        leads_distribuidos_hoje: distribuidosHoje || 0,
        leads_sem_vendedor: leadsSemVendedor || 0,
        vendedor_mais_leads,
        vendedor_menos_leads,
      };
    },
  });
}

// ============================================
// AÇÕES
// ============================================

export function useDistribuirLeadManual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lead_id, vendedor_id }: { lead_id: string; vendedor_id: string }) => {
      // Atualizar lead
      const { error: updateError } = await supabase
        .from('leads')
        .update({ vendedor_id })
        .eq('id', lead_id);

      if (updateError) throw updateError;

      // Registrar histórico
      const { error: histError } = await supabase
        .from('distribuicao_historico')
        .insert({
          lead_id,
          vendedor_id,
          atribuido_automaticamente: false,
          motivo: 'manual',
        });

      if (histError) throw histError;

      // Atualizar contador do vendedor
      const { error: contadorError } = await supabase.rpc('atribuir_lead_automaticamente', {
        p_lead_id: lead_id,
      });

      // Ignorar erro do RPC se já foi atribuído manualmente
      if (contadorError) console.warn('RPC warning:', contadorError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicao-historico'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicao-estatisticas'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicao-vendedores'] });
      toast.success('Lead atribuído com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao distribuir lead:', error);
      toast.error('Erro ao atribuir lead');
    },
  });
}

export function useResetarContadores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('resetar_contadores_distribuicao');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicao-estatisticas'] });
      toast.success('Contadores resetados');
    },
    onError: (error) => {
      console.error('Erro ao resetar contadores:', error);
      toast.error('Erro ao resetar contadores');
    },
  });
}

// Aliases para compatibilidade
export const useDistribuicaoConfig = useConfiguracaoDistribuicao;
export const useDistribuicaoVendedores = useVendedoresDistribuicao;
export const useDistribuicaoHistorico = useHistoricoDistribuicao;
export const useDistribuicaoEstatisticas = useEstatisticasDistribuicao;
