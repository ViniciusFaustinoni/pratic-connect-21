import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Contagem combinada para o badge do item "Aprovações" do Monitoramento no sidebar.
 * Soma os itens "aguardando" das 6 abas:
 *  1. Aprovação de Associados
 *  2. Troca de Titularidade
 *  3. Liberação de Suspensão (autovistoria)
 *  4. Recusas do Instalador
 *  5. Ressalvas Pendentes
 *  6. Imprevistos sem resposta (>=3 followups)
 */
export function useAprovacoesMonitoramentoCount() {
  return useQuery<number>({
    queryKey: ['aprovacoes-monitoramento-count', 'v3'],
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
        // 1. Aprovação de Associados — instalações/vistorias concluídas com veículo ainda sem cobertura total e associado não ativo
        safe((async () => {
          const { data } = await (supabase as any)
            .from('servicos')
            .select('id, veiculo:veiculo_id(cobertura_total), associado:associado_id(status)')
            .in('tipo', ['instalacao', 'vistoria_entrada'])
            .eq('status', 'concluida');
          return (data || []).filter((s: any) =>
            s?.veiculo && s.veiculo.cobertura_total !== true && s?.associado?.status !== 'ativo'
          ).length;
        })()),

        // 2. Troca de Titularidade — aguardando ação do monitoramento
        safe((async () => {
          const { count } = await supabase
            .from('solicitacoes_troca_titularidade')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'aguardando_monitoramento');
          return count || 0;
        })()),

        // 3. Liberação de Suspensão — veículos suspensos com contrato ativo/assinado e sem liberação registrada
        safe((async () => {
          const { data: veics } = await supabase
            .from('veiculos')
            .select('id')
            .eq('cobertura_suspensa', true);
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

        // 4. Recusas do Instalador — pendentes de análise
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

      return associados + troca + liberacaoSuspensao + recusas + ressalvas + imprevistos;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
