import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay } from 'date-fns';

export interface Movimentacao {
  id: string;
  tipo: 'instalacao' | 'vistoria';
  status: string;
  associado_nome: string | null;
  profissional_nome: string | null;
  bairro: string | null;
  updated_at: string;
}

export function useMovimentacoes() {
  return useQuery({
    queryKey: ['movimentacoes-hoje'],
    queryFn: async (): Promise<Movimentacao[]> => {
      const hoje = startOfDay(new Date()).toISOString();

      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id,
          tipo,
          status,
          bairro,
          updated_at,
          associado:associados(nome),
          profissional:profiles!servicos_profissional_id_fkey(nome)
        `)
        .gte('updated_at', hoje)
        .in('status', ['concluida', 'cancelada', 'em_andamento', 'em_rota'])
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        tipo: item.tipo || 'instalacao',
        status: item.status,
        associado_nome: item.associado?.nome || null,
        profissional_nome: item.profissional?.nome || null,
        bairro: item.bairro || null,
        updated_at: item.updated_at,
      }));
    },
    refetchInterval: 30000,
  });
}
