/**
 * Hook para a aba "Link Público Incompleto" da tela /cadastro/propostas-pendentes.
 *
 * Lista cotações onde o associado ENTROU no link público mas AINDA não
 * concluiu uma etapa que faria o caso entrar na fila normal do Cadastro
 * (contratos.status='assinado' + caminho público completo). Enquanto isso,
 * Cadastro fica cego sobre essas cotações — esse hook resolve isso.
 *
 * Critério de entrada:
 *  - cotacoes.status_contratacao IS NOT NULL e diferente de terminal
 *  - SEM contrato vinculado OU contrato.status NOT IN ('assinado','ativo','cancelado')
 *  - Resultado da etapa canônica != 'nenhuma'
 *
 * Saída: lista pronta pra render, já com `etapaPendentePublica` calculada.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CotacaoWithRelations } from './useCotacoes';
import {
  getEtapaPendentePublica,
  CODIGOS_PENDENCIA_ASSOCIADO,
  type EtapaPendenteInfo,
} from '@/lib/etapaPendentePublica';

export interface CotacaoLinkIncompleto {
  cotacao: CotacaoWithRelations;
  etapa: EtapaPendenteInfo;
  /** Última atualização da cotação (referência para o SLA exibido). */
  ultimaAtualizacao: string | null;
}

const STATUS_CONTRATACAO_ATIVOS = [
  'plano_escolhido',
  'dados_preenchidos',
  'documentos_ok',
  'contrato_gerado',
  'contrato_assinado',
  'autovistoria_ok',
  'vistoria_ok',
  'pagamento_ok',
];

const STATUS_COTACAO_ATIVOS = ['rascunho', 'enviada', 'aceita'];

export function useCotacoesLinkPublicoIncompleto(options?: {
  vendedorId?: string | null;
}) {
  return useQuery({
    queryKey: ['cotacoes-link-publico-incompleto', options?.vendedorId ?? 'all'],
    refetchInterval: 60_000,
    queryFn: async (): Promise<CotacaoLinkIncompleto[]> => {
      let query = supabase
        .from('cotacoes')
        .select(`
          id, numero, status, status_contratacao, created_at, updated_at,
          vendedor_id, lead_id, plano_id, token_publico,
          prioridade, origem_troca_titularidade,
          nome_solicitante, telefone1_solicitante, telefone2_solicitante, email_solicitante,
          veiculo_placa, veiculo_marca, veiculo_modelo, veiculo_ano, valor_fipe,
          valor_adesao, tipo_entrada, dados_extras,
          tipo_vistoria, vistoria_data_agendada,
          leads:leads!fk_cotacoes_lead_id(id, nome, telefone, email),
          planos:planos!plano_id(id, nome, codigo),
          vendedor:profiles!cotacoes_vendedor_id_fkey(id, nome, email),
          contrato:contratos!contratos_cotacao_id_fkey(
            id, numero, status, adesao_paga,
            associados:associados!fk_contratos_associado(id, status)
          ),
          instalacoes:instalacoes!instalacoes_cotacao_id_fkey(id, status, data_agendada)
        `)
        .in('status', STATUS_COTACAO_ATIVOS as any)
        .in('status_contratacao', STATUS_CONTRATACAO_ATIVOS as any)
        .order('updated_at', { ascending: false })
        .limit(500);

      if (options?.vendedorId) {
        query = query.eq('vendedor_id', options.vendedorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const lista = (data ?? []) as unknown as CotacaoWithRelations[];

      const resultado: CotacaoLinkIncompleto[] = [];
      for (const cot of lista) {
        // Cotações cujo contrato já está assinado/ativo entram na fila normal —
        // ignorar (mesma cotação não pode aparecer nas duas abas).
        const contratoStatus = cot.contrato?.status;
        if (contratoStatus && ['assinado', 'ativo', 'cancelado'].includes(contratoStatus)) {
          continue;
        }
        const etapa = getEtapaPendentePublica(cot);
        // Só listar se a pendência é do associado (não da operação).
        if (!CODIGOS_PENDENCIA_ASSOCIADO.has(etapa.codigo)) continue;

        resultado.push({
          cotacao: cot,
          etapa,
          ultimaAtualizacao: cot.updated_at ?? cot.created_at ?? null,
        });
      }

      return resultado;
    },
  });
}

export function useCotacoesLinkPublicoIncompletoCount(options?: {
  vendedorId?: string | null;
}) {
  const { data, isLoading } = useCotacoesLinkPublicoIncompleto(options);
  return { count: data?.length ?? 0, isLoading };
}
