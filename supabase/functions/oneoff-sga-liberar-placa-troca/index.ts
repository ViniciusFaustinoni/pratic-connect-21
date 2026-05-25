// deno-lint-ignore-file no-explicit-any
/**
 * ONE-OFF: executa a TROCA DE TITULARIDADE no Hinova via `POST /alterar/veiculo`
 * para liberar uma placa hoje vinculada a outro associado.
 *
 * Caminho canônico (substitui o antigo "inativar veículo + inativar associado"):
 *   1. Busca a placa no Hinova → obtém codigo_veiculo + codigo_associado antigo.
 *   2. Idempotência: se já estiver vinculada ao novo titular local, NÃO chama
 *      `/alterar/veiculo` — apenas reenfileira a sincronização.
 *   3. Caso contrário, chama `alterarVeiculoHinova({ codigo_veiculo, codigo_associado })`
 *      apontando para o `codigo_hinova` do novo titular local.
 *   4. Re-consulta a placa para confirmar a troca.
 *   5. Reseta `sga_sync_queue` para retentativa imediata.
 *   6. Audita.
 *
 * Body:
 *   { placa: string, motivo?: string, enviar_agregados?: boolean }
 *
 * Validação manual obrigatória ANTES de habilitar `enviar_agregados=true` em
 * produção (ver memória `mem://logic/integrations/sga-alterar-veiculo-troca-titularidade`).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { insertAuditLog } from '../_shared/auditLog.ts';
import {
  buscarVeiculoPorPlaca,
  alterarVeiculoHinova,
  extractCodigoVoluntario,
  sleepJitter,
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
    const enviarAgregados = body?.enviar_agregados === true;
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
    const codAssocNovo = Number(assocLocal?.codigo_hinova || 0);
    log('veiculo_local', { id: vLocal.id, associado: assocLocal?.nome, codigo_hinova_novo: codAssocNovo });

    if (!codAssocNovo) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'associado local não tem codigo_hinova — cadastrar/sincronizar antes',
        associado_local: { id: vLocal.associado_id, nome: assocLocal?.nome },
        steps,
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // (1) Buscar no Hinova
    const r = await buscarVeiculoPorPlaca(supabase, placaRaw).catch((e) => {
      log('hinova_busca_erro', { error: String(e?.message || e) });
      return null;
    });
    if (!r?.found?.codigo_veiculo) {
      log('hinova_busca', { motivo: 'placa não existe no Hinova — nada a alterar' });
      await requeue(supabase, vLocal.id, vLocal.associado_id);
      log('requeue', { ok: true });
      return new Response(JSON.stringify({ ok: true, placa: placaRaw, skipped: true, steps }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const codVeicRem = Number(r.found.codigo_veiculo);
    const codAssocRem = Number(r.found.codigo_associado || r.found.codigo_associado_pf || 0);
    log('hinova_busca', { codigo_veiculo: codVeicRem, codigo_associado_atual: codAssocRem });

    // (2) Idempotência: já está com o novo titular?
    if (codAssocRem && codAssocRem === codAssocNovo) {
      log('idempotente', { motivo: 'placa já vinculada ao novo titular no Hinova' });
      await requeue(supabase, vLocal.id, vLocal.associado_id);
      log('requeue', { ok: true });
      return new Response(JSON.stringify({
        ok: true,
        placa: placaRaw,
        idempotente: true,
        codigo_veiculo: codVeicRem,
        codigo_associado: codAssocRem,
        steps,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // (3) Alterar vínculo via /alterar/veiculo
    const payload: Record<string, unknown> = {
      codigo_veiculo: codVeicRem,
      codigo_associado: codAssocNovo,
    };
    if (enviarAgregados) {
      // TODO pós-validação manual: coletar códigos dos agregados remotos.
      payload.transferir_agregados = [];
    }
    const ra = await alterarVeiculoHinova(supabase, payload);
    log('alterar_veiculo', {
      ok: ra.ok, status: ra.status, mensagem: ra.mensagem, errors: ra.errors,
      enviar_agregados: enviarAgregados,
    });
    if (!ra.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Hinova rejeitou /alterar/veiculo',
        status: ra.status, mensagem: ra.mensagem, errors: ra.errors, raw: ra.raw, steps,
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // (4) Re-consultar placa para confirmar
    let confirmado = false;
    try {
      const recheck = await buscarVeiculoPorPlaca(supabase, placaRaw);
      const codAtual = Number(recheck.found?.codigo_associado || recheck.found?.codigo_associado_pf || 0);
      confirmado = codAtual === codAssocNovo;
      log('reconsultar_placa', { confirmado, codigo_associado_atual: codAtual });
    } catch (e: any) {
      log('reconsultar_placa', { confirmado: false, detail: String(e?.message || e) });
    }

    // (5) Reenfileira
    await requeue(supabase, vLocal.id, vLocal.associado_id);
    log('requeue', { ok: true });

    // (6) Auditoria
    await insertAuditLog(supabase, {
      acao: 'atualizar',
      modulo: 'configuracoes',
      tabela: 'veiculos',
      registro_id: vLocal.id,
      descricao: `[SGA one-off] Troca de titularidade Hinova via /alterar/veiculo: placa ${placaRaw}, cod_veiculo=${codVeicRem}, ${codAssocRem} → ${codAssocNovo}. Motivo: ${motivo}`,
      dados_novos: {
        placa: placaRaw,
        codigo_veiculo: codVeicRem,
        codigo_associado_antigo: codAssocRem,
        codigo_associado_novo: codAssocNovo,
        associado_local_id: vLocal.associado_id,
        associado_local_nome: assocLocal?.nome,
        enviar_agregados: enviarAgregados,
        confirmado,
        motivo,
        steps,
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      placa: placaRaw,
      codigo_veiculo: codVeicRem,
      codigo_associado_antigo: codAssocRem,
      codigo_associado_novo: codAssocNovo,
      confirmado,
      enviar_agregados: enviarAgregados,
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
      proximo_reenvio_em: nowIso,
    }).eq('id', existingQ.id);
  } else {
    await supabase.from('sga_sync_queue').insert({
      veiculo_id: veiculoId,
      associado_id: associadoId,
      status: 'pendente',
      tentativas: 0,
      proximo_reenvio_em: nowIso,
    });
  }
}
