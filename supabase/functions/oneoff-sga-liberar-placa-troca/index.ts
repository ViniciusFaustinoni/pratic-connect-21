// deno-lint-ignore-file no-explicit-any
/**
 * ONE-OFF: libera uma placa presa no Hinova para que o novo titular consiga
 * ser cadastrado. Faz exatamente o mesmo que o guard `tentarAutoInativarVeiculoRemoto`
 * do sga-hinova-sync, mas SEM exigir `solicitacoes_troca_titularidade.efetivada`
 * local — só usar para trocas legadas/externas confirmadas manualmente.
 *
 * Passos:
 *   1. Busca a placa no Hinova → obtém codigo_veiculo + codigo_associado antigo.
 *   2. Inativa o veículo remoto (situação 2).
 *   3. Inativa o associado antigo no Hinova (situação 2) — sempre, já que
 *      o caso de uso pressupõe que o antigo titular não tem mais nada conosco.
 *   4. Re-consulta a placa para confirmar liberação.
 *   5. Reseta sga_sync_queue do veículo local para retentativa imediata.
 *   6. Audita.
 *
 * Body: { placa: string, motivo: string }
 *
 * Deletar depois da validação.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { insertAuditLog } from '../_shared/auditLog.ts';
import {
  buscarVeiculoPorPlaca,
  alterarSituacaoParaVeiculoHinova,
  alterarSituacaoAssociadoHinova,
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

  const steps: any[] = [];
  const log = (step: string, data: any) => { steps.push({ step, ...data }); };

  try {
    const body = await req.json().catch(() => ({}));
    const placaRaw = String(body?.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const motivo = String(body?.motivo || 'one-off manual liberar placa troca').slice(0, 500);
    if (!placaRaw) {
      return new Response(JSON.stringify({ ok: false, error: 'placa obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // (0) Veículo local + associado novo
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
    log('veiculo_local', { id: vLocal.id, associado: assocLocal?.nome, codigo_hinova_novo: codAssocLocal });

    // (1) Buscar no Hinova
    const r = await buscarVeiculoPorPlaca(supabase, placaRaw).catch((e) => { log('hinova_busca_erro', { error: String(e?.message || e) }); return null; });
    if (!r?.found?.codigo_veiculo) {
      log('hinova_busca', { motivo: 'placa já não está no Hinova — nada a inativar' });
      // mesmo assim re-enfileira
      await requeue(supabase, vLocal.id, vLocal.associado_id);
      log('requeue', { ok: true });
      return new Response(JSON.stringify({ ok: true, placa: placaRaw, skipped: true, steps }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const codVeicRem = Number(r.found.codigo_veiculo);
    const codAssocRem = Number(r.found.codigo_associado || r.found.codigo_associado_pf || 0);
    log('hinova_busca', { codigo_veiculo: codVeicRem, codigo_associado_antigo: codAssocRem });

    if (codAssocRem && codAssocLocal && codAssocRem === codAssocLocal) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'veículo remoto já pertence ao associado local — não há conflito',
        codigo_associado: codAssocRem,
        steps,
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // (2) Inativar veículo remoto
    const rv = await alterarSituacaoParaVeiculoHinova(supabase, codVeicRem, 2);
    log('inativar_veiculo_remoto', { ok: rv.ok, mensagem: rv.mensagem, errors: rv.errors });
    if (!rv.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Hinova rejeitou inativação do veículo', steps }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // (3) Inativar associado antigo
    let inativouAssoc = false;
    if (codAssocRem) {
      const ra = await alterarSituacaoAssociadoHinova(supabase, codAssocRem, 2);
      inativouAssoc = ra.ok;
      log('inativar_associado_remoto', { ok: ra.ok, mensagem: ra.mensagem, errors: ra.errors });
    }

    // (4) Re-consultar placa
    let liberada = false;
    try {
      const recheck = await buscarVeiculoPorPlaca(supabase, placaRaw);
      const stillCodAssoc = Number(recheck.found?.codigo_associado || recheck.found?.codigo_associado_pf || 0);
      liberada = !stillCodAssoc || stillCodAssoc !== codAssocRem;
      log('reconsultar_placa', { liberada, codigo_associado_atual: stillCodAssoc });
    } catch (e: any) {
      // NotFound = liberada
      liberada = true;
      log('reconsultar_placa', { liberada: true, motivo: 'placa não encontrada (liberada)', detail: String(e?.message || e) });
    }

    // (5) Re-enfileira
    await requeue(supabase, vLocal.id, vLocal.associado_id);
    log('requeue', { ok: true });

    // (6) Auditoria
    await insertAuditLog(supabase, {
      acao: 'atualizar',
      modulo: 'configuracoes',
      tabela: 'veiculos',
      registro_id: vLocal.id,
      descricao: `[SGA one-off] Liberação placa ${placaRaw}: veículo remoto cod=${codVeicRem} inativado${inativouAssoc ? ` e associado antigo cod=${codAssocRem} inativado` : ''}. Motivo: ${motivo}`,
      dados_novos: {
        placa: placaRaw,
        codigo_veiculo_remoto: codVeicRem,
        codigo_associado_remoto: codAssocRem,
        inativou_associado: inativouAssoc,
        placa_liberada: liberada,
        associado_local_id: vLocal.associado_id,
        associado_local_nome: assocLocal?.nome,
        codigo_associado_local: codAssocLocal,
        motivo,
        steps,
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      placa: placaRaw,
      codigo_veiculo_remoto_inativado: codVeicRem,
      codigo_associado_remoto: codAssocRem,
      inativou_associado_remoto: inativouAssoc,
      placa_liberada: liberada,
      associado_local: { id: vLocal.associado_id, nome: assocLocal?.nome, codigo_hinova: codAssocLocal },
      steps,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e), steps }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function requeue(supabase: any, veiculoId: string, associadoId: string | null) {
  const nowIso = new Date().toISOString();
  const { data: existingQ } = await supabase
    .from('sga_sync_queue')
    .select('id')
    .eq('veiculo_id', veiculoId)
    .maybeSingle();
  if (existingQ?.id) {
    await supabase.from('sga_sync_queue').update({
      status: 'pendente',
      tentativas: 0,
      erro_ultimo: null,
      proxima_tentativa_em: nowIso,
    }).eq('id', existingQ.id);
  } else {
    await supabase.from('sga_sync_queue').insert({
      veiculo_id: veiculoId,
      associado_id: associadoId,
      status: 'pendente',
      tentativas: 0,
      proxima_tentativa_em: nowIso,
    });
  }
}
