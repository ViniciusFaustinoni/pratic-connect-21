import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useImprevistosSemResposta() {
  return useQuery({
    queryKey: ['imprevistos-sem-resposta'],
    queryFn: async () => {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id,
          data_agendada,
          status,
          imprevisto_motivo,
          imprevisto_origem,
          reagendamento_enviado_em,
          reagendamento_followup_count,
          associado:associados!servicos_associado_id_fkey(id, nome, telefone),
          profissional:profiles!servicos_profissional_id_fkey(id, nome)
        `)
        .in('status', ['nao_compareceu', 'imprevisto_pendente'])
        .gte('reagendamento_followup_count', 3)
        .not('reagendamento_enviado_em', 'is', null)
        .lte('reagendamento_enviado_em', threeHoursAgo.toISOString())
        .gte('reagendamento_enviado_em', fortyEightHoursAgo.toISOString())
        .order('reagendamento_enviado_em', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}
