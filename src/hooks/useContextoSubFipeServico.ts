import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { veiculoSubFipe } from '@/hooks/useSolicitarVistoriaTecnico';

export type ViaSubFipe = 'completa_celular' | 'rf_celular' | 'sem_fotos' | null;

export interface ContextoSubFipeServico {
  subFipe: boolean;
  viaSubFipe: ViaSubFipe;
  precisaDecisaoRastreador: boolean;
  veiculoId: string | null;
  cotacaoId: string | null;
  requerRastreadorAtual: boolean | null;
}

/**
 * Lê o contexto sub-FIPE de um serviço/vistoria para que o Monitoramento
 * faça a pergunta "Este veículo vai necessitar de rastreador?" quando o
 * cliente escolheu a Via 2 (R&F enxuto) ou Via 3 (sem fotos) no link público.
 *
 * Aceita um id que pode ser de:
 *  - servicos.id           (caminho mais comum)
 *  - vistorias.id          (fila legada)
 *  - agendamentos_base.id  (vistoria base)
 */
export function useContextoSubFipeServico(id: string | null | undefined) {
  return useQuery({
    queryKey: ['contexto-sub-fipe-servico', id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async (): Promise<ContextoSubFipeServico> => {
      const vazio: ContextoSubFipeServico = {
        subFipe: false,
        viaSubFipe: null,
        precisaDecisaoRastreador: false,
        veiculoId: null,
        cotacaoId: null,
        requerRastreadorAtual: null,
      };
      if (!id) return vazio;

      // Tenta servico primeiro
      let veiculoId: string | null = null;
      let cotacaoId: string | null = null;
      let requerRastreadorAtual: boolean | null = null;

      const { data: serv } = await supabase
        .from('servicos')
        .select('veiculo_id, cotacao_id, requer_rastreador_sub_fipe')
        .eq('id', id)
        .maybeSingle();
      if (serv) {
        veiculoId = (serv as any).veiculo_id ?? null;
        cotacaoId = (serv as any).cotacao_id ?? null;
        requerRastreadorAtual = (serv as any).requer_rastreador_sub_fipe ?? null;
      } else {
        const { data: vist } = await supabase
          .from('vistorias')
          .select('veiculo_id, cotacao_id')
          .eq('id', id)
          .maybeSingle();
        if (vist) {
          veiculoId = (vist as any).veiculo_id ?? null;
          cotacaoId = (vist as any).cotacao_id ?? null;
        } else {
          const { data: agb } = await supabase
            .from('agendamentos_base')
            .select('veiculo_id, cotacao_id')
            .eq('id', id)
            .maybeSingle();
          if (agb) {
            veiculoId = (agb as any).veiculo_id ?? null;
            cotacaoId = (agb as any).cotacao_id ?? null;
          }
        }
      }

      if (!veiculoId) return vazio;

      const { data: veic } = await supabase
        .from('veiculos')
        .select('valor_fipe, combustivel, marca, modelo')
        .eq('id', veiculoId)
        .maybeSingle();

      const subFipe = veiculoSubFipe({
        valor_fipe: (veic as any)?.valor_fipe,
        combustivel: (veic as any)?.combustivel,
        marca: (veic as any)?.marca,
        modelo: (veic as any)?.modelo,
      });

      let viaSubFipe: ViaSubFipe = null;
      if (cotacaoId) {
        const { data: cot } = await supabase
          .from('cotacoes')
          .select('dados_extras')
          .eq('id', cotacaoId)
          .maybeSingle();
        const via = ((cot as any)?.dados_extras as any)?.via_vistoria_sub_fipe;
        if (via === 'completa_celular' || via === 'rf_celular' || via === 'sem_fotos') {
          viaSubFipe = via;
        }
      }

      const precisaDecisaoRastreador =
        subFipe && (viaSubFipe === 'rf_celular' || viaSubFipe === 'sem_fotos');

      return {
        subFipe,
        viaSubFipe,
        precisaDecisaoRastreador,
        veiculoId,
        cotacaoId,
        requerRastreadorAtual,
      };
    },
  });
}
