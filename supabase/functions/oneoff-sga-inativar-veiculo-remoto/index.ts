// deno-lint-ignore-file no-explicit-any
/**
 * ONE-OFF: inativa um veículo no Hinova (situação 2) que está bloqueando
 * o cadastro de um novo associado nosso, e re-enfileira o veículo local
 * para nova tentativa de sincronização.
 *
 * Uso restrito a desbloqueio manual de trocas de titularidade legadas
 * (sem registro local em `solicitacoes_troca_titularidade`).
 *
 * Body: { placa: string, motivo: string }
 * Retorna: { ok, codigo_veiculo_remoto_inativado, codigo_associado_remoto, requeued }
 *
 * Após validação, esta função deve ser deletada.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { insertAuditLog } from '../_shared/auditLog.ts';
import {
  buscarVeiculoPorPlaca,
  alterarSituacaoParaVeiculoHinova,
} from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const placaRaw = String(body?.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const motivo = String(body?.motivo || 'one-off manual').slice(0, 500);
    if (!placaRaw) {
      return new Response(JSON.stringify({ ok: false, error: 'placa obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1) Localiza o veículo local + associado
    const { data: vLocal, error: vErr } = await supabase
      .from('veiculos')
      .select('id, placa, associado_id, status_sga, associados:associado_id (id, nome, codigo_hinova, cpf)')
      .eq('placa', placaRaw)
      .maybeSingle();
    if (vErr || !vLocal) {
      return new Response(JSON.stringify({ ok: false, error: 'veículo local não encontrado', detail: vErr?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const assocLocal: any = vLocal.associados;
    const codAssocLocal = Number(assocLocal?.codigo_hinova || 0);

    // 2) Busca no Hinova
    const r = await buscarVeiculoPorPlaca(supabase, placaRaw).catch(() => null);
    if (!r?.found?.codigo_veiculo) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'veículo não encontrado no Hinova — nada a inativar',
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const codVeicRem = Number(r.found.codigo_veiculo);
    const codAssocRem = Number(r.found.codigo_associado || r.found.codigo_associado_pf || 0);

    if (codAssocRem && codAssocLocal && codAssocRem === codAssocLocal) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'veículo remoto já pertence ao associado local — não há conflito a resolver',
        codigo_associado: codAssocRem,
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3) Inativa veículo remoto (situação 2)
    const rs = await alterarSituacaoParaVeiculoHinova(supabase, codVeicRem, 2);
    if (!rs.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Hinova rejeitou inativação',
        status: rs.status,
        mensagem: rs.mensagem,
        errors: rs.errors,
        raw: rs.raw,
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4) Re-enfileira o veículo local
    const nowIso = new Date().toISOString();
    const { data: existingQ } = await supabase
      .from('sga_sync_queue')
      .select('id')
      .eq('veiculo_id', vLocal.id)
      .maybeSingle();

    let requeued = false;
    if (existingQ?.id) {
      const { error: uErr } = await supabase
        .from('sga_sync_queue')
        .update({
          status: 'pendente',
          tentativas: 0,
          erro_ultimo: null,
          proxima_tentativa_em: nowIso,
        })
        .eq('id', existingQ.id);
      requeued = !uErr;
    } else {
      const { error: iErr } = await supabase
        .from('sga_sync_queue')
        .insert({
          veiculo_id: vLocal.id,
          associado_id: vLocal.associado_id,
          status: 'pendente',
          tentativas: 0,
          proxima_tentativa_em: nowIso,
        });
      requeued = !iErr;
    }

    // 5) Auditoria
    await insertAuditLog(supabase, {
      acao: 'atualizar',
      modulo: 'configuracoes',
      tabela: 'veiculos',
      registro_id: vLocal.id,
      descricao: `[SGA one-off] Veículo remoto cod=${codVeicRem} (assoc=${codAssocRem}) inativado para liberar placa ${placaRaw}. Motivo: ${motivo}`,
      dados_novos: {
        placa: placaRaw,
        codigo_veiculo_remoto: codVeicRem,
        codigo_associado_remoto: codAssocRem,
        associado_local_id: vLocal.associado_id,
        associado_local_nome: assocLocal?.nome,
        codigo_associado_local: codAssocLocal,
        motivo,
        requeued,
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      placa: placaRaw,
      codigo_veiculo_remoto_inativado: codVeicRem,
      codigo_associado_remoto: codAssocRem,
      associado_local: { id: vLocal.associado_id, nome: assocLocal?.nome, codigo_hinova: codAssocLocal },
      requeued,
      hinova_response: rs.raw,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
