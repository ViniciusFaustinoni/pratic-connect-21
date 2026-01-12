import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ApiLeadsLog {
  id: string;
  api_config_id: string;
  origem: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  erro: string | null;
  lead_id: string | null;
  ip_origem: string | null;
  tempo_resposta_ms: number | null;
  created_at: string;
  lead?: {
    id: string;
    nome: string;
  } | null;
}

interface UseApiLeadsLogsParams {
  configId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}

export function useApiLeadsLogs(params: UseApiLeadsLogsParams = {}) {
  const { configId, status, startDate, endDate, search, limit = 50 } = params;

  return useQuery({
    queryKey: ['api-leads-logs', configId, status, startDate, endDate, search, limit],
    queryFn: async () => {
      let query = supabase
        .from('api_leads_logs')
        .select(`
          *,
          lead:leads(id, nome)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (configId) {
        query = query.eq('api_config_id', configId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by search in memory if needed
      let logs = data as ApiLeadsLog[];
      if (search) {
        const searchLower = search.toLowerCase();
        logs = logs.filter(log => 
          log.lead?.nome?.toLowerCase().includes(searchLower) ||
          log.origem?.toLowerCase().includes(searchLower) ||
          log.erro?.toLowerCase().includes(searchLower)
        );
      }

      return logs;
    },
    enabled: true,
  });
}

export function useApiLeadsLogStats(configId?: string) {
  return useQuery({
    queryKey: ['api-leads-logs-stats', configId],
    queryFn: async () => {
      let query = supabase
        .from('api_leads_logs')
        .select('status, created_at');

      if (configId) {
        query = query.eq('api_config_id', configId);
      }

      // Get last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      query = query.gte('created_at', yesterday.toISOString());

      const { data, error } = await query;

      if (error) throw error;

      const total = data?.length || 0;
      const success = data?.filter(d => d.status === 'SUCESSO').length || 0;
      const errors = data?.filter(d => d.status === 'ERRO').length || 0;

      return {
        total,
        success,
        errors,
        successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      };
    },
  });
}
