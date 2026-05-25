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
    const codVolunRem = extractCodigoVoluntario(r.found);
    log('hinova_busca', {
      codigo_veiculo: codVeicRem,
      codigo_associado_atual: codAssocRem,
      codigo_voluntario_atual: codVolunRem,
    });

    // (1b) Resolver voluntário esperado do novo titular (via troca → contrato → vendedor)
    const codVolunNovo = await resolverVoluntarioNovoTitular(supabase, vLocal.id, vLocal.associado_id);
    log('resolver_voluntario', {
      codigo_voluntario_novo: codVolunNovo,
      resolvido: codVolunNovo > 0,
    });

    // (2) Idempotência: já está com o novo titular E com o voluntário esperado?
    const associadoOk = codAssocRem && codAssocRem === codAssocNovo;
    const voluntarioOk = !codVolunNovo || codVolunRem === codVolunNovo;
    if (associadoOk && voluntarioOk) {
      log('idempotente', { motivo: 'placa já vinculada ao novo titular (e voluntário) no Hinova' });
      await requeue(supabase, vLocal.id, vLocal.associado_id);
      log('requeue', { ok: true });
      return new Response(JSON.stringify({
        ok: true,
        placa: placaRaw,
        idempotente: true,
        codigo_veiculo: codVeicRem,
        codigo_associado: codAssocRem,
        codigo_voluntario: codVolunRem,
        steps,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // (3) Alterar vínculo via /alterar/veiculo
    const enviouVoluntario = codVolunNovo > 0 && codVolunNovo !== codVolunRem;
    const payload: Record<string, unknown> = {
      codigo_veiculo: codVeicRem,
    };
    // Só envia associado se ainda divergir (permite "só voluntário" se associado já estiver ok)
    if (!associadoOk) payload.codigo_associado = codAssocNovo;
    if (enviouVoluntario) payload.codigo_voluntario = codVolunNovo;
    if (enviarAgregados) {
      // TODO pós-validação manual: coletar códigos dos agregados remotos.
      payload.transferir_agregados = [];
    }
    const ra = await alterarVeiculoHinova(supabase, payload);
    log('alterar_veiculo', {
      ok: ra.ok, status: ra.status, mensagem: ra.mensagem, errors: ra.errors,
      enviar_agregados: enviarAgregados,
      codigo_associado_antigo: codAssocRem,
      codigo_associado_novo: codAssocNovo,
      codigo_voluntario_antigo: codVolunRem,
      codigo_voluntario_novo: codVolunNovo,
      enviou_voluntario: enviouVoluntario,
      payload_keys: Object.keys(payload),
    });
    if (!ra.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Hinova rejeitou /alterar/veiculo',
        status: ra.status, mensagem: ra.mensagem, errors: ra.errors, raw: ra.raw, steps,
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // (4) Re-consultar placa com retry/backoff (cache observado no caso Bruna)
    let confirmado = false;
    let confirmacaoPendente = false;
    let ultimoCodAssoc = 0;
    let ultimoCodVolun = 0;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        const recheck = await buscarVeiculoPorPlaca(supabase, placaRaw);
        ultimoCodAssoc = Number(recheck.found?.codigo_associado || recheck.found?.codigo_associado_pf || 0);
        ultimoCodVolun = extractCodigoVoluntario(recheck.found);
        const okAssoc = ultimoCodAssoc === codAssocNovo;
        const okVolun = !enviouVoluntario || ultimoCodVolun === codVolunNovo;
        confirmado = okAssoc && okVolun;
        log('reconsultar_placa', {
          tentativa,
          confirmado,
          codigo_associado_atual: ultimoCodAssoc,
          codigo_voluntario_atual: ultimoCodVolun,
          ok_assoc: okAssoc,
          ok_volun: okVolun,
        });
        if (confirmado) break;
      } catch (e: any) {
        log('reconsultar_placa', { tentativa, confirmado: false, detail: String(e?.message || e) });
      }
      if (tentativa < 3) await sleepJitter(2000, 3000);
    }
    if (!confirmado) {
      confirmacaoPendente = true;
      log('confirmacao_pendente_pos_alteracao', {
        motivo: 'Hinova aceitou /alterar/veiculo mas índice ainda não propagou (cache observado no caso Bruna)',
        ultimo_codigo_associado: ultimoCodAssoc,
        ultimo_codigo_voluntario: ultimoCodVolun,
      });
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
      descricao: `[SGA one-off] Troca de titularidade Hinova via /alterar/veiculo: placa ${placaRaw}, cod_veiculo=${codVeicRem}, assoc ${codAssocRem} → ${codAssocNovo}${enviouVoluntario ? `, voluntario ${codVolunRem} → ${codVolunNovo}` : ''}. Motivo: ${motivo}`,
      dados_novos: {
        placa: placaRaw,
        codigo_veiculo: codVeicRem,
        codigo_associado_antigo: codAssocRem,
        codigo_associado_novo: codAssocNovo,
        codigo_voluntario_antigo: codVolunRem,
        codigo_voluntario_novo: codVolunNovo,
        enviou_voluntario: enviouVoluntario,
        associado_local_id: vLocal.associado_id,
        associado_local_nome: assocLocal?.nome,
        enviar_agregados: enviarAgregados,
        confirmado,
        confirmacao_pendente: confirmacaoPendente,
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
      codigo_voluntario_antigo: codVolunRem,
      codigo_voluntario_novo: codVolunNovo,
      enviou_voluntario: enviouVoluntario,
      confirmado,
      confirmacao_pendente: confirmacaoPendente,
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

/**
 * Resolve o `codigo_sga_voluntario` esperado do NOVO titular para uma troca
 * efetivada local. Caminho: veículo → troca efetivada vinculada (por placa/chassi
 * ou veiculo_id) → cotacao_id → contrato do novo associado → vendedor →
 * profiles.codigo_sga_voluntario. Fallback: contrato ativo mais recente do
 * novo associado. Retorna 0 quando não conseguir resolver (não-bloqueante).
 */
async function resolverVoluntarioNovoTitular(
  supabase: any,
  veiculoLocalId: string,
  associadoLocalId: string | null,
): Promise<number> {
  try {
    // Localiza a troca efetivada mais recente para este veículo
    const { data: troca } = await supabase
      .from('solicitacoes_troca_titularidade')
      .select('id, cotacao_id, novo_associado_id')
      .eq('veiculo_id', veiculoLocalId)
      .eq('status', 'efetivada')
      .order('efetivada_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    const novoAssocId = troca?.novo_associado_id || associadoLocalId;
    if (!novoAssocId) return 0;

    // 1) Contrato gerado pela cotação da troca
    if (troca?.cotacao_id) {
      const { data: c } = await supabase
        .from('contratos')
        .select('vendedor_id')
        .eq('cotacao_id', troca.cotacao_id)
        .eq('associado_id', novoAssocId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (c?.vendedor_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('codigo_sga_voluntario')
          .eq('id', c.vendedor_id)
          .maybeSingle();
        const v = Number.parseInt(String(prof?.codigo_sga_voluntario ?? ''), 10);
        if (Number.isFinite(v) && v > 0) return v;
      }
    }

    // 2) Fallback: contrato ativo mais recente do novo associado
    const { data: c2 } = await supabase
      .from('contratos')
      .select('vendedor_id')
      .eq('associado_id', novoAssocId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (c2?.vendedor_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('codigo_sga_voluntario')
        .eq('id', c2.vendedor_id)
        .maybeSingle();
      const v = Number.parseInt(String(prof?.codigo_sga_voluntario ?? ''), 10);
      if (Number.isFinite(v) && v > 0) return v;
    }
  } catch (e) {
    console.warn('[resolverVoluntarioNovoTitular] erro:', (e as any)?.message || e);
  }
  return 0;
}
