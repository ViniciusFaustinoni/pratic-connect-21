/**
 * rede-veiculos-atualizar-equipamento
 *
 * Atualiza dados do equipamento (rastreador) na Rede Veículos APÓS o vínculo
 * inicial — especificamente o `localInstalacao`. Hoje só conseguíamos enviar
 * `localInstalacao` no momento do `vincularClienteVeiculo`. Esta edge fecha o
 * loop para casos onde o técnico ajusta o local depois.
 *
 * Pré-requisitos:
 *  - `veiculos.rede_veiculos_veiculo_id` populado (gravado no vínculo inicial
 *    ou via `rede-veiculos-buscar-dispositivo`/backfill). Sem isso retorna 409
 *    `sem_id_rede` — operador precisa corrigir manualmente no painel da Rede.
 *
 * Input: { veiculoId: string, localInstalacao: string }
 * Output: { success, sentLocalInstalacao, idVeiculo, idEquipamento? }
 *
 * Endpoint Rede: POST /atualizarDadosEquipamento/  (form-urlencoded com `json`)
 * Payload: { idVeiculo, equipamento: { dados: { localInstalacao } } }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({} as any));
    const veiculoId: string = String(body?.veiculoId || '').trim();
    const localInstalacao: string = String(body?.localInstalacao || '').trim();

    if (!veiculoId || !localInstalacao) {
      return json({ success: false, error: 'veiculoId e localInstalacao são obrigatórios' }, 400);
    }

    // 1. Buscar veículo
    const { data: veiculo, error: vErr } = await supabase
      .from('veiculos')
      .select('id, placa, rede_veiculos_veiculo_id, rede_veiculos_cliente_id')
      .eq('id', veiculoId)
      .single();

    if (vErr || !veiculo) {
      return json({ success: false, error: `Veículo não encontrado: ${vErr?.message || veiculoId}` }, 404);
    }

    if (!veiculo.rede_veiculos_veiculo_id) {
      return json({
        success: false,
        code: 'sem_id_rede',
        message: `Veículo ${veiculo.placa} não possui rede_veiculos_veiculo_id. Tente rodar rede-veiculos-buscar-dispositivo primeiro; se a Rede não devolver o cliente correto, ajuste o local manualmente no painel da Rede.`,
      }, 409);
    }

    // 2. Buscar rastreador instalado (para idEquipamento, opcional)
    const { data: rastreador } = await supabase
      .from('rastreadores')
      .select('id, imei, plataforma_device_id, local_instalacao')
      .eq('veiculo_id', veiculoId)
      .eq('plataforma', 'rede_veiculos')
      .maybeSingle();

    // 3. Config plataforma + auth
    const { data: plataforma, error: pErr } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', 'rede_veiculos')
      .single();
    if (pErr || !plataforma) {
      return json({ success: false, error: 'Plataforma Rede Veículos não configurada.' }, 502);
    }

    const baseUrl = plataforma.ambiente_atual === 'producao'
      ? plataforma.api_url_producao
      : plataforma.api_url_sandbox;

    const authResp = await fetch(`${supabaseUrl}/functions/v1/rastreador-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ plataforma: 'rede_veiculos' }),
    });
    const authJson = await authResp.json();
    if (!authJson?.success || !authJson?.token) {
      return json({ success: false, error: `Falha auth Rede: ${authJson?.error || 'sem token'}` }, 502);
    }
    const token = authJson.token as string;

    // 4. Payload — equipamento.dados.localInstalacao + idVeiculo
    const payload: Record<string, unknown> = {
      idVeiculo: parseInt(veiculo.rede_veiculos_veiculo_id, 10),
      equipamento: {
        dados: {
          localInstalacao,
          ...(rastreador?.imei ? { imei: rastreador.imei } : {}),
        },
      },
    };

    console.log('[rede-atualizar-equipamento] payload:', JSON.stringify(payload));

    const form = new URLSearchParams();
    form.append('json', JSON.stringify(payload));

    const apiResp = await fetch(`${baseUrl}/atualizarDadosEquipamento/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const respText = await apiResp.text();
    console.log('[rede-atualizar-equipamento] HTTP', apiResp.status, respText);

    let apiResult: any = null;
    try { apiResult = JSON.parse(respText); } catch { /* keep raw */ }

    const isError = !apiResp.ok ||
      apiResult?.error === true || apiResult?.error === 'true' ||
      (apiResult?.codigo && apiResult.codigo !== 1);

    await supabase.from('rastreadores_api_logs').insert({
      plataforma: 'rede_veiculos',
      operacao: 'atualizarDadosEquipamento',
      request: payload,
      response: apiResult ?? { raw: respText.slice(0, 500) },
      status: isError ? 'erro' : 'sucesso',
      erro_mensagem: isError ? (apiResult?.message || apiResult?.msg || respText.slice(0, 200)) : null,
    });

    if (isError) {
      return json({
        success: false,
        code: 'rede_recusou',
        message: apiResult?.message || apiResult?.msg || `HTTP ${apiResp.status}`,
        debug: respText.slice(0, 500),
      }, 502);
    }

    // 5. Sincroniza banco local
    if (rastreador?.id && rastreador.local_instalacao !== localInstalacao) {
      await supabase
        .from('rastreadores')
        .update({ local_instalacao: localInstalacao })
        .eq('id', rastreador.id);
    }

    return json({
      success: true,
      idVeiculo: veiculo.rede_veiculos_veiculo_id,
      idEquipamento: rastreador?.plataforma_device_id || null,
      sentLocalInstalacao: localInstalacao,
      message: 'Local de instalação atualizado na Rede Veículos.',
    });
  } catch (err: any) {
    console.error('[rede-atualizar-equipamento] erro:', err);
    return json({ success: false, error: err?.message || 'Erro interno' }, 500);
  }
});
