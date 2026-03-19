import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlacaSearchResult {
  veiculoId: string;
  placa: string;
  modelo: string;
  marca: string;
  associadoId: string;
  associadoNome: string;
  associadoCpf: string;
  associadoStatus: string;
}

export function useBuscaPlaca(termo: string) {
  return useQuery({
    queryKey: ['busca-placa', termo],
    queryFn: async (): Promise<PlacaSearchResult[]> => {
      if (!termo || termo.length < 3) return [];

      const cleaned = termo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      const { data, error } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, marca, associado_id, associados(id, nome, cpf, status)')
        .ilike('placa', `%${cleaned}%`)
        .eq('status', 'ativo')
        .limit(5);

      if (error) throw error;
      if (!data) return [];

      return data
        .filter((v: any) => v.associados)
        .map((v: any) => ({
          veiculoId: v.id,
          placa: v.placa || '',
          modelo: v.modelo || '',
          marca: v.marca || '',
          associadoId: v.associados.id,
          associadoNome: v.associados.nome || '',
          associadoCpf: v.associados.cpf || '',
          associadoStatus: v.associados.status || '',
        }));
    },
    enabled: termo.length >= 3,
  });
}
