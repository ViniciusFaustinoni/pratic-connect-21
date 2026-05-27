/**
 * rede-veiculos-ativar-anderson
 *
 * One-shot pro caso ANDERSON / KPJ4994 / IMEI 354522186314659.
 * Sequência:
 *   1. /obterDadosVeiculo/   { placa, cpfCnpjCliente }
 *   2. /obterDadosVeiculo/   { imei,  cpfCnpjCliente }
 *   3. /ativarVeiculo/       { chassi, placa, imei, cpfCnpjCliente }   (doc nova)
 *   4. /obterDadosVeiculo/   { placa, cpfCnpjCliente } (pós-ativar, pra ver mudança)
 *   5. Se obterDadosVeiculo devolveu idCliente/idVeiculo/idEquipamento, persistir
 *      em veiculos.rede_veiculos_* e rastreadores.plataforma_*_id
 *
 * Body opcional: { dry_run?: boolean }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const IMEI = '354522186314659';
const CPF = '00337172730';
const PLACA = 'KPJ4994';
const CHASSI = '93YHSR6P5DJ617772';
const VEICULO_ID = 'd53acb36-0e8c-4683-8537-0651c724d454';
const RASTREADOR_ID = '2732f76d-d1fc-4662-a406-7531b67cd9ce';

async function callRede(baseUrl: string, token: string, path: string, payload: Record<string, unknown>) {
  const url = `${baseUrl}${path}`;
  const params = new URLSearchParams();
  params.append('json', JSON.stringify(payload));
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const raw = await r.text();
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch {}
  return { url, http_status: r.status, payload_enviado: payload, raw, parsed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const dryRun = body?.dry_run === true;

  const out: any = { imei: IMEI, cpf: CPF, placa: PLACA, chassi: CHASSI, dry_run: dryRun, etapas: {} };

  try {
    const { data: plataforma } = await supabase
      .from('rastreadores_config_plataformas').select('*').eq('plataforma', 'rede_veiculos').single();
    const baseUrl = plataforma.ambiente_atual === 'producao' ? plataforma.api_url_producao : plataforma.api_url_sandbox;
    out.baseUrl = baseUrl;

    const authResp = await fetch(`${supabaseUrl}/functions/v1/rastreador-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ plataforma: 'rede_veiculos' }),
    });
    const authJson = await authResp.json();
    if (!authJson?.success || !authJson?.token) {
      return new Response(JSON.stringify({ success: false, error: 'auth_falhou', authJson }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authJson.token as string;

    if (dryRun) {
      out.etapas = {
        a_ativar_cliente:       { dry_run: true, payload: { cpfCnpjCliente: CPF } },
        b_ativar_veiculo:       { dry_run: true, payload: { chassi: CHASSI, placa: PLACA, imei: IMEI, cpfCnpjCliente: CPF } },
        c_informar_adimplente:  { dry_run: true, payload: { chassi: CHASSI, placa: PLACA, imei: IMEI, cpfCnpjCliente: CPF } },
      };
      return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. ativarCliente (doc nova: cpfCnpjCliente)
    out.etapas.a_ativar_cliente = await callRede(baseUrl, token, '/ativarCliente/', {
      cpfCnpjCliente: CPF,
    });

    // 2. ativarVeiculo (doc nova: chassi + placa + imei + cpfCnpjCliente)
    out.etapas.b_ativar_veiculo = await callRede(baseUrl, token, '/ativarVeiculo/', {
      chassi: CHASSI, placa: PLACA, imei: IMEI, cpfCnpjCliente: CPF,
    });

    // 3. informarVeiculoAdimplente (teste extra — doc menciona)
    out.etapas.c_informar_adimplente = await callRede(baseUrl, token, '/informarVeiculoAdimplente/', {
      chassi: CHASSI, placa: PLACA, imei: IMEI, cpfCnpjCliente: CPF,
    });

    // 4. reconfirmar pós-ativar (por placa)
    out.etapas.d_reconfirmar = await callRede(baseUrl, token, '/obterDadosVeiculo/', {
      placa: PLACA, cpfCnpjCliente: CPF,
    });

    // 5. alias por imei
    out.etapas.e_reconfirmar_imei = await callRede(baseUrl, token, '/obterDadosVeiculo/', {
      imei: IMEI, cpfCnpjCliente: CPF,
    });

    // 5. extrair IDs do melhor obter (preferir d, depois a, depois b)
    const candidatos = [out.etapas.d_reconfirmar, out.etapas.e_reconfirmar_imei];
    let idCliente: any = null, idVeiculo: any = null, idEquipamento: any = null;
    for (const c of candidatos) {
      const p = c?.parsed || {};
      idCliente     = idCliente     ?? p.idCliente     ?? p.cliente?.idCliente     ?? p.cliente?.id    ?? null;
      idVeiculo     = idVeiculo     ?? p.idVeiculo     ?? p.veiculo?.idVeiculo     ?? p.veiculo?.id    ?? null;
      idEquipamento = idEquipamento ?? p.idEquipamento ?? p.equipamento?.idEquipamento ?? p.equipamento?.id ?? null;
    }
    out.ids_extraidos = { idCliente, idVeiculo, idEquipamento };

    if (idCliente || idVeiculo || idEquipamento) {
      const veicPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (idCliente != null) veicPatch.rede_veiculos_cliente_id = String(idCliente);
      if (idVeiculo != null) veicPatch.rede_veiculos_veiculo_id = String(idVeiculo);
      const { error: ve } = await supabase.from('veiculos').update(veicPatch).eq('id', VEICULO_ID);

      const rastPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (idEquipamento != null) rastPatch.plataforma_device_id = String(idEquipamento);
      if (idVeiculo != null) rastPatch.plataforma_veiculo_id = String(idVeiculo);
      if (idCliente != null) rastPatch.plataforma_user_id = String(idCliente);
      const { error: re } = await supabase.from('rastreadores').update(rastPatch).eq('id', RASTREADOR_ID);

      out.persistencia = { veicPatch, rastPatch, veiculoErr: ve?.message || null, rastreadorErr: re?.message || null };
    } else {
      out.persistencia = { skip: 'nenhum ID retornado pelos obterDadosVeiculo' };
    }

    out.success = true;
    return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    out.success = false;
    out.error = err?.message || String(err);
    return new Response(JSON.stringify(out, null, 2), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
