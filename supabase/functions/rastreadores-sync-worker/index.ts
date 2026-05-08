// Edge function: rastreadores-sync-worker
// Actions:
//   - enqueue:      cria/atualiza item na fila (operacao: 'vincular' | 'desvincular')
//   - reprocess:    reexecuta um item da fila chamando edge da plataforma correta
//   - discard:      marca item como falha_permanente
//   - health_check: testa conexão com a plataforma e grava em rastreadores_sync_health_checks

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PLATAFORMAS_VALIDAS = ['softruck', 'rede_veiculos'] as const;

function svc() {
  return createClient(SUPABASE_URL, SERVICE_ROLE);
}

async function callEdge(name: string, body: unknown) {
  const t0 = Date.now();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, body: json, ms: Date.now() - t0 };
}

async function reprocessItem(id: string) {
  const supabase = svc();
  const { data: item, error } = await supabase
    .from('rastreadores_sync_queue')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !item) throw new Error('Item da fila não encontrado');

  await supabase
    .from('rastreadores_sync_queue')
    .update({
      status: 'processando',
      ultima_tentativa_em: new Date().toISOString(),
      tentativas: (item.tentativas ?? 0) + 1,
    })
    .eq('id', id);

  const { data: rast } = await supabase
    .from('rastreadores')
    .select('id, imei, plataforma, veiculo_id, associado_id, plataforma_device_id, plataforma_user_id, plataforma_veiculo_id')
    .eq('id', item.rastreador_id)
    .maybeSingle();

  if (!rast) {
    await supabase.from('rastreadores_sync_queue').update({
      status: 'falha_permanente',
      erro_ultimo: 'Rastreador não existe mais',
    }).eq('id', id);
    return { ok: false, error: 'Rastreador não existe mais' };
  }

  const operacao = item.operacao || 'vincular';
  const veiculoId = rast.veiculo_id ?? item.veiculo_id;
  const associadoId = rast.associado_id ?? item.associado_id;

  let result;

  if (operacao === 'desvincular') {
    if (item.plataforma === 'softruck') {
      result = await callEdge('softruck-api', {
        operation: 'deactivate_device',
        deviceId: rast.plataforma_device_id || rast.imei,
      });
    } else if (item.plataforma === 'rede_veiculos') {
      result = await callEdge('rede-veiculos-desvincular-cliente', {
        rastreadorId: rast.id,
        motivo: 'fila_desvinculo_manual',
        atualizarBancoLocal: false,
      });
    } else {
      throw new Error(`Plataforma desconhecida: ${item.plataforma}`);
    }
  } else {
    // vincular / ativar_completo (legado)
    const { data: assoc } = await supabase
      .from('associados')
      .select('email')
      .eq('id', associadoId)
      .maybeSingle();

    if (item.plataforma === 'softruck') {
      result = await callEdge('softruck-ativar-dispositivo', {
        imei: rast.imei,
        veiculoId,
        associadoId,
        associadoEmail: assoc?.email,
      });
    } else if (item.plataforma === 'rede_veiculos') {
      // Vincula APENAS este rastreador (não o associado inteiro)
      result = await callEdge('rede-veiculos-vincular-cliente', {
        imei: rast.imei,
        veiculoId,
        associadoId,
      });
    } else {
      throw new Error(`Plataforma desconhecida: ${item.plataforma}`);
    }
  }

  const novoStatus = result.ok
    ? 'concluido'
    : (item.tentativas + 1 >= (item.max_tentativas ?? 5) ? 'falha_permanente' : 'falha');

  await supabase
    .from('rastreadores_sync_queue')
    .update({
      status: novoStatus,
      response_ultimo: result.body,
      erro_ultimo: result.ok ? null : (result.body?.error || `HTTP ${result.status}`),
      concluido_em: result.ok ? new Date().toISOString() : null,
      proximo_reenvio_em: result.ok ? null : new Date(Date.now() + 5 * 60_000).toISOString(),
    })
    .eq('id', id);

  return { ok: result.ok, status: result.status, body: result.body };
}

async function enqueueItem(rastreador_id: string, plataforma?: string, operacao: string = 'vincular') {
  const supabase = svc();
  const { data: rast, error } = await supabase
    .from('rastreadores')
    .select('id, plataforma, veiculo_id, associado_id, imei')
    .eq('id', rastreador_id)
    .maybeSingle();
  if (error || !rast) throw new Error('Rastreador não encontrado');

  const plat = plataforma || rast.plataforma;
  if (!PLATAFORMAS_VALIDAS.includes(plat as any)) {
    throw new Error(`Plataforma inválida: ${plat}`);
  }

  // Idempotente: se já existe item ativo para este rastreador+operação, atualiza
  const { data: existente } = await supabase
    .from('rastreadores_sync_queue')
    .select('id')
    .eq('rastreador_id', rastreador_id)
    .eq('operacao', operacao)
    .in('status', ['pendente', 'falha', 'processando'])
    .maybeSingle();

  if (existente) {
    await supabase
      .from('rastreadores_sync_queue')
      .update({
        status: 'pendente',
        proximo_reenvio_em: new Date().toISOString(),
        erro_ultimo: null,
      })
      .eq('id', existente.id);
    return { id: existente.id, reused: true };
  }

  const { data: novo, error: errIns } = await supabase
    .from('rastreadores_sync_queue')
    .insert({
      rastreador_id,
      veiculo_id: rast.veiculo_id,
      associado_id: rast.associado_id,
      plataforma: plat,
      operacao,
      status: 'pendente',
      payload: { imei: rast.imei },
    })
    .select('id')
    .single();
  if (errIns) throw errIns;
  return { id: novo.id, reused: false };
}

async function healthCheck(plataforma: string) {
  const supabase = svc();
  const t0 = Date.now();
  let ok = false;
  let err: string | null = null;

  try {
    if (plataforma === 'softruck') {
      const r = await callEdge('softruck-api', { operation: 'listar-roles' });
      ok = r.ok;
      if (!ok) err = r.body?.error || `HTTP ${r.status}`;
    } else if (plataforma === 'rede_veiculos') {
      // Sondagem leve: tenta autenticar via edge de busca de dispositivo (sem ID, falha previsível mas valida credenciais)
      const r = await callEdge('rede-veiculos-buscar-dispositivo', { ping: true });
      // Considera OK se respondeu (mesmo com 400/404 controlado), KO só em 5xx ou crash
      ok = r.status < 500;
      if (!ok) err = r.body?.error || `HTTP ${r.status}`;
    } else {
      err = 'Plataforma inválida';
    }
  } catch (e: any) {
    err = e?.message || String(e);
  }

  const ms = Date.now() - t0;

  const { count: pendentes } = await supabase
    .from('rastreadores_sync_queue')
    .select('id', { count: 'exact', head: true })
    .eq('plataforma', plataforma)
    .eq('status', 'pendente');
  const { count: falhas } = await supabase
    .from('rastreadores_sync_queue')
    .select('id', { count: 'exact', head: true })
    .eq('plataforma', plataforma)
    .in('status', ['falha', 'falha_permanente']);
  const { count: naoVinc } = await supabase
    .from('rastreadores_pendentes_vinculo')
    .select('rastreador_id', { count: 'exact', head: true })
    .eq('plataforma', plataforma);

  await supabase.from('rastreadores_sync_health_checks').insert({
    plataforma,
    conexao_ok: ok,
    tempo_resposta_ms: ms,
    fila_pendentes: pendentes ?? 0,
    fila_falhas: falhas ?? 0,
    rastreadores_nao_vinculados: naoVinc ?? 0,
    erro_mensagem: err,
  });

  return { ok, tempo_ms: ms, error: err };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = body?.action as string;
    let result: any;
    switch (action) {
      case 'reprocess':
        result = await reprocessItem(body.id);
        break;
      case 'enqueue':
        result = await enqueueItem(body.rastreador_id, body.plataforma, body.operacao);
        break;
      case 'discard': {
        const supabase = svc();
        await supabase.from('rastreadores_sync_queue')
          .update({ status: 'falha_permanente' })
          .eq('id', body.id);
        result = { ok: true };
        break;
      }
      case 'health_check':
        result = await healthCheck(body.plataforma);
        break;
      default:
        return new Response(JSON.stringify({ error: 'action inválido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
