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

      // 1) Cobranças vencidas (inadimplência financeira)
      const { data, error } = await supabase
        .from('cobrancas')
        .select('veiculo_id, data_vencimento, valor_final')
        .eq('associado_id', associadoId)
        .in('status', ['vencido'])
        .not('veiculo_id', 'is', null);

      if (error) throw error;

      // 2) Veículos com cobertura suspensa por outros motivos
      //    (ex: 48h sem instalação, suspensão manual). NÃO entram na lista de
      //    inadimplência financeira, mas precisam disparar o botão "Reativar".
      const { data: veiculosSuspensos } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, marca, cobertura_suspensa, cobertura_suspensa_em')
        .eq('associado_id', associadoId)
        .eq('cobertura_suspensa', true);

      // Group cobrancas by veiculo_id
      const agrupado: Record<string, { vencimentoMaisAntigo: Date; total: number }> = {};
      for (const item of (data || [])) {
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
      let veiculosMap: Record<string, { placa: string; modelo: string; marca: string }> = {};

      if (veiculoIds.length > 0) {
        const { data: veiculos } = await supabase
          .from('veiculos')
          .select('id, placa, modelo, marca')
          .in('id', veiculoIds);
        if (veiculos) {
          for (const v of veiculos) {
            veiculosMap[v.id] = { placa: v.placa || '', modelo: v.modelo || '', marca: v.marca || '' };
          }
        }
      }

      const hoje = new Date();
      const lista: InadimplenciaVeiculo[] = veiculoIds.map(vid => {
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

      // Adiciona veículos com cobertura suspensa que ainda não estão na lista
      // (suspensão sem inadimplência — 48h, manual, etc.). diasAtraso = 0,
      // totalDevido = 0 — sinaliza apenas que a cobertura está suspensa.
      for (const v of (veiculosSuspensos || [])) {
        if (lista.some(x => x.veiculoId === v.id)) continue;
        const dias = v.cobertura_suspensa_em
          ? Math.max(0, Math.floor((hoje.getTime() - new Date(v.cobertura_suspensa_em).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        lista.push({
          veiculoId: v.id,
          placa: v.placa || 'N/A',
          modelo: v.modelo || '',
          marca: v.marca || '',
          diasAtraso: dias,
          totalDevido: 0,
        });
      }

      return lista;
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

