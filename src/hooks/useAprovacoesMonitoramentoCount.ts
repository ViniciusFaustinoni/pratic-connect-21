import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AprovacoesMonitoramentoBreakdown {
  associados: number;
  troca: number;
  liberacaoSuspensao: number;
  recusas: number;
  ressalvas: number;
  imprevistos: number;
  total: number;
}

/**
 * Contagem por aba (mesmas queries que cada aba usa) + total para o badge do sidebar.
 * IMPORTANTE: cada source aqui DEVE bater com a query da aba correspondente,
 * caso contrário o badge mostra um número que não aparece em nenhuma aba.
 */
export function useAprovacoesMonitoramentoBreakdown() {
  return useQuery<AprovacoesMonitoramentoBreakdown>({
    queryKey: ['aprovacoes-monitoramento-breakdown', 'v4'],
    queryFn: async () => {
      const safe = async (p: Promise<number>): Promise<number> => {
        try { return await p; } catch (e) { console.warn('[aprovacoes-count] fonte falhou', e); return 0; }
      };

      const [
        associados,
        troca,
        liberacaoSuspensao,
        recusas,
        ressalvas,
        imprevistos,
      ] = await Promise.all([
        // 1. Aprovação de Associados — espelha useInstalacoesAguardandoAprovacao
        // (filtrar SÓ por veículo; aprovação é por veículo, não por associado)
        safe((async () => {
          const { data } = await (supabase as any)
            .from('servicos')
            .select('id, vistoria_origem_id, veiculo:veiculo_id(cobertura_total), instalacao:instalacao_origem_id(contrato:contrato_id(cadastro_aprovado))')
            .in('tipo', ['instalacao', 'vistoria_entrada'])
            .eq('status', 'concluida');
          const vistIds = Array.from(new Set((data || [])
            .filter((s: any) => s?.vistoria_origem_id && !s.instalacao?.contrato)
            .map((s: any) => s.vistoria_origem_id)));
          const vMap = new Map<string, boolean>();
          if (vistIds.length) {
            const { data: vs } = await supabase.from('vistorias')
              .select('id, contratos:contrato_id(cadastro_aprovado)').in('id', vistIds as string[]);
            (vs || []).forEach((v: any) => vMap.set(v.id, v.contratos?.cadastro_aprovado === true));
          }
          return (data || []).filter((s: any) =>
            s?.veiculo && s.veiculo.cobertura_total !== true &&
            (s.instalacao?.contrato?.cadastro_aprovado === true ||
             (s.vistoria_origem_id && vMap.get(s.vistoria_origem_id) === true))
          ).length;
        })()),

        // 2. Troca de Titularidade
        safe((async () => {
          const { count } = await supabase
            .from('solicitacoes_troca_titularidade')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'aguardando_monitoramento');
          return count || 0;
        })()),

        // 3. Liberação de Suspensão — espelha useLiberacoesAutoVistoria (filtra por motivo)
        safe((async () => {
          const { data: veics } = await supabase
            .from('veiculos')
            .select('id')
            .eq('cobertura_suspensa', true)
            .or('cobertura_suspensa_motivo.eq.Auto-vistoria sem instalação no prazo,cobertura_suspensa_motivo.ilike.Instalação não realizada%');
          const veiculoIds = (veics || []).map((v: any) => v.id);
          if (!veiculoIds.length) return 0;
          const { data: contratos } = await supabase
            .from('contratos')
            .select('id, veiculo_id, liberado_reagendamento_em, status')
            .in('veiculo_id', veiculoIds)
            .in('status', ['ativo', 'assinado'])
            .is('liberado_reagendamento_em', null);
          return (contratos || []).length;
        })()),

        // 4. Recusas do Instalador
        safe((async () => {
          const { count } = await supabase
            .from('servicos')
            .select('id', { count: 'exact', head: true })
            .eq('decisao_instalador', 'negado')
            .eq('status', 'em_analise');
          return count || 0;
        })()),

        // 5. Ressalvas Pendentes
        safe((async () => {
          const { count } = await supabase
            .from('servicos')
            .select('id', { count: 'exact', head: true })
            .eq('decisao_instalador', 'pendente_monitoramento')
            .eq('status', 'em_analise');
          return count || 0;
        })()),

        // 6. Imprevistos sem resposta (followups esgotados)
        safe((async () => {
          const { count } = await supabase
            .from('servicos')
            .select('id', { count: 'exact', head: true })
            .in('status', ['nao_compareceu', 'imprevisto_pendente'])
            .gte('reagendamento_followup_count', 3);
          return count || 0;
        })()),
      ]);

      const total = associados + troca + liberacaoSuspensao + recusas + ressalvas + imprevistos;
      return { associados, troca, liberacaoSuspensao, recusas, ressalvas, imprevistos, total };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Backward-compat: total apenas (usado pelo sidebar). */
export function useAprovacoesMonitoramentoCount() {
  const q = useAprovacoesMonitoramentoBreakdown();
  return { ...q, data: q.data?.total ?? 0 };
}
