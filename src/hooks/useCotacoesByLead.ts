import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Cotacao = Tables<'cotacoes'>;

export interface CotacaoWithPlano extends Cotacao {
  planos?: Tables<'planos'> | null;
}

export function useCotacoesByLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ['cotacoes', 'lead', leadId],
    queryFn: async () => {
      if (!leadId) throw new Error('Lead ID é obrigatório');

      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          planos (*)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CotacaoWithPlano[];
    },
    enabled: !!leadId,
  });
}
