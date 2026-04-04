import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

export interface FiltrosHistorico {
  dataInicio?: string;
  dataFim?: string;
  tipoAtribuicao?: string;
  profissionalId?: string;
}

export function useHistoricoAtribuicoes(filtros: FiltrosHistorico = {}) {
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const query = useQuery({
    queryKey: ['historico-atribuicoes', filtros, page],
    queryFn: async () => {
      let q = supabase
        .from('servicos_atribuicoes_log')
        .select(`
          id, tipo_atribuicao, distancia_km, observacoes, created_at,
          servico:servicos!servicos_atribuicoes_log_servico_id_fkey(
            id, tipo, data_agendada, hora_agendada, bairro, cidade,
            associado:associados!servicos_associado_id_fkey(nome),
            veiculo:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo)
          ),
          profissional:profiles!servicos_atribuicoes_log_profissional_id_fkey(nome, avatar_url),
          atribuidor:profiles!servicos_atribuicoes_log_atribuido_por_fkey(nome)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filtros.tipoAtribuicao && filtros.tipoAtribuicao !== 'todos') {
        q = q.eq('tipo_atribuicao', filtros.tipoAtribuicao);
      }
      if (filtros.profissionalId) {
        q = q.eq('profissional_id', filtros.profissionalId);
      }
      if (filtros.dataInicio) {
        q = q.gte('created_at', `${filtros.dataInicio}T00:00:00`);
      }
      if (filtros.dataFim) {
        q = q.lte('created_at', `${filtros.dataFim}T23:59:59`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data || [], total: count || 0 };
    },
    staleTime: 30000,
  });

  return { ...query, page, setPage, pageSize };
}
