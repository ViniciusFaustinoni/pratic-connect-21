import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VistoriadorCidade {
  id: string;
  cidade: string;
  uf: string;
  tipo_vistoriador: 'comum' | 'prestador';
  vistoriador_comum_id: string | null;
  vistoriador_prestador_id: string | null;
  created_at: string;
}

interface VinculoInput {
  cidade: string;
  uf: string;
  tipo_vistoriador: 'comum' | 'prestador';
  vistoriador_comum_id?: string | null;
  vistoriador_prestador_id?: string | null;
}

const QUERY_KEY = ['vistoriador-cidades'];

export function useVistoriadorCidades(filtros?: { vistoriador_comum_id?: string; vistoriador_prestador_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...QUERY_KEY, filtros],
    queryFn: async (): Promise<VistoriadorCidade[]> => {
      let q = (supabase as any)
        .from('vistoriador_cidades')
        .select('*')
        .order('cidade');

      if (filtros?.vistoriador_comum_id) {
        q = q.eq('vistoriador_comum_id', filtros.vistoriador_comum_id);
      }
      if (filtros?.vistoriador_prestador_id) {
        q = q.eq('vistoriador_prestador_id', filtros.vistoriador_prestador_id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const vincular = useMutation({
    mutationFn: async (input: VinculoInput) => {
      const { error } = await (supabase as any)
        .from('vistoriador_cidades')
        .insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Cidade vinculada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const desvincular = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('vistoriador_cidades')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Cidade desvinculada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  return { ...query, vincular, desvincular };
}
