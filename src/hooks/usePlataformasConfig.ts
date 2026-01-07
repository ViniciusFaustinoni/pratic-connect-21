import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlataformaConfig {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  logo_url?: string;
  api_url_sandbox: string;
  api_url_producao: string;
  auth_type: 'bearer_fixo' | 'oauth_jwt';
  suporta_posicao_tempo_real: boolean;
  suporta_historico: boolean;
  suporta_acionamento_roubo: boolean;
  suporta_bloqueio: boolean;
  suporta_webhooks: boolean;
  ambiente: 'sandbox' | 'producao';
  ativa: boolean;
  headers_extras?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// Hook para listar configurações de plataformas
export function usePlataformasConfig() {
  return useQuery({
    queryKey: ['plataformas-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores_config_plataformas')
        .select('*')
        .order('nome');

      if (error) throw error;
      
      // Map database fields to our interface
      return (data || []).map(item => ({
        id: item.id,
        codigo: item.plataforma,
        nome: item.nome_exibicao,
        descricao: null,
        logo_url: null,
        api_url_sandbox: item.api_url_sandbox,
        api_url_producao: item.api_url_producao,
        auth_type: item.auth_type,
        suporta_posicao_tempo_real: item.suporta_posicao_tempo_real,
        suporta_historico: item.suporta_historico_trajeto,
        suporta_acionamento_roubo: item.suporta_acionamento_roubo,
        suporta_bloqueio: item.suporta_bloqueio,
        suporta_webhooks: item.suporta_webhooks,
        ambiente: item.ambiente_atual,
        ativa: item.ativa,
        headers_extras: item.config,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })) as PlataformaConfig[];
    },
  });
}

// Hook para buscar uma plataforma específica
export function usePlataformaConfig(codigo: string | undefined) {
  return useQuery({
    queryKey: ['plataforma-config', codigo],
    queryFn: async () => {
      if (!codigo) return null;

      const { data, error } = await supabase
        .from('rastreadores_config_plataformas')
        .select('*')
        .eq('plataforma', codigo)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!codigo,
  });
}

// Hook para atualizar configuração de plataforma
export function useUpdatePlataformaConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<{
        ambiente_atual: 'sandbox' | 'producao';
        ativa: boolean;
      }>;
    }) => {
      const { data, error } = await supabase
        .from('rastreadores_config_plataformas')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plataformas-config'] });
      toast.success('Configuração atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}

// Hook para estatísticas de rastreadores por plataforma
export function usePlataformasEstatisticas() {
  return useQuery({
    queryKey: ['plataformas-estatisticas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('plataforma, status')
        .not('plataforma', 'is', null);

      if (error) throw error;

      // Agrupar por plataforma
      const stats: Record<string, { total: number; ativos: number; online: number }> = {};
      
      for (const r of data || []) {
        if (!stats[r.plataforma]) {
          stats[r.plataforma] = { total: 0, ativos: 0, online: 0 };
        }
        stats[r.plataforma].total++;
        if (r.status === 'instalado') {
          stats[r.plataforma].ativos++;
        }
      }

      return stats;
    },
  });
}

// Hook para buscar tokens em cache
export function useTokensCache() {
  return useQuery({
    queryKey: ['rastreadores-tokens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores_tokens_cache')
        .select(`
          *,
          plataforma:rastreadores_config_plataformas(nome_exibicao, plataforma)
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

// Hook para logs de API
export function useRastreadorLogs(plataforma?: string, limit = 50) {
  return useQuery({
    queryKey: ['rastreador-logs', plataforma, limit],
    queryFn: async () => {
      let query = supabase
        .from('rastreadores_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (plataforma) {
        query = query.eq('plataforma', plataforma);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
}
