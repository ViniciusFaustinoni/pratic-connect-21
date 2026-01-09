import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

export interface FollowupLead {
  id: string;
  nome: string;
  telefone: string;
  etapa: string;
  data_proxima_acao: string;
  vendedor_id: string | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
}

export interface FollowupStats {
  hoje: number;
  atrasados: number;
  semana: number;
}

/**
 * Hook para buscar leads com follow-up agendado para hoje
 */
export function useFollowupsHoje(vendedorId?: string) {
  return useQuery({
    queryKey: ['followups', 'hoje', vendedorId],
    queryFn: async () => {
      const hoje = new Date();
      const inicioHoje = startOfDay(hoje).toISOString();
      const fimHoje = endOfDay(hoje).toISOString();

      let query = supabase
        .from('leads')
        .select('id, nome, telefone, etapa, data_proxima_acao, vendedor_id, veiculo_marca, veiculo_modelo')
        .not('data_proxima_acao', 'is', null)
        .gte('data_proxima_acao', inicioHoje)
        .lte('data_proxima_acao', fimHoje)
        .not('etapa', 'in', '("ganho","perdido")')
        .order('data_proxima_acao', { ascending: true });

      if (vendedorId) {
        query = query.eq('vendedor_id', vendedorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FollowupLead[];
    },
  });
}

/**
 * Hook para buscar leads com follow-up atrasado
 */
export function useFollowupsAtrasados(vendedorId?: string) {
  return useQuery({
    queryKey: ['followups', 'atrasados', vendedorId],
    queryFn: async () => {
      const agora = new Date().toISOString();

      let query = supabase
        .from('leads')
        .select('id, nome, telefone, etapa, data_proxima_acao, vendedor_id, veiculo_marca, veiculo_modelo')
        .not('data_proxima_acao', 'is', null)
        .lt('data_proxima_acao', agora)
        .not('etapa', 'in', '("ganho","perdido")')
        .order('data_proxima_acao', { ascending: true });

      if (vendedorId) {
        query = query.eq('vendedor_id', vendedorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FollowupLead[];
    },
  });
}

/**
 * Hook para buscar estatísticas de follow-ups
 */
export function useFollowupStats(vendedorId?: string) {
  return useQuery({
    queryKey: ['followups', 'stats', vendedorId],
    queryFn: async (): Promise<FollowupStats> => {
      const agora = new Date();
      const inicioHoje = startOfDay(agora).toISOString();
      const fimHoje = endOfDay(agora).toISOString();
      const fimSemana = endOfDay(new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)).toISOString();

      // Query base
      let baseQuery = supabase
        .from('leads')
        .select('id, data_proxima_acao')
        .not('data_proxima_acao', 'is', null)
        .not('etapa', 'in', '("ganho","perdido")');

      if (vendedorId) {
        baseQuery = baseQuery.eq('vendedor_id', vendedorId);
      }

      const { data, error } = await baseQuery;
      if (error) throw error;

      const leads = data || [];
      
      let hoje = 0;
      let atrasados = 0;
      let semana = 0;

      leads.forEach(lead => {
        const dataProxima = lead.data_proxima_acao;
        if (!dataProxima) return;

        if (dataProxima < inicioHoje) {
          atrasados++;
        } else if (dataProxima >= inicioHoje && dataProxima <= fimHoje) {
          hoje++;
        }
        
        if (dataProxima >= inicioHoje && dataProxima <= fimSemana) {
          semana++;
        }
      });

      return { hoje, atrasados, semana };
    },
  });
}
