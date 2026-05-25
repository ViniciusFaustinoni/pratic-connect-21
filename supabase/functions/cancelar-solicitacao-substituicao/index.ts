// Cancela uma solicitação de Substituição de Placa.
// - Marca a solicitação como 'cancelada' (não apaga)
// - Se houver cotação vinculada em fase pré-assinatura, também cancela
// - Bloqueia se a cotação já passou da assinatura/pagamento (substituição "consumada")
// - Registra em logs_auditoria
// - Libera placa/associado para novos processos (status 'cancelada' é ignorado pelo
//   reuso em criar-solicitacao-substituicao)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { insertAuditLog } from '../_shared/auditLog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Estados de cotação onde ainda dá pra cancelar tudo limpinho
const COTACAO_CANCELAVEL = new Set([
  'lead',
  'em_negociacao',
  'aguardando_documentos',
  'aguardando_termo',
  'aguardando_pagamento',
  'aguardando_assinatura',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Resolve usuário a partir do JWT (não bloqueia se anônimo)
    let userId: string | null = null;
    let userName: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data } = await admin.auth.getUser(token);
        userId = data.user?.id ?? null;
        userName = (data.user?.user_metadata as any)?.nome ?? data.user?.email ?? null;
      } catch { /* ignore */ }
    }

    const body = await req.json().catch(() => ({}));
    const solicitacao_id: string | undefined = body?.solicitacao_id;
    const motivo: string = String(body?.motivo ?? '').trim().slice(0, 280);

    if (!solicitacao_id) return json(400, { error: 'solicitacao_id obrigatório' });

    // 1. Carrega solicitação
    const { data: sol, error: solErr } = await admin
      .from('solicitacoes_substituicao_placa')
      .select('id, status, cotacao_id, veiculo_antigo_placa, associado_id')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (solErr) return json(500, { error: solErr.message });
    if (!sol) return json(404, { error: 'Solicitação não encontrada' });

    if (sol.status === 'cancelada') {
      return json(200, { ja_cancelada: true });
    }
    if (sol.status === 'efetivada') {
      return json(409, {
        error: 'Substituição já foi efetivada — utilize o fluxo de cancelamento de contrato.',
        codigo: 'substituicao_efetivada',
      });
    }

    // 2. Se há cotação vinculada, decide o que fazer
    let cotacao_cancelada = false;
    if (sol.cotacao_id) {
      const { data: cot } = await admin
        .from('cotacoes')
        .select('id, status_contratacao, status')
        .eq('id', sol.cotacao_id)
        .maybeSingle();

      if (cot) {
        const statusAtual = String(cot.status_contratacao || cot.status || '').toLowerCase();
        if (statusAtual === 'cancelada') {
          // ok, já cancelada
        } else if (COTACAO_CANCELAVEL.has(statusAtual) || !statusAtual) {
          const { error: updErr } = await admin
            .from('cotacoes')
            .update({
              status_contratacao: 'cancelada',
              status: 'cancelada',
              motivo_cancelamento: 'Substituição de placa cancelada manualmente',
              cancelada_em: new Date().toISOString(),
            } as any)
            .eq('id', sol.cotacao_id);
          if (updErr) {
            // Pode não ter alguma coluna — tenta versão mínima
            await admin
              .from('cotacoes')
              .update({ status_contratacao: 'cancelada' } as any)
              .eq('id', sol.cotacao_id);
          }
          cotacao_cancelada = true;
        } else {
          return json(409, {
            error: `A cotação vinculada já avançou (${statusAtual}). Use o fluxo de cancelamento de contrato.`,
            codigo: 'cotacao_avancada',
            status_atual: statusAtual,
          });
        }
      }
    }

    // 3. Marca solicitação como cancelada
    const { error: updSolErr } = await admin
      .from('solicitacoes_substituicao_placa')
      .update({
        status: 'cancelada',
        cancelada_em: new Date().toISOString(),
        cancelada_por: userId,
        motivo_cancelamento: motivo || null,
      } as any)
      .eq('id', solicitacao_id);
    if (updSolErr) return json(500, { error: 'Erro ao cancelar solicitação: ' + updSolErr.message });

    // 4. Auditoria
    await insertAuditLog(admin, {
      usuario_id: userId,
      usuario_nome: userName ?? 'sistema',
      acao: 'cancelar',
      modulo: 'vendas',
      tabela: 'solicitacoes_substituicao_placa',
      registro_id: solicitacao_id,
      descricao: `Substituição de placa ${sol.veiculo_antigo_placa} cancelada${motivo ? ` — motivo: ${motivo}` : ''}${cotacao_cancelada ? ' (cotação vinculada também cancelada)' : ''}`,
      dados_novos: {
        placa: sol.veiculo_antigo_placa,
        cotacao_id: sol.cotacao_id,
        cotacao_cancelada,
        motivo,
        status_anterior: sol.status,
      },
    });

    return json(200, { ok: true, cotacao_cancelada });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    console.error('[cancelar-solicitacao-substituicao]', e);
    return json(500, { error: msg });
  }
});
