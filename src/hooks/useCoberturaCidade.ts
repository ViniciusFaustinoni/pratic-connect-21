import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CoberturaVistoria {
  tem_comum: boolean;
  comuns: { id: string; nome: string; telefone: string | null }[];
  tem_prestador: boolean;
  prestadores: { id: string; nome: string; telefone: string | null }[];
  fora_de_cobertura: boolean;
}

export function useCoberturaCidade(cidade?: string, uf?: string) {
  return useQuery({
    queryKey: ['cobertura-vistoria', cidade, uf],
    enabled: !!cidade && !!uf,
    queryFn: async (): Promise<CoberturaVistoria> => {
      const { data, error } = await supabase.rpc('buscar_cobertura_vistoria' as any, {
        p_cidade: cidade!,
        p_uf: uf!,
      });
      if (error) throw error;
      return data as CoberturaVistoria;
    },
  });
}
