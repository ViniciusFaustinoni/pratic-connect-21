/**
 * rede-veiculos-buscar-dispositivo
 *
 * Lookup ON-DEMAND na API Rede Veículos por placa OU IMEI.
 * Equivalente ao softruck-buscar-dispositivo, faz upsert em `rastreadores`
 * quando encontra o dispositivo na plataforma.
 *
 * A API Rede Veículos não expõe um endpoint padronizado de "search". Tentamos,
 * em ordem, alguns endpoints prováveis (POST multipart/form-data com `json`
 * contendo o filtro). Qualquer erro de rede/HTTP é tratado como "not found".
 *
 * Body: { busca: string }
 * Resposta: { success, found, rastreador_id?, imei?, placa?, message }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const buscaRaw = String(body?.busca ?? '').trim().toUpperCase();
    if (!buscaRaw) return json({ success: false, error: 'Parâmetro "busca" obrigatório' }, 400);

    const isImei = /^\d{10,}$/.test(buscaRaw);
    const placa = !isImei ? buscaRaw.replace(/[^A-Z0-9]/g, '') : null;

    // Config plataforma + auth
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ plataforma: 'rede_veiculos' }),
    });
    const authJson = await authResp.json();
    if (!authJson?.success || !authJson?.token) {
      return json({
        success: false,
        error: `Falha ao autenticar na Rede Veículos: ${authJson?.error || 'sem token'}`,
      }, 502);
    }
    const token = authJson.token as string;

    // Tentar endpoints de busca conhecidos. Seguimos o padrão da API:
    // POST multipart/form-data com campo `json` contendo o filtro.
    // Ordem: consulta por placa → por imei → listar geral.
    const filtro: Record<string, unknown> = {};
    if (placa) filtro.placa = placa;
    if (isImei) filtro.imei = buscaRaw;

    const endpointsParaTentar = [
      '/consultarVeiculo/',
      '/buscarVeiculo/',
      '/listarVeiculos/',
      '/obterVeiculo/',
    ];

    let achado: any = null;
    let endpointUsado: string | null = null;
    let ultimoErro: string | null = null;

    for (const ep of endpointsParaTentar) {
      try {
        const fd = new FormData();
        fd.append('json', JSON.stringify(filtro));
        const r = await fetch(`${baseUrl}${ep}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd,
        });
        const txt = await r.text();
        if (!r.ok) {
          ultimoErro = `${ep} → HTTP ${r.status}: ${txt.slice(0, 200)}`;
          continue;
        }
        let parsed: any = null;
        try { parsed = JSON.parse(txt); } catch { ultimoErro = `${ep} → resposta não-JSON`; continue; }

        // Identificar se a API retornou um veículo
        const candidato = extrairVeiculo(parsed, { placa, imei: isImei ? buscaRaw : null });
        if (candidato) {
          achado = candidato;
          endpointUsado = ep;
          break;
        }
      } catch (e: any) {
        ultimoErro = `${ep} → ${e?.message || e}`;
      }
    }

    // Log da operação
    await supabase.from('rastreadores_api_logs').insert({
      plataforma: 'rede_veiculos',
      operacao: 'buscarDispositivo',
      request: { busca: buscaRaw, isImei, placa },
      response: { found: !!achado, endpointUsado, ultimoErro: achado ? null : ultimoErro },
      status: achado ? 'sucesso' : 'sem_resultado',
    });

    if (!achado) {
      return json({
        success: true,
        found: false,
        message: `Não encontrado na Rede Veículos (${isImei ? 'IMEI' : 'placa'}: ${buscaRaw}).`,
        debug: ultimoErro || undefined,
      });
    }

    const imeiAchado: string | null = achado.imei || (isImei ? buscaRaw : null);
    const placaAchada: string | null = (achado.placa || placa || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
    const idVeiculoExterno: string | null = achado.idVeiculo ? String(achado.idVeiculo) : null;
    const idClienteExterno: string | null = achado.idCliente ? String(achado.idCliente) : null;
    const idEquipamentoExterno: string | null = achado.idEquipamento ? String(achado.idEquipamento) : null;

    // Procurar rastreador local existente (por imei ou plataforma_device_id)
    let existing: any = null;
    if (imeiAchado) {
      const r = await supabase
        .from('rastreadores')
        .select('id, imei, status, veiculo_id, plataforma_device_id, plataforma_veiculo_id')
        .eq('plataforma', 'rede_veiculos')
        .eq('imei', imeiAchado)
        .maybeSingle();
      existing = r.data;
    }
    if (!existing && idEquipamentoExterno) {
      const r = await supabase
        .from('rastreadores')
        .select('id, imei, status, veiculo_id, plataforma_device_id, plataforma_veiculo_id')
        .eq('plataforma', 'rede_veiculos')
        .eq('plataforma_device_id', idEquipamentoExterno)
        .maybeSingle();
      existing = r.data;
    }

    let rastreadorId = existing?.id ?? null;
    let acao: 'criado' | 'atualizado' | 'inalterado' = 'inalterado';

    // Tentar achar veículo local pela placa
    let veiculoLocalId: string | null = null;
    if (placaAchada) {
      const { data: vLocal } = await supabase
        .from('veiculos')
        .select('id')
        .ilike('placa', placaAchada)
        .limit(1)
        .maybeSingle();
      if (vLocal?.id) veiculoLocalId = vLocal.id;
    }

    if (!existing) {
      const insertPayload: Record<string, unknown> = {
        codigo: imeiAchado || `RV-${idEquipamentoExterno || placaAchada}`,
        imei: imeiAchado,
        plataforma: 'rede_veiculos',
        plataforma_device_id: idEquipamentoExterno,
        plataforma_veiculo_id: idVeiculoExterno,
        status: veiculoLocalId ? 'instalado' : 'estoque',
      };
      if (veiculoLocalId) insertPayload.veiculo_id = veiculoLocalId;

      const { data: novo, error: insErr } = await supabase
        .from('rastreadores')
        .insert(insertPayload as any)
        .select('id')
        .single();
      if (insErr) return json({ success: false, error: `Falha ao criar registro local: ${insErr.message}` }, 500);
      rastreadorId = novo.id;
      acao = 'criado';
    } else {
      const patch: Record<string, unknown> = {};
      if (idEquipamentoExterno && existing.plataforma_device_id !== idEquipamentoExterno) {
        patch.plataforma_device_id = idEquipamentoExterno;
      }
      if (idVeiculoExterno && existing.plataforma_veiculo_id !== idVeiculoExterno) {
        patch.plataforma_veiculo_id = idVeiculoExterno;
      }
      if (imeiAchado && existing.imei !== imeiAchado) patch.imei = imeiAchado;
      if (!existing.veiculo_id && veiculoLocalId) {
        patch.veiculo_id = veiculoLocalId;
        if (existing.status === 'estoque') patch.status = 'instalado';
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from('rastreadores').update(patch).eq('id', existing.id);
        acao = 'atualizado';
      }
    }

    // Atualizar rede_veiculos_*_id no veículo local quando aplicável
    if (veiculoLocalId && (idVeiculoExterno || idClienteExterno)) {
      const upd: Record<string, unknown> = {};
      if (idVeiculoExterno) upd.rede_veiculos_veiculo_id = idVeiculoExterno;
      if (idClienteExterno) upd.rede_veiculos_cliente_id = idClienteExterno;
      if (Object.keys(upd).length) {
        await supabase.from('veiculos').update(upd).eq('id', veiculoLocalId);
      }
    }

    return json({
      success: true,
      found: true,
      acao,
      rastreador_id: rastreadorId,
      imei: imeiAchado,
      placa: placaAchada,
      vehicle_id: idVeiculoExterno,
      device_id: idEquipamentoExterno,
      message: acao === 'criado'
        ? 'Dispositivo encontrado na Rede Veículos e cadastrado localmente.'
        : acao === 'atualizado'
          ? 'Dispositivo já existia localmente — IDs Rede Veículos atualizados.'
          : 'Dispositivo já estava sincronizado localmente.',
    });
  } catch (err: any) {
    console.error('[rede-veiculos-buscar-dispositivo] erro:', err);
    return json({ success: false, error: err?.message || 'Erro interno' }, 500);
  }
});

/** Tenta normalizar a resposta da API para o formato esperado. */
function extrairVeiculo(payload: any, alvo: { placa: string | null; imei: string | null }): any | null {
  if (!payload) return null;
  // Erro explícito
  if (payload.error === true || payload.error === 'true') return null;
  if (payload.codigo !== undefined && payload.codigo !== 1 && payload.codigo !== 0) return null;

  // Se for uma lista, encontrar o que bate placa/imei
  const candidatos: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.veiculos)
      ? payload.veiculos
      : Array.isArray(payload?.data)
        ? payload.data
        : (payload?.veiculo ? [payload.veiculo] : (payload?.placa || payload?.imei || payload?.idVeiculo) ? [payload] : []);

  if (!candidatos.length) return null;

  const norm = (s: any) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = candidatos.find((c: any) => {
    if (alvo.placa && norm(c.placa) === alvo.placa) return true;
    if (alvo.imei && String(c.imei || '') === alvo.imei) return true;
    return false;
  }) || candidatos[0];
  return match || null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
