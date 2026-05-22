import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PlacaSearchResult } from './useBuscaPlaca';

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/**
 * Busca veículos ATIVOS na base local pela placa, com associado também ATIVO.
 * Usado como fallback/complemento ao SGA na Substituição de Placa,
 * cobrindo casos em que o SGA está fora ou ainda não sincronizou.
 */
export function useBuscaPlacaLocal(termo: string) {
  const placaLimpa = (termo || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const enabled = PLACA_REGEX.test(placaLimpa);

  const query = useQuery({
    queryKey: ['busca-placa-local', placaLimpa],
    enabled,
    queryFn: async (): Promise<PlacaSearchResult[]> => {
      // Cobre placa com e sem hífen herdado (ex.: ABC-1234)
      const placaComHifen = `${placaLimpa.slice(0, 3)}-${placaLimpa.slice(3)}`;
      const { data, error } = await supabase
        .from('veiculos')
        .select(`
          id, placa, marca, modelo, status, associado_id,
          associados!inner ( id, nome, cpf, status )
        `)
        .in('placa', [placaLimpa, placaComHifen])
        .eq('status', 'ativo')
        .eq('associados.status', 'ativo')
        .limit(5);

      if (error) throw error;

      return (data || []).map((v: any) => ({
        veiculoId: v.id,
        placa: v.placa || '',
        modelo: v.modelo || '',
        marca: v.marca || '',
        associadoId: v.associados?.id || v.associado_id,
        associadoNome: v.associados?.nome || '',
        associadoCpf: v.associados?.cpf || '',
        associadoStatus: v.associados?.status || 'ativo',
        origem_sga: false,
      }));
    },
  });

  return query;
}
