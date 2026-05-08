// Edge function: rastreadores-sync-worker
// Actions:
//   - enqueue:      cria/atualiza item na fila para um rastreador
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

  // Carrega rastreador
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

  // Carrega associado para email
  const { data: assoc } = await supabase
    .from('associados')
    .select('email')
    .eq('id', rast.associado_id)
    .maybeSingle();

  let result;
  if (item.plataforma === 'softruck') {
    result = await callEdge('softruck-ativar-dispositivo', {
      imei: rast.imei,
      veiculoId: rast.veiculo_id,
      associadoId: rast.associado_id,
      associadoEmail: assoc?.email,
    });
  } else if (item.plataforma === 'rede') {
    result = await callEdge('rede-veiculos-ativar-cliente-completo', {
      imei: rast.imei,
      veiculoId: rast.veiculo_id,
      associadoId: rast.associado_id,
      associadoEmail: assoc?.email,
    });
  } else {
    throw new Error(`Plataforma desconhecida: ${item.plataforma}`);
  }

  const novoStatus = result.ok ? 'concluido' : (item.tentativas + 1 >= (item.max_tentativas ?? 5) ? 'falha_permanente' : 'falha');
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

async function enqueueItem(rastreador_id: string, plataforma?: string) {
  const supabase = svc();
  const { data: rast, error } = await supabase
    .from('rastreadores')
    .select('id, plataforma, veiculo_id, associado_id, imei')
    .eq('id', rastreador_id)
    .maybeSingle();
  if (error || !rast) throw new Error('Rastreador não encontrado');

  const plat = plataforma || rast.plataforma;
  if (!['softruck', 'rede'].includes(plat)) {
    throw new Error(`Plataforma inválida: ${plat}`);
  }

  // Idempotente: se já existe pendente/falha para este rastreador, atualiza
  const { data: existente } = await supabase
    .from('rastreadores_sync_queue')
    .select('id')
    .eq('rastreador_id', rastreador_id)
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
      operacao: 'ativar_completo',
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
    const fnName = plataforma === 'softruck' ? 'softruck-api' : 'rede-veiculos-obter-status-cliente';
    const r = await callEdge(fnName, plataforma === 'softruck' ? { operacao: 'listar-roles' } : { ping: true });
    ok = r.ok;
    if (!ok) err = r.body?.error || `HTTP ${r.status}`;
  } catch (e: any) {
    err = e?.message || String(e);
  }
  const ms = Date.now() - t0;

  // contagens
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
        result = await enqueueItem(body.rastreador_id, body.plataforma);
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
