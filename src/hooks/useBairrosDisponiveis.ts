import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface BairroDisponivel {
  bairro: string;
  cidade: string;
  total: number;
}

/**
 * Hook para buscar bairros com instalações pendentes (sem rota)
 * Agrupa por bairro/cidade e conta quantas instalações existem
 */
export function useBairrosDisponiveis(data?: Date) {
  return useQuery({
    queryKey: ['bairros-disponiveis', data ? format(data, 'yyyy-MM-dd') : 'todas'],
    queryFn: async () => {
      let query = supabase
        .from('instalacoes')
        .select('bairro, cidade')
        .is('rota_id', null)
        .in('status', ['agendada', 'reagendada'])
        .not('bairro', 'is', null);

      if (data) {
        query = query.lte('data_agendada', format(data, 'yyyy-MM-dd'));
      }

      const { data: instalacoes, error } = await query;
      if (error) throw error;

      // Agrupar por bairro e cidade
      const agrupado = new Map<string, BairroDisponivel>();

      instalacoes?.forEach((inst) => {
        const bairro = inst.bairro || 'Sem bairro';
        const cidade = inst.cidade || 'Sem cidade';
        const key = `${cidade}-${bairro}`;

        if (agrupado.has(key)) {
          const existing = agrupado.get(key)!;
          existing.total += 1;
        } else {
          agrupado.set(key, {
            bairro,
            cidade,
            total: 1,
          });
        }
      });

      // Ordenar por total (decrescente) e depois por nome do bairro
      const resultado = Array.from(agrupado.values()).sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.bairro.localeCompare(b.bairro);
      });

      return resultado;
    },
  });
}

/**
 * Hook para buscar instalações de bairros específicos (sem rota)
 */
export function useInstalacoesPorBairros(bairros: string[], data?: Date) {
  return useQuery({
    queryKey: ['instalacoes-por-bairros', bairros, data ? format(data, 'yyyy-MM-dd') : 'todas'],
    queryFn: async () => {
      if (!bairros.length) return [];

      let query = supabase
        .from('instalacoes')
        .select(`
          id,
          bairro,
          cidade,
          cep,
          data_agendada,
          periodo,
          associados (id, nome, telefone),
          veiculos (id, placa, marca, modelo)
        `)
        .is('rota_id', null)
        .in('status', ['agendada', 'reagendada'])
        .in('bairro', bairros)
        .order('bairro')
        .order('data_agendada');

      if (data) {
        query = query.lte('data_agendada', format(data, 'yyyy-MM-dd'));
      }

      const { data: instalacoes, error } = await query;
      if (error) throw error;

      return instalacoes || [];
    },
    enabled: bairros.length > 0,
  });
}
