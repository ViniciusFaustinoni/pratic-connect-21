// Edge function: confirmar-adesao-zerada
// Server-authoritative para o branch "adesão zerada" / "agência em mãos" do link público.
// Substitui a sequência client-side que rodava em EtapaPagamentoCotacao.tsx
// (catch silencioso deixava UI em "Parabéns!" sem promover status_contratacao).
//
// Atômico via RPC fn_confirmar_adesao_zerada (marca contrato.adesao_paga + promove
// cotacoes.status_contratacao 'contrato_assinado' -> 'pagamento_ok' com CAS).
// Idempotente: 2ª chamada vira no-op.
// Materializa instalação chamando criar-instalacao-pos-pagamento; aceita o 400
// "Dados de agendamento não encontrados" como não-erro (cliente ainda vai agendar).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { insertAuditLog } from '../_shared/auditLog.ts';
import {
  checarCompletudeAutovistoriaSubFipe,
  type TipoVeiculoSubFipe,
} from '../_shared/fotosVistoriaSubFipe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Origem = 'adesao_zerada' | 'agencia_em_maos';

interface Body {
  cotacao_id: string;
  origem: Origem;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function mapErroParaMensagem(code: string): string {
  switch (code) {
    case 'cotacao_nao_encontrada':
      return 'Cotação não encontrada. Recarregue a página.';
    case 'contrato_nao_encontrado':
      return 'Contrato ainda não foi gerado para esta cotação. Volte à etapa anterior.';
    case 'adesao_nao_zerada':
      return 'Esta cotação possui valor de adesão a pagar — não é isenta.';
    case 'origem_invalida':
      return 'Origem inválida para confirmação automática.';
    case 'transicao_invalida':
      return 'Esta cotação não está no estado esperado para confirmação automática. Recarregue a página.';
    default:
      return 'Não conseguimos confirmar sua adesão isenta agora. Tente novamente em instantes; se persistir, fale com o suporte.';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as Body;
    const { cotacao_id, origem } = body ?? {};

    if (!cotacao_id || typeof cotacao_id !== 'string') {
      return jsonResponse({
        success: false,
        error: 'cotacao_id_invalido',
        mensagem: 'Identificador de cotação ausente.',
      }, 400);
    }
    if (origem !== 'adesao_zerada' && origem !== 'agencia_em_maos') {
      return jsonResponse({
        success: false,
        error: 'origem_invalida',
        mensagem: mapErroParaMensagem('origem_invalida'),
      }, 400);
    }

    console.log('[confirmar-adesao-zerada] início', { cotacao_id, origem });

    // 1) Execução atômica via RPC
    const { data: rpcRows, error: rpcError } = await supabase.rpc('fn_confirmar_adesao_zerada', {
      p_cotacao_id: cotacao_id,
      p_origem: origem,
    });

    if (rpcError) {
      console.error('[confirmar-adesao-zerada] RPC erro:', rpcError);
      return jsonResponse({
        success: false,
        error: 'erro_interno',
        mensagem: mapErroParaMensagem('erro_interno'),
        detail: rpcError.message,
      }, 500);
    }

    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!row?.ok) {
      const code = row?.erro || 'erro_interno';
      const httpStatus = ['cotacao_nao_encontrada', 'contrato_nao_encontrado'].includes(code)
        ? 404
        : code === 'adesao_nao_zerada' || code === 'origem_invalida'
          ? 400
          : 500;
      return jsonResponse({
        success: false,
        error: code,
        mensagem: mapErroParaMensagem(code),
      }, httpStatus);
    }

    const contratoId: string = row.contrato_id;
    const statusContratacao: string = row.status_contratacao;
    const idempotente: boolean = row.idempotente === true;

    // 2) Materializar instalação (não-bloqueante quando ausência de agendamento)
    let instalacaoMaterializada = false;
    try {
      const { data: instData, error: instError } = await supabase.functions.invoke(
        'criar-instalacao-pos-pagamento',
        { body: { cotacaoId: cotacao_id, skipPaymentCheck: true } },
      );

      if (instError) {
        // Inspeciona corpo do erro: aceitar apenas o 400 "sem agendamento" como ok
        let errBody: any = null;
        try {
          const ctx = (instError as any).context;
          if (ctx && typeof ctx.json === 'function') {
            errBody = await ctx.json();
          }
        } catch { /* ignore */ }

        const errStr = (errBody?.error || errBody?.message || instError.message || '').toString().toLowerCase();
        const semAgendamento = errStr.includes('agendamento') || errStr.includes('sem_agendamento');

        if (!semAgendamento) {
          console.error('[confirmar-adesao-zerada] criar-instalacao erro real:', errBody || instError);
          // Não fatal: status_contratacao já está em pagamento_ok (idempotente).
          // Retorna sucesso, mas registra que materialização falhou — cliente
          // pode prosseguir para agendamento, que materializará então.
        }
      } else if (instData?.success) {
        instalacaoMaterializada = true;
      }
    } catch (e) {
      console.warn('[confirmar-adesao-zerada] invocação criar-instalacao falhou (não bloqueante):', e);
    }

    // 3) Log de auditoria (best-effort, não bloqueante)
    try {
      await insertAuditLog(supabase, {
        usuario_id: null,
        usuario_nome: 'sistema',
        acao: 'criar',
        modulo: 'cotacao',
        descricao: `[CONFIRMAR_ADESAO_ZERADA] origem=${origem} cotacao=${cotacao_id} idempotente=${idempotente}`,
        tabela: 'cotacoes',
        registro_id: cotacao_id,
        dados_novos: {
          contrato_id: contratoId,
          status_contratacao: statusContratacao,
          instalacao_materializada: instalacaoMaterializada,
          idempotente,
          origem,
        },
      });
    } catch (e) {
      console.warn('[confirmar-adesao-zerada] auditoria falhou (não bloqueante):', e);
    }

    return jsonResponse({
      success: true,
      contrato_id: contratoId,
      status_contratacao: statusContratacao,
      instalacao_materializada: instalacaoMaterializada,
      idempotente,
    });
  } catch (e: any) {
    console.error('[confirmar-adesao-zerada] erro inesperado:', e);
    return jsonResponse({
      success: false,
      error: 'erro_interno',
      mensagem: mapErroParaMensagem('erro_interno'),
      detail: e?.message,
    }, 500);
  }
});
