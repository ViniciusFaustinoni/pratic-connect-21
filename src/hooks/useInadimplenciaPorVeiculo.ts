import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InadimplenciaVeiculo {
  veiculoId: string;
  placa: string;
  modelo: string;
  marca: string;
  diasAtraso: number;
  totalDevido: number;
}

interface InadimplenciaResult {
  inadimplenciaPorVeiculo: InadimplenciaVeiculo[];
  algumVeiculoInadimplente: boolean;
  beneficiosAdicionaisSuspensos: boolean;
  isLoading: boolean;
}

/**
 * Consulta cobranças vencidas agrupadas por veiculo_id.
 * Retorna quais veículos estão inadimplentes individualmente
 * e se benefícios adicionais devem ser suspensos globalmente.
 */
export function useInadimplenciaPorVeiculo(associadoId: string | undefined) {
  const query = useQuery({
    queryKey: ['inadimplencia-por-veiculo', associadoId],
    queryFn: async (): Promise<InadimplenciaVeiculo[]> => {
      if (!associadoId) return [];

      const { data, error } = await supabase
        .from('cobrancas')
        .select('veiculo_id, data_vencimento, valor_final')
        .eq('associado_id', associadoId)
        .in('status', ['vencido'])
        .not('veiculo_id', 'is', null);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Group by veiculo_id
      const agrupado: Record<string, { vencimentoMaisAntigo: Date; total: number }> = {};
      for (const item of data) {
        const vid = item.veiculo_id!;
        if (!agrupado[vid]) {
          agrupado[vid] = { vencimentoMaisAntigo: new Date(item.data_vencimento), total: 0 };
        } else {
          const d = new Date(item.data_vencimento);
          if (d < agrupado[vid].vencimentoMaisAntigo) agrupado[vid].vencimentoMaisAntigo = d;
        }
        agrupado[vid].total += Number(item.valor_final) || 0;
      }

      const veiculoIds = Object.keys(agrupado);
      if (veiculoIds.length === 0) return [];

      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, marca')
        .in('id', veiculoIds);

      const veiculosMap: Record<string, { placa: string; modelo: string; marca: string }> = {};
      if (veiculos) {
        for (const v of veiculos) {
          veiculosMap[v.id] = { placa: v.placa || '', modelo: v.modelo || '', marca: v.marca || '' };
        }
      }

      const hoje = new Date();
      return veiculoIds.map(vid => {
        const info = veiculosMap[vid] || { placa: 'N/A', modelo: '', marca: '' };
        const diff = Math.floor((hoje.getTime() - agrupado[vid].vencimentoMaisAntigo.getTime()) / (1000 * 60 * 60 * 24));
        return {
          veiculoId: vid,
          placa: info.placa,
          modelo: info.modelo,
          marca: info.marca,
          diasAtraso: Math.max(0, diff),
          totalDevido: agrupado[vid].total,
        };
      });
    },
    enabled: !!associadoId,
    staleTime: 30_000,
  });

  const inadimplenciaPorVeiculo = query.data || [];
  const algumVeiculoInadimplente = inadimplenciaPorVeiculo.length > 0;

  return {
    inadimplenciaPorVeiculo,
    algumVeiculoInadimplente,
    beneficiosAdicionaisSuspensos: algumVeiculoInadimplente,
    isLoading: query.isLoading,
  } satisfies InadimplenciaResult;
}
