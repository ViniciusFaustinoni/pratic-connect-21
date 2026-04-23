import { useState, useEffect, useCallback, useRef } from 'react';
import { publicSupabase } from '@/integrations/supabase/publicClient';

export type StatusTermoCancelamento = 'nao_enviado' | 'enviando' | 'enviado' | 'assinado' | 'erro';

interface UseTermoCancelamentoSubstituicaoResult {
  status: StatusTermoCancelamento;
  linkAssinatura: string | null;
  assinadoEm: string | null;
  enviar: () => Promise<void>;
  recarregar: () => Promise<void>;
  erro: string | null;
  contratoAntigoId: string | null;
  associadoId: string | null;
}

/**
 * Hook que orquestra o termo de cancelamento do veículo antigo
 * em fluxos de SUBSTITUIÇÃO de veículo.
 *
 * - Busca substituicoes_veiculo pela cotação
 * - Encontra o contrato antigo (associado_id + veiculo_antigo_id)
 * - Expõe envio do termo + polling do status de assinatura
 */
export function useTermoCancelamentoSubstituicao(cotacaoId: string | undefined) {
  const [status, setStatus] = useState<StatusTermoCancelamento>('nao_enviado');
  const [linkAssinatura, setLinkAssinatura] = useState<string | null>(null);
  const [assinadoEm, setAssinadoEm] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [contratoAntigoId, setContratoAntigoId] = useState<string | null>(null);
  const [associadoId, setAssociadoId] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  const carregarEstado = useCallback(async (): Promise<UseTermoCancelamentoSubstituicaoResult | void> => {
    if (!cotacaoId) return;

    try {
      // 1) Buscar substituição associada à cotação
      // A cotação aponta para a substituição via cotacao_id (campo na cotação) ou
      // a substituição referencia o veículo antigo + associado. Aqui buscamos por
      // metadata: substituicoes_veiculo conectadas à cotação atual via dados_extras.
      const { data: cot } = await publicSupabase
        .from('cotacoes')
        .select('id, dados_extras')
        .eq('id', cotacaoId)
        .maybeSingle();

      const extras = (cot?.dados_extras || {}) as Record<string, any>;
      const substituicaoId = extras?.substituicao_id as string | undefined;
      const veiculoAntigoId = extras?.veiculo_antigo_id as string | undefined;
      const associadoIdExtras = extras?.associado_id as string | undefined;

      let sub: any = null;
      if (substituicaoId) {
        const { data } = await publicSupabase
          .from('substituicoes_veiculo')
          .select('id, associado_id, veiculo_antigo_id')
          .eq('id', substituicaoId)
          .maybeSingle();
        sub = data;
      } else if (veiculoAntigoId) {
        const { data } = await publicSupabase
          .from('substituicoes_veiculo')
          .select('id, associado_id, veiculo_antigo_id')
          .eq('veiculo_antigo_id', veiculoAntigoId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        sub = data;
      } else if (associadoIdExtras) {
        const { data } = await publicSupabase
          .from('substituicoes_veiculo')
          .select('id, associado_id, veiculo_antigo_id')
          .eq('associado_id', associadoIdExtras)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        sub = data;
      }

      if (!sub) {
        return;
      }

      setAssociadoId(sub.associado_id);

      // 2) Buscar contrato ATIVO do veículo antigo (ou do associado).
      // Usamos cast para Record porque o cliente público tipa colunas via types.ts;
      // a coluna autentique_cancelamento_assinado_em foi adicionada por migração recente.
      const { data: contrato } = await publicSupabase
        .from('contratos')
        .select('id, autentique_cancelamento_id, autentique_cancelamento_url, autentique_cancelamento_assinado_em, status')
        .eq('associado_id', sub.associado_id)
        .in('status', ['ativo', 'assinado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: Record<string, any> | null };

      if (!contrato) {
        // Não há contrato ativo — cenário inválido para substituição
        return;
      }

      setContratoAntigoId(contrato.id);
      setLinkAssinatura(contrato.autentique_cancelamento_url || null);
      setAssinadoEm(contrato.autentique_cancelamento_assinado_em || null);

      if (contrato.autentique_cancelamento_assinado_em) {
        setStatus('assinado');
      } else if (contrato.autentique_cancelamento_id) {
        setStatus('enviado');
      } else {
        setStatus('nao_enviado');
      }
    } catch (e: any) {
      console.error('[useTermoCancelamentoSubstituicao] Erro ao carregar estado:', e);
      setErro(e?.message || 'Erro ao carregar estado do termo');
    }
  }, [cotacaoId]);

  // Carregar estado inicial
  useEffect(() => {
    void carregarEstado();
  }, [carregarEstado]);

  // Polling enquanto status === 'enviado'
  useEffect(() => {
    if (status !== 'enviado') {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = window.setInterval(() => {
      void carregarEstado();
    }, 8000);

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [status, carregarEstado]);

  const enviar = useCallback(async () => {
    if (!associadoId) {
      setErro('Não foi possível identificar o associado da substituição');
      return;
    }
    setStatus('enviando');
    setErro(null);
    try {
      const { data, error } = await publicSupabase.functions.invoke('autentique-cancelamento-create', {
        body: {
          associado_id: associadoId,
          contrato_id: contratoAntigoId,
          motivo: 'Substituição de veículo',
        },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Falha ao gerar termo de cancelamento');

      setLinkAssinatura(data?.signatureLink || null);
      setStatus('enviado');
    } catch (e: any) {
      console.error('[useTermoCancelamentoSubstituicao] Erro ao enviar:', e);
      setErro(e?.message || 'Erro ao enviar termo de cancelamento');
      setStatus('erro');
    }
  }, [associadoId, contratoAntigoId]);

  return {
    status,
    linkAssinatura,
    assinadoEm,
    enviar,
    recarregar: carregarEstado,
    erro,
    contratoAntigoId,
    associadoId,
  };
}
