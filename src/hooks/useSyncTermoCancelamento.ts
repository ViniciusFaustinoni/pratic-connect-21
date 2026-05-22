import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Tipo = 'troca' | 'substituicao';

/**
 * Polling client-side do termo de cancelamento (Troca / Substituição).
 *
 * Por que existe: o webhook do Autentique (`autentique-webhook`) não está
 * chegando ao projeto, então a assinatura por biometria não atualiza
 * `termo_cancelamento_assinado_em` automaticamente. Esta hook chama a edge
 * `autentique-sync-termo-cancelamento` enquanto o modal estiver aberto e o
 * termo ainda não estiver marcado como assinado.
 *
 * Estratégia:
 *   1. Dispara um sync imediato ao montar (cobre o caso "operador acabou de
 *      abrir o modal e quer ver o resultado").
 *   2. Repete a cada 15s enquanto estiver `enabled`.
 *   3. Quando a edge retorna `atualizado: true`, invalida as queries de troca/
 *      substituição (o realtime já invalida sozinho via Postgres changes, mas
 *      garantimos atualização imediata mesmo quando o canal demora).
 */
export function useSyncTermoCancelamento(params: {
  tipo: Tipo;
  solicitacaoId: string | null | undefined;
  enabled: boolean;
}) {
  const { tipo, solicitacaoId, enabled } = params;
  const qc = useQueryClient();
  const [verificando, setVerificando] = useState(false);
  const [ultimaVerificacao, setUltimaVerificacao] = useState<Date | null>(null);

  const invalidarQueries = () => {
    if (tipo === 'troca') {
      qc.invalidateQueries({ queryKey: ['solicitacao-troca'] });
      qc.invalidateQueries({ queryKey: ['solicitacoes-troca'] });
    } else {
      qc.invalidateQueries({ queryKey: ['solicitacao-substituicao'] });
      qc.invalidateQueries({ queryKey: ['solicitacoes-substituicao'] });
    }
  };

  const verificar = async (silencioso = true) => {
    if (!solicitacaoId) return;
    if (verificando) return;
    setVerificando(true);
    try {
      const { data, error } = await supabase.functions.invoke('autentique-sync-termo-cancelamento', {
        body: { tipo, solicitacao_id: solicitacaoId },
      });
      if (error) {
        if (!silencioso) toast.error(`Falha ao consultar Autentique: ${error.message}`);
        return;
      }
      if (data?.atualizado) {
        invalidarQueries();
        if (!silencioso) toast.success('Termo assinado detectado — atualizando…');
      } else if (!silencioso) {
        const motivo: string = data?.motivo || 'sem_resposta';
        if (motivo === 'aguardando_assinatura') {
          toast.info('Autentique ainda não registrou a assinatura. Tente novamente em alguns segundos.');
        } else if (motivo === 'ja_assinada') {
          invalidarQueries();
          toast.success('Termo já estava assinado — atualizando…');
        } else {
          toast.message(`Sem novidades: ${motivo}`);
        }
      }
      setUltimaVerificacao(new Date());
    } finally {
      setVerificando(false);
    }
  };

  useEffect(() => {
    if (!enabled || !solicitacaoId) return;
    // Verificação imediata ao habilitar.
    void verificar(true);
    const id = setInterval(() => {
      void verificar(true);
    }, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, solicitacaoId, tipo]);

  return {
    verificando,
    ultimaVerificacao,
    verificarAgora: () => verificar(false),
  };
}
