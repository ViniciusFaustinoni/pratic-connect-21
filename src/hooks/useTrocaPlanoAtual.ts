import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrocaPlanoAtualInfo {
  plano: { id: string; nome: string; codigo: string | null };
  valorMensal: number | null;
  dataInicio: string | null;
  contratoStatus: string | null;
  associadoAntigoNome: string | null;
}

/**
 * Retorna o plano vigente do associado antigo (referência) quando a cotação
 * é originada de uma troca de titularidade. Retorna null caso não se aplique.
 */
export function useTrocaPlanoAtual(cotacaoId: string | undefined, enabled: boolean) {
  return useQuery<TrocaPlanoAtualInfo | null>({
    queryKey: ['troca-plano-atual', cotacaoId],
    enabled: !!cotacaoId && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: sol } = await (supabase as any)
        .from('solicitacoes_troca_titularidade')
        .select('id, associado_antigo_id, veiculo_id')
        .eq('cotacao_id', cotacaoId)
        .maybeSingle();
      if (!sol?.veiculo_id || !sol?.associado_antigo_id) return null;

      const { data: contrato } = await supabase
        .from('contratos')
        .select('plano_id, valor_mensal, data_inicio, status')
        .eq('veiculo_id', sol.veiculo_id)
        .eq('associado_id', sol.associado_antigo_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!contrato?.plano_id) return null;

      const [{ data: plano }, { data: assoc }] = await Promise.all([
        supabase.from('planos').select('id, nome, codigo').eq('id', contrato.plano_id).maybeSingle(),
        supabase.from('associados').select('nome').eq('id', sol.associado_antigo_id).maybeSingle(),
      ]);
      if (!plano) return null;

      return {
        plano: { id: plano.id, nome: plano.nome, codigo: plano.codigo ?? null },
        valorMensal: contrato.valor_mensal ?? null,
        dataInicio: contrato.data_inicio ?? null,
        contratoStatus: contrato.status ?? null,
        associadoAntigoNome: assoc?.nome ?? null,
      };
    },
  });
}
