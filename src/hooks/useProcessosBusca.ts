import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useProcessosBusca(busca: string) {
  const { data: processos = [], isLoading } = useQuery({
    queryKey: ['processos-busca', busca],
    queryFn: async () => {
      if (!busca || busca.length < 2) return [];
      const { data, error } = await supabase
        .from('processos')
        .select('id, numero, numero_processo, parte_contraria_nome, tipo')
        .or(`numero.ilike.%${busca}%,numero_processo.ilike.%${busca}%,parte_contraria_nome.ilike.%${busca}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: busca.length >= 2,
  });

  return { processos, isLoading };
}
