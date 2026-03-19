import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DebitoVeiculo {
  placa: string;
  modelo: string;
  marca: string;
  total: number;
  quantidade: number;
}

interface DebitosResult {
  temDebito: boolean;
  debitosPorVeiculo: DebitoVeiculo[];
}

/**
 * Verifica se um associado possui débitos em aberto (vencido ou aguardando_pagamento)
 * em qualquer veículo vinculado ao seu cadastro.
 */
export function useVerificarDebitosAssociado(associadoId: string | undefined) {
  return useQuery<DebitosResult>({
    queryKey: ['verificar-debitos-associado', associadoId],
    queryFn: async () => {
      if (!associadoId) return { temDebito: false, debitosPorVeiculo: [] };

      const { data, error } = await supabase
        .from('cobrancas')
        .select('valor_final, veiculo_id')
        .eq('associado_id', associadoId)
        .in('status', ['vencido', 'aguardando_pagamento']);

      if (error) throw error;
      if (!data || data.length === 0) return { temDebito: false, debitosPorVeiculo: [] };

      // Agrupar por veiculo_id
      const veiculoIds = [...new Set(data.filter(d => d.veiculo_id).map(d => d.veiculo_id!))];

      // Buscar dados dos veículos
      let veiculosMap: Record<string, { placa: string; modelo: string; marca: string }> = {};
      if (veiculoIds.length > 0) {
        const { data: veiculos } = await supabase
          .from('veiculos')
          .select('id, placa, modelo, marca')
          .in('id', veiculoIds);

        if (veiculos) {
          veiculosMap = Object.fromEntries(
            veiculos.map(v => [v.id, { placa: v.placa || '', modelo: v.modelo || '', marca: v.marca || '' }])
          );
        }
      }

      // Agrupar débitos por veículo
      const agrupado: Record<string, DebitoVeiculo> = {};
      for (const item of data) {
        const vid = item.veiculo_id || 'sem_veiculo';
        if (!agrupado[vid]) {
          const info = veiculosMap[vid] || { placa: 'N/A', modelo: 'Não identificado', marca: '' };
          agrupado[vid] = { ...info, total: 0, quantidade: 0 };
        }
        agrupado[vid].total += Number(item.valor_final) || 0;
        agrupado[vid].quantidade += 1;
      }

      const debitosPorVeiculo = Object.values(agrupado);
      return { temDebito: debitosPorVeiculo.length > 0, debitosPorVeiculo };
    },
    enabled: !!associadoId,
    staleTime: 15_000,
  });
}
