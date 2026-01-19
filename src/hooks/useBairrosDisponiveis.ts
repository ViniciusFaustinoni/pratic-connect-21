import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface BairroDisponivel {
  bairro: string;
  cidade: string;
  total: number;
  instalacoes: number;
  vistorias: number;
}

/**
 * Hook para buscar bairros com serviços pendentes (instalações + vistorias sem rota)
 * Agrupa por bairro/cidade e conta quantos serviços existem de cada tipo
 */
export function useBairrosDisponiveis(data?: Date) {
  return useQuery({
    queryKey: ['bairros-disponiveis', data ? format(data, 'yyyy-MM-dd') : 'todas'],
    queryFn: async () => {
      const dataFormatada = data ? format(data, 'yyyy-MM-dd') : null;
      
      // Buscar instalações pendentes sem rota
      let instalQuery = supabase
        .from('instalacoes')
        .select('bairro, cidade')
        .is('rota_id', null)
        .in('status', ['agendada', 'reagendada'])
        .not('bairro', 'is', null);

      if (dataFormatada) {
        instalQuery = instalQuery.eq('data_agendada', dataFormatada);
      }

      // Buscar vistorias pendentes sem rota (tabela unificada)
      let vistQuery = supabase
        .from('vistorias')
        .select('endereco_bairro, endereco_cidade')
        .is('rota_id', null)
        .in('status', ['pendente', 'em_analise'])
        .not('endereco_bairro', 'is', null);

      if (dataFormatada) {
        vistQuery = vistQuery.lte('data_agendada', dataFormatada);
      }

      const [instalResult, vistResult] = await Promise.all([
        instalQuery,
        vistQuery
      ]);

      if (instalResult.error) throw instalResult.error;
      if (vistResult.error) throw vistResult.error;

      // Agrupar por bairro e cidade
      const agrupado = new Map<string, BairroDisponivel>();

      // Processar instalações
      instalResult.data?.forEach((inst) => {
        const bairro = inst.bairro || 'Sem bairro';
        const cidade = inst.cidade || 'Sem cidade';
        const key = `${cidade}-${bairro}`;

        if (agrupado.has(key)) {
          const existing = agrupado.get(key)!;
          existing.total += 1;
          existing.instalacoes += 1;
        } else {
          agrupado.set(key, {
            bairro,
            cidade,
            total: 1,
            instalacoes: 1,
            vistorias: 0,
          });
        }
      });

      // Processar vistorias
      vistResult.data?.forEach((vist) => {
        const bairro = vist.endereco_bairro || 'Sem bairro';
        const cidade = vist.endereco_cidade || 'Sem cidade';
        const key = `${cidade}-${bairro}`;

        if (agrupado.has(key)) {
          const existing = agrupado.get(key)!;
          existing.total += 1;
          existing.vistorias += 1;
        } else {
          agrupado.set(key, {
            bairro,
            cidade,
            total: 1,
            instalacoes: 0,
            vistorias: 1,
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
        query = query.eq('data_agendada', format(data, 'yyyy-MM-dd'));
      }

      const { data: instalacoes, error } = await query;
      if (error) throw error;

      return instalacoes || [];
    },
    enabled: bairros.length > 0,
  });
}

/**
 * Hook para buscar vistorias de bairros específicos (sem rota) - tabela unificada
 */
export function useVistoriasPorBairros(bairros: string[], data?: Date) {
  return useQuery({
    queryKey: ['vistorias-por-bairros', bairros, data ? format(data, 'yyyy-MM-dd') : 'todas'],
    queryFn: async () => {
      if (!bairros.length) return [];
      
      const dataFormatada = data ? format(data, 'yyyy-MM-dd') : null;

      let query = supabase
        .from('vistorias')
        .select(`
          id,
          endereco_bairro,
          endereco_cidade,
          endereco_cep,
          data_agendada,
          horario_agendado,
          origem,
          tipo,
          associado_id,
          veiculo_id,
          cotacao_id,
          contrato_id,
          associados:associado_id (id, nome, telefone),
          veiculos:veiculo_id (id, placa, marca, modelo)
        `)
        .is('rota_id', null)
        .in('status', ['pendente', 'em_analise'])
        .in('endereco_bairro', bairros)
        .order('endereco_bairro')
        .order('data_agendada');

      if (dataFormatada) {
        query = query.lte('data_agendada', dataFormatada);
      }

      const { data: vistorias, error } = await query;
      if (error) throw error;

      return vistorias || [];
    },
    enabled: bairros.length > 0,
  });
}
