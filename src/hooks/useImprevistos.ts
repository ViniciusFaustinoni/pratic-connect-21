import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DateRange } from 'react-day-picker';

export interface ImprevistoFilters {
  motivo?: string;
  dateRange?: DateRange;
  instaladorId?: string;
}

export function useImprevistos(filters: ImprevistoFilters) {
  return useQuery({
    queryKey: ['imprevistos', filters],
    queryFn: async () => {
      let query = supabase
        .from('servicos')
        .select(`
          id,
          data_agendada,
          status,
          imprevisto_motivo,
          imprevisto_registrado_em,
          imprevisto_duplo_check,
          imprevisto_duplo_check_em,
          reagendamento_enviado_em,
          profissional_id,
          associado:associados!servicos_associado_id_fkey(id, nome, telefone),
          profissional:profiles!servicos_profissional_id_fkey(id, nome)
        `)
        .not('imprevisto_registrado_em', 'is', null)
        .order('imprevisto_registrado_em', { ascending: false });

      if (filters.motivo) {
        query = query.eq('imprevisto_motivo', filters.motivo);
      }

      if (filters.instaladorId) {
        query = query.eq('profissional_id', filters.instaladorId);
      }

      if (filters.dateRange?.from) {
        query = query.gte('imprevisto_registrado_em', filters.dateRange.from.toISOString());
      }
      if (filters.dateRange?.to) {
        const endOfDay = new Date(filters.dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('imprevisto_registrado_em', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
