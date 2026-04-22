// Worker em batch: para veículos sem codigo_hinova, busca pela placa na Hinova
// e preenche veiculos.codigo_hinova. Processa em lotes pequenos (rate-limit safe).
// Body opcional: { batch_size?: number, delay_ms?: number, veiculo_ids?: string[] }
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getHinovaCreds, autenticarHinova, buscarVeiculoPorPlaca } from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(parseInt(body.batch_size ?? '50'), 1), 200);
    const delayMs = Math.max(parseInt(body.delay_ms ?? '250'), 50);
    const idsFilter: string[] | undefined = Array.isArray(body.veiculo_ids) && body.veiculo_ids.length ? body.veiculo_ids : undefined;

    let q = supabase
      .from('veiculos')
      .select('id, placa, associado_id, associados:associados!inner(origem_cadastro)')
      .is('codigo_hinova', null)
      .not('placa', 'is', null)
      .eq('associados.origem_cadastro', 'api_externa');

    if (idsFilter) q = q.in('id', idsFilter);
    q = q.limit(batchSize);

    const { data: veiculos, error } = await q;
    if (error) throw error;
    if (!veiculos?.length) return json(200, { success: true, processados: 0, mapeados: 0, restantes: 0 });

    const creds = await getHinovaCreds(supabase);
    if (!creds) throw new Error('Credenciais Hinova não configuradas');
    const session = await autenticarHinova(creds);
    if (!session) throw new Error('Falha ao autenticar na Hinova');

    let mapeados = 0;
    let nao_encontrados = 0;
    let erros = 0;
    let idx = 0;

    for (const v of veiculos) {
      try {
        const { found, debug } = await buscarVeiculoPorPlaca(session, v.placa as string);

        if (idx === 0 || idx % 10 === 0) {
          console.log('[SGA Mapear][telem]', JSON.stringify({
            placa: v.placa,
            endpoint: debug.endpoint,
            http_status: debug.status,
            body_sample: debug.bodySample,
            encontrado: !!found?.codigo_veiculo,
          }));
          const { error: logErr } = await supabase.from('sga_sync_logs').insert({
            action: 'buscar_veiculo_placa',
            status: found?.codigo_veiculo ? 'ok' : 'empty',
            veiculo_id: v.id,
            associado_id: v.associado_id,
            request_payload: { placa: v.placa },
            response_payload: {
              endpoint: debug.endpoint,
              http_status: debug.status,
              body_sample: debug.bodySample,
              encontrado: !!found?.codigo_veiculo,
            },
          });
          if (logErr) console.warn('[SGA Mapear] log fail:', logErr.message);
        }

        if (found?.codigo_veiculo) {
          const codAssoc = found.codigo_associado ?? found.codigo_associado_pf ?? null;
          await supabase.from('veiculos').update({ codigo_hinova: Number(found.codigo_veiculo) }).eq('id', v.id);
          if (codAssoc && v.associado_id) {
            await supabase.from('associados').update({ codigo_hinova: Number(codAssoc) }).eq('id', v.associado_id);
          }
          mapeados++;
        } else {
          nao_encontrados++;
          await supabase.from('sga_sync_financeiro_jobs').insert({
            veiculo_id: v.id,
            associado_id: v.associado_id,
            tipo: 'mapear_codigo',
            status: 'sem_historico_hinova',
            ultimo_erro: `Placa não encontrada na Hinova (endpoint=${debug.endpoint}, http=${debug.status})`,
            iniciado_em: new Date().toISOString(),
            concluido_em: new Date().toISOString(),
          });
        }
      } catch (e: any) {
        erros++;
        console.error('[SGA Mapear] erro veículo', v.id, e?.message);
      }
      idx++;
      await sleep(delayMs);
    }

    const { count: restantes } = await supabase
      .from('veiculos')
      .select('id, associados:associados!inner(origem_cadastro)', { count: 'exact', head: true })
      .is('codigo_hinova', null)
      .not('placa', 'is', null)
      .eq('associados.origem_cadastro', 'api_externa');

    return json(200, { success: true, processados: veiculos.length, mapeados, nao_encontrados, erros, restantes: restantes ?? 0 });
  } catch (err: any) {
    console.error('[SGA Mapear] erro:', err);
    return json(200, { success: false, error: String(err?.message || err) });
  }
});
