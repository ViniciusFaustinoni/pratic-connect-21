import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  ConfiguracaoDistribuicao,
  VendedorDistribuicao,
  HistoricoDistribuicao,
  EstatisticasDistribuicao,
  AtualizarConfigPayload,
  AtualizarVendedorPayload,
  DistribuirLeadManualPayload,
  StatusDistribuicao,
  TipoAtribuicao,
} from '@/types/distribuicao';

// ============================================
// CONFIGURAÇÃO
// ============================================

export function useDistribuicaoConfig() {
  return useQuery({
    queryKey: ['distribuicao-config'],
    queryFn: async (): Promise<ConfiguracaoDistribuicao | null> => {
      const { data, error } = await supabase
        .from('distribuicao_leads_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) return null;

      // Buscar fallback vendedor separadamente se existir
      let fallback_vendedor = null;
      if (data.fallback_vendedor_id) {
        const { data: vendedor } = await supabase
          .from('profiles')
          .select('id, nome')
          .eq('id', data.fallback_vendedor_id)
          .single();
        fallback_vendedor = vendedor;
      }

      return {
        id: data.id,
        ativo: data.ativo,
        tipo_distribuicao: data.tipo || 'round_robin',
        proximo_vendedor: data.proximo_vendedor || 0,
        limite_diario_padrao: data.limite_diario_padrao,
        resetar_contadores_hora: data.resetar_contadores_hora,
        fallback_vendedor_id: data.fallback_vendedor_id,
        distribuir_fins_semana: data.distribuir_fins_semana,
        created_at: data.created_at,
        updated_at: data.updated_at,
        fallback_vendedor,
      };
    },
  });
}

export function useAtualizarConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AtualizarConfigPayload) => {
      const { data: existing } = await supabase
        .from('distribuicao_leads_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      const updateData: Record<string, unknown> = {
        ...payload,
        updated_at: new Date().toISOString(),
      };

      // Map tipo_distribuicao to tipo for the database
      if (payload.tipo_distribuicao) {
        updateData.tipo = payload.tipo_distribuicao;
        delete updateData.tipo_distribuicao;
      }

      if (existing) {
        const { error } = await supabase
          .from('distribuicao_leads_config')
          .update(updateData as any)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('distribuicao_leads_config')
          .insert(updateData as any);

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

export function useDistribuicaoVendedores() {
  return useQuery({
    queryKey: ['distribuicao-vendedores'],
    queryFn: async (): Promise<VendedorDistribuicao[]> => {
      const { data, error } = await supabase
        .from('distribuicao_leads_vendedores')
        .select(`
          *,
          vendedor:profiles!vendedor_id(id, nome, email, telefone, avatar_url)
        `)
        .order('ordem', { ascending: true });

      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        status: (item.status as StatusDistribuicao) || 'ativo',
        ordem: item.ordem || 0,
        total_leads_historico: item.total_leads_historico || 0,
      })) as VendedorDistribuicao[];
    },
  });
}

export function useAtualizarVendedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AtualizarVendedorPayload) => {
      const { id, ...updates } = payload;

      const { error } = await supabase
        .from('distribuicao_leads_vendedores')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicao-estatisticas'] });
      toast.success('Vendedor atualizado');
    },
    onError: (error) => {
      console.error('Erro ao atualizar vendedor:', error);
      toast.error('Erro ao atualizar vendedor');
    },
  });
}

export function useToggleRecebendoLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, recebendo_leads }: { id: string; recebendo_leads: boolean }) => {
      const { error } = await supabase
        .from('distribuicao_leads_vendedores')
        .update({ recebendo_leads, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { recebendo_leads }) => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-vendedores'] });
      toast.success(recebendo_leads ? 'Vendedor ativado' : 'Vendedor pausado');
    },
    onError: (error) => {
      console.error('Erro ao toggle recebendo:', error);
      toast.error('Erro ao atualizar vendedor');
    },
  });
}

// ============================================
// HISTÓRICO
// ============================================

export function useDistribuicaoHistorico(leadId?: string) {
  return useQuery({
    queryKey: ['distribuicao-historico', leadId],
    queryFn: async (): Promise<HistoricoDistribuicao[]> => {
      // Buscar histórico
      let query = supabase
        .from('distribuicao_leads_historico')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (leadId) {
        query = query.eq('lead_id', leadId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar dados relacionados separadamente
      const result: HistoricoDistribuicao[] = [];

      for (const item of data || []) {
        let lead = null;
        let vendedor = null;
        let vendedor_anterior = null;

        // Buscar lead
        if (item.lead_id) {
          const { data: leadData } = await supabase
            .from('leads')
            .select('id, nome, telefone')
            .eq('id', item.lead_id)
            .single();
          lead = leadData;
        }

        // Buscar vendedor
        if (item.vendedor_id) {
          const { data: vendedorData } = await supabase
            .from('profiles')
            .select('id, nome')
            .eq('id', item.vendedor_id)
            .single();
          vendedor = vendedorData;
        }

        // Buscar vendedor anterior
        if (item.vendedor_anterior_id) {
          const { data: vendedorAnteriorData } = await supabase
            .from('profiles')
            .select('id, nome')
            .eq('id', item.vendedor_anterior_id)
            .single();
          vendedor_anterior = vendedorAnteriorData;
        }

        result.push({
          id: item.id,
          lead_id: item.lead_id,
          vendedor_id: item.vendedor_id,
          vendedor_anterior_id: item.vendedor_anterior_id,
          tipo: item.tipo as TipoAtribuicao,
          motivo: item.motivo,
          created_at: item.created_at,
          created_by: item.created_by,
          lead,
          vendedor,
          vendedor_anterior,
        });
      }

      return result;
    },
  });
}

// ============================================
// ESTATÍSTICAS
// ============================================

export function useDistribuicaoEstatisticas() {
  return useQuery({
    queryKey: ['distribuicao-estatisticas'],
    queryFn: async (): Promise<EstatisticasDistribuicao> => {
      const hoje = new Date().toISOString().split('T')[0];

      // Vendedores ativos
      const { data: vendedores } = await supabase
        .from('distribuicao_leads_vendedores')
        .select('vendedor_id, leads_recebidos_hoje, status, recebendo_leads')
        .eq('status', 'ativo')
        .eq('recebendo_leads', true);

      // Buscar nomes dos vendedores
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
        .from('distribuicao_leads_historico')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${hoje}T00:00:00`);

      const vendedoresAtivos = vendedores || [];
      const totalVendedoresAtivos = vendedoresAtivos.length;

      // Calcular mais/menos leads
      let vendedorMaisLeads = null;
      let vendedorMenosLeads = null;

      if (vendedoresAtivos.length > 0) {
        const sorted = [...vendedoresAtivos].sort(
          (a, b) => (b.leads_recebidos_hoje || 0) - (a.leads_recebidos_hoje || 0)
        );

        const mais = sorted[0];
        const menos = sorted[sorted.length - 1];

        if (mais) {
          const nome = profileMap.get(mais.vendedor_id) || 'Vendedor';
          vendedorMaisLeads = {
            vendedor: nome,
            quantidade: mais.leads_recebidos_hoje || 0,
          };
        }

        if (menos) {
          const nome = profileMap.get(menos.vendedor_id) || 'Vendedor';
          vendedorMenosLeads = {
            vendedor: nome,
            quantidade: menos.leads_recebidos_hoje || 0,
          };
        }
      }

      const totalLeadsHoje = leadsHoje || 0;
      const mediaVendedor = totalVendedoresAtivos > 0 
        ? Math.round(totalLeadsHoje / totalVendedoresAtivos) 
        : 0;

      return {
        total_vendedores_ativos: totalVendedoresAtivos,
        total_leads_hoje: totalLeadsHoje,
        leads_distribuidos_hoje: distribuidosHoje || 0,
        leads_sem_vendedor: leadsSemVendedor || 0,
        media_por_vendedor: mediaVendedor,
        vendedor_mais_leads: vendedorMaisLeads,
        vendedor_menos_leads: vendedorMenosLeads,
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
    mutationFn: async (payload: DistribuirLeadManualPayload) => {
      // Buscar vendedor anterior
      const { data: lead } = await supabase
        .from('leads')
        .select('vendedor_id')
        .eq('id', payload.lead_id)
        .single();

      const vendedorAnteriorId = lead?.vendedor_id;

      // Atualizar lead
      const { error: updateError } = await supabase
        .from('leads')
        .update({ vendedor_id: payload.vendedor_id })
        .eq('id', payload.lead_id);

      if (updateError) throw updateError;

      // Registrar histórico
      const { error: histError } = await supabase
        .from('distribuicao_leads_historico')
        .insert({
          lead_id: payload.lead_id,
          vendedor_id: payload.vendedor_id,
          vendedor_anterior_id: vendedorAnteriorId,
          tipo: vendedorAnteriorId ? 'reatribuicao' : 'manual',
          motivo: payload.motivo || 'Atribuição manual',
        });

      if (histError) throw histError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicao-historico'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicao-estatisticas'] });
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
      const { error } = await supabase.rpc('resetar_contadores_diarios');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribuicao-vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicao-estatisticas'] });
      queryClient.invalidateQueries({ queryKey: ['distribuicao-config'] });
      toast.success('Contadores resetados');
    },
    onError: (error) => {
      console.error('Erro ao resetar contadores:', error);
      toast.error('Erro ao resetar contadores');
    },
  });
}
