import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type MotivoSuspensao = 'inadimplencia' | 'nao_instalacao' | 'manual' | 'outro';

export interface InadimplenciaVeiculo {
  veiculoId: string;
  placa: string;
  modelo: string;
  marca: string;
  diasAtraso: number;
  totalDevido: number;
  /** Motivo da suspensão / aparição na lista. */
  motivo: MotivoSuspensao;
  /** Texto bruto gravado em `veiculos.cobertura_suspensa_motivo`, quando aplicável. */
  motivoDetalhe?: string | null;
}

interface InadimplenciaResult {
  /** Veículos com cobrança vencida (inadimplência financeira real). */
  inadimplenciaPorVeiculo: InadimplenciaVeiculo[];
  /** Veículos com cobertura suspensa por motivo NÃO financeiro (não-instalação, manual, etc). */
  veiculosSuspensosOutroMotivo: InadimplenciaVeiculo[];
  /** Lista combinada (compat. com código antigo que precisa só saber "tem algo suspenso"). */
  todosVeiculosSuspensos: InadimplenciaVeiculo[];
  /** True somente quando há cobrança vencida. */
  algumVeiculoInadimplente: boolean;
  /** True quando há qualquer cobertura suspensa (financeira ou não). */
  algumVeiculoComCoberturaSuspensa: boolean;
  /** Benefícios adicionais (vidros, terceiros, carro reserva) só suspendem por inadimplência financeira. */
  beneficiosAdicionaisSuspensos: boolean;
  isLoading: boolean;
}

function classificarMotivo(texto: string | null | undefined): { motivo: MotivoSuspensao; detalhe: string | null } {
  if (!texto) return { motivo: 'outro', detalhe: null };
  const t = texto.toLowerCase();
  if (t.includes('instala')) return { motivo: 'nao_instalacao', detalhe: texto };
  if (t.includes('inadimpl')) return { motivo: 'inadimplencia', detalhe: texto };
  if (t.includes('manual')) return { motivo: 'manual', detalhe: texto };
  return { motivo: 'outro', detalhe: texto };
}

/**
 * Consulta cobranças vencidas agrupadas por veiculo_id e veículos com
 * cobertura suspensa por outros motivos (48h sem instalação, manual, etc.).
 *
 * IMPORTANTE: as duas listas são separadas — suspensão por não-instalação
 * NUNCA deve ser tratada/exibida como inadimplência financeira.
 */
export function useInadimplenciaPorVeiculo(associadoId: string | undefined) {
  const query = useQuery({
    queryKey: ['inadimplencia-por-veiculo', associadoId],
    queryFn: async () => {
      if (!associadoId) {
        return { inadimplencia: [] as InadimplenciaVeiculo[], outros: [] as InadimplenciaVeiculo[] };
      }

      // 1) Cobranças vencidas (inadimplência financeira)
      const { data, error } = await supabase
        .from('cobrancas')
        .select('veiculo_id, data_vencimento, valor_final')
        .eq('associado_id', associadoId)
        .in('status', ['vencido'])
        .not('veiculo_id', 'is', null);

      if (error) throw error;

      // 2) Veículos com cobertura suspensa (qualquer motivo)
      const { data: veiculosSuspensos } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, marca, cobertura_suspensa, cobertura_suspensa_em, cobertura_suspensa_motivo')
        .eq('associado_id', associadoId)
        .eq('cobertura_suspensa', true);

      // Agrupar cobranças por veiculo_id
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
      const inadimplencia: InadimplenciaVeiculo[] = veiculoIds.map(vid => {
        const info = veiculosMap[vid] || { placa: 'N/A', modelo: '', marca: '' };
        const diff = Math.floor((hoje.getTime() - agrupado[vid].vencimentoMaisAntigo.getTime()) / (1000 * 60 * 60 * 24));
        return {
          veiculoId: vid,
          placa: info.placa,
          modelo: info.modelo,
          marca: info.marca,
          diasAtraso: Math.max(0, diff),
          totalDevido: agrupado[vid].total,
          motivo: 'inadimplencia' as MotivoSuspensao,
          motivoDetalhe: null,
        };
      });

      // Suspensos por motivos NÃO financeiros — separados.
      const outros: InadimplenciaVeiculo[] = [];
      for (const v of (veiculosSuspensos || [])) {
        if (inadimplencia.some(x => x.veiculoId === v.id)) continue;
        const dias = v.cobertura_suspensa_em
          ? Math.max(0, Math.floor((hoje.getTime() - new Date(v.cobertura_suspensa_em).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        const { motivo, detalhe } = classificarMotivo(v.cobertura_suspensa_motivo);
        outros.push({
          veiculoId: v.id,
          placa: v.placa || 'N/A',
          modelo: v.modelo || '',
          marca: v.marca || '',
          diasAtraso: dias,
          totalDevido: 0,
          motivo: motivo === 'inadimplencia' ? 'outro' : motivo, // segurança: nunca rotular como financeira aqui
          motivoDetalhe: detalhe,
        });
      }

      return { inadimplencia, outros };
    },
    enabled: !!associadoId,
    staleTime: 30_000,
  });

  const inadimplenciaPorVeiculo = query.data?.inadimplencia || [];
  const veiculosSuspensosOutroMotivo = query.data?.outros || [];
  const algumVeiculoInadimplente = inadimplenciaPorVeiculo.length > 0;
  const algumVeiculoComCoberturaSuspensa =
    inadimplenciaPorVeiculo.length > 0 || veiculosSuspensosOutroMotivo.length > 0;

  return {
    inadimplenciaPorVeiculo,
    veiculosSuspensosOutroMotivo,
    todosVeiculosSuspensos: [...inadimplenciaPorVeiculo, ...veiculosSuspensosOutroMotivo],
    algumVeiculoInadimplente,
    algumVeiculoComCoberturaSuspensa,
    // Benefícios adicionais só são suspensos por inadimplência financeira real.
    beneficiosAdicionaisSuspensos: algumVeiculoInadimplente,
    isLoading: query.isLoading,
  } satisfies InadimplenciaResult;
}
