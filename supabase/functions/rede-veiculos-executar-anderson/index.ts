/**
 * rede-veiculos-executar-anderson
 *
 * Sequência canônica one-shot pro caso ANDERSON / KPJ4994 / IMEI 354522186314659.
 * Diagnóstico (rede-veiculos-diagnostico-anderson) confirmou que o IMEI está
 * vinculado ao Gabriel (CPF 15582970738) na PRATICCAR/Rede. Anderson (CPF
 * 00337172730) não existe como cliente — `vincularClienteVeiculo` cria o cliente
 * se o IMEI estiver livre, então a sequência é:
 *
 *   1. desvincularClienteVeiculo(cpf=GABRIEL, imei, placa) — libera IMEI na Rede
 *   2. vincularClienteVeiculo(cliente=Anderson + veículo local + IMEI)
 *      → cria Anderson como cliente e devolve idCliente / idVeiculo / idEquipamento
 *   3. /obterDadosVeiculo/ com IMEI + CPF Anderson — re-confirma posse
 *   4. UPDATE rastreadores SET plataforma_*_id no rastreador local
 *
 * Tudo com payloads explícitos (CPF override). Não usa edges existentes pra
 * evitar inferência de CPF a partir do DB local.
 *
 * Body opcional: { dry_run?: boolean } — se true, só monta payloads e devolve sem chamar Rede.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const IMEI_ALVO = '354522186314659';
const CPF_ANDERSON = '00337172730';
const CPF_GABRIEL = '15582970738';
const PLACA = 'KPJ4994';
const CHASSI = '93YHSR6P5DJ617772';
const RASTREADOR_ID = '2732f76d-d1fc-4662-a406-7531b67cd9ce';

const sn = (v: unknown): 'S' | 'N' => (v === true || v === 'S' || v === 's' ? 'S' : 'N');
const onlyDigits = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

async function callRedeJsonForm(baseUrl: string, token: string, path: string, payload: Record<string, unknown>) {
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

// /desvincularClienteVeiculo usa multipart/form-data (campos planos), igual ao edge canônico.
async function callRedeFormFlat(baseUrl: string, token: string, path: string, fields: Record<string, string>) {
  const url = `${baseUrl}${path}`;
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const raw = await r.text();
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch {}
  return { url, http_status: r.status, payload_enviado: fields, raw, parsed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const dryRun = body?.dry_run === true;

  const out: any = { imei_alvo: IMEI_ALVO, dry_run: dryRun, etapas: {} };

  try {
    // Plataforma + token
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

    // Buscar Anderson + veículo local pra montar payload de vincular
    const { data: rast } = await supabase.from('rastreadores').select('*').eq('id', RASTREADOR_ID).single();
    const { data: veic } = await supabase.from('veiculos').select('*').eq('id', rast.veiculo_id).single();
    const { data: assoc } = await supabase.from('associados').select('*').eq('id', veic.associado_id).single();

    out.snapshot_local = {
      rastreador: { id: rast.id, codigo: rast.codigo, imei: rast.imei, plataforma_device_id: rast.plataforma_device_id, plataforma_veiculo_id: rast.plataforma_veiculo_id, plataforma_user_id: rast.plataforma_user_id },
      veiculo: { id: veic.id, placa: veic.placa, chassi: veic.chassi, marca: veic.marca, modelo: veic.modelo, ano_modelo: veic.ano_modelo, cor: veic.cor },
      associado: { id: assoc.id, nome: assoc.nome, cpf: assoc.cpf, email: assoc.email },
    };

    if (onlyDigits(assoc.cpf) !== CPF_ANDERSON) {
      out.aviso = `CPF do associado local (${assoc.cpf}) difere do Anderson canônico (${CPF_ANDERSON}). ABORTANDO por segurança.`;
      return new Response(JSON.stringify(out, null, 2), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== Etapa 1: desvincular Gabriel =====
    // Opção A: payload MÍNIMO — só imei + cpfCnpjCliente
    const etapa1Payload = {
      imei: IMEI_ALVO,
      cpfCnpjCliente: CPF_GABRIEL,
    };
    if (dryRun) {
      out.etapas.etapa1_desvincular_gabriel = { dry_run: true, payload: etapa1Payload };
    } else {
      // Rede v2 quer json={} urlencoded também aqui (multipart devolve "JSON não informado").
      // Tenta com trailing slash; se 404 cair, tenta sem.
      let r = await callRedeJsonForm(baseUrl, token, '/desvincularClienteVeiculo/', etapa1Payload);
      if (r.http_status === 404) {
        r = await callRedeJsonForm(baseUrl, token, '/desvincularClienteVeiculo', etapa1Payload);
      }
      out.etapas.etapa1_desvincular_gabriel = r;
    }

    // Se desvinculação falhou com algo diferente de "já desvinculado", parar
    const e1 = out.etapas.etapa1_desvincular_gabriel as any;
    const e1Error = !dryRun && (e1?.parsed?.error === true || e1?.parsed?.error === 'true');
    const e1JaDesvinculado = e1Error && /n[aã]o.*(vinculad|cadastrad)/i.test(String(e1?.parsed?.message || ''));
    if (e1Error && !e1JaDesvinculado) {
      out.aviso = 'Etapa 1 (desvincular Gabriel) falhou com erro não-idempotente. Parando antes de vincular Anderson.';
      return new Response(JSON.stringify(out, null, 2), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== Etapa 2: vincular Anderson (payload v2 doc-compliant igual ao edge canônico) =====
    // tipo canônico do veículo
    let tipoCanonico: string | null = null;
    if (veic.marca && veic.modelo) {
      const { data: mm } = await supabase
        .from('marcas_modelos')
        .select('tipo_veiculo')
        .ilike('marca', String(veic.marca).trim())
        .ilike('modelo', String(veic.modelo).trim())
        .maybeSingle();
      tipoCanonico = mm?.tipo_veiculo || null;
    }
    const mapTipo = (t: string | null) => {
      const s = (t || '').toLowerCase();
      if (s === 'moto' || s === 'motocicleta') return 'MOTO';
      if (s === 'caminhao' || s === 'caminhão') return 'CAMINHAO';
      if (s === 'onibus' || s === 'ônibus') return 'ONIBUS';
      return 'CARRO';
    };

    const veiculoDados: Record<string, unknown> = {
      tipo: mapTipo(tipoCanonico),
      marca: veic.marca || 'NI',
      modelo: veic.modelo || 'NI',
      placa: PLACA,
      cor: veic.cor || 'NI',
      ano: String(veic.ano_modelo || 2013),
      ZeroKM: sn(veic.aguardando_placa_definitiva),
    };
    if (veic.chassi) veiculoDados.chassi = veic.chassi;
    if (veic.renavam) veiculoDados.renavam = veic.renavam;
    if (veic.codigo_fipe) veiculoDados.codigoFipe = veic.codigo_fipe;
    if (veic.valor_fipe != null) veiculoDados.valorFipe = String(veic.valor_fipe);

    const enderecoCompleto = [assoc.logradouro, assoc.numero].filter((p: any) => p && String(p).trim()).join(', ').trim();
    const clienteDados: Record<string, unknown> = { cpfCnpj: CPF_ANDERSON, nome: assoc.nome };
    if (assoc.telefone) clienteDados.celular = onlyDigits(assoc.telefone);
    if (assoc.telefone_secundario) clienteDados.telefone = onlyDigits(assoc.telefone_secundario);
    if (assoc.whatsapp) clienteDados.whatsapp = onlyDigits(assoc.whatsapp);
    if (assoc.email) { clienteDados.emailContato = assoc.email; clienteDados.emailAlertas = assoc.email; }
    if (assoc.cep) clienteDados.cep = onlyDigits(assoc.cep);
    if (enderecoCompleto) clienteDados.enderecoCompleto = enderecoCompleto;
    if (assoc.bairro) clienteDados.bairro = assoc.bairro;
    if (assoc.cidade) clienteDados.cidade = assoc.cidade;
    if (assoc.uf) clienteDados.uf = assoc.uf;

    const clientePermissoes = {
      acessoWeb: 'S', alterarDadosNaoAutorizado: 'S', pushNotificationsGeral: 'S',
      pushNotificationsBateria: 'N', alertasPlataformaGeral: 'S', alertasPlataformaBateria: 'N',
      alertasPlataformaExclusao: 'N', acessoHistoricoSomente24h: 'N',
    };
    const equipamentoDados: Record<string, unknown> = {
      imei: IMEI_ALVO, localInstalacao: 'painel', ignicaoVirtual: 'N',
      positivoPosChave: 'N', possuiBloqueio: 'N', bloqueioLiberadoCliente: 'N',
    };
    const vincularPayload = {
      equipamento: { dados: equipamentoDados },
      veiculo: { dados: veiculoDados },
      cliente: { dados: clienteDados, permissoes: clientePermissoes },
    };

    if (dryRun) {
      out.etapas.etapa2_vincular_anderson = { dry_run: true, payload: vincularPayload };
    } else {
      out.etapas.etapa2_vincular_anderson = await callRedeJsonForm(baseUrl, token, '/vincularClienteVeiculo/', vincularPayload);
    }

    const e2 = out.etapas.etapa2_vincular_anderson as any;
    const e2Sucesso = !dryRun && e2?.parsed?.codigo === 1;
    const idCliente = e2?.parsed?.idCliente ?? null;
    const idVeiculo = e2?.parsed?.idVeiculo ?? null;
    const idEquipamento = e2?.parsed?.idEquipamento ?? null;

    if (!dryRun && !e2Sucesso) {
      out.aviso = 'Etapa 2 (vincular Anderson) não retornou codigo:1.';
      return new Response(JSON.stringify(out, null, 2), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== Etapa 3: re-confirmar posse =====
    if (!dryRun) {
      out.etapas.etapa3_reconfirmar = await callRedeJsonForm(baseUrl, token, '/obterDadosVeiculo/', {
        imei: IMEI_ALVO, cpfCnpjCliente: CPF_ANDERSON,
      });
    } else {
      out.etapas.etapa3_reconfirmar = { dry_run: true };
    }

    // ===== Etapa 4: gravar plataforma_*_id no rastreador local =====
    if (!dryRun && (idCliente || idVeiculo || idEquipamento)) {
      const updatePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (idEquipamento != null) updatePatch.plataforma_device_id = String(idEquipamento);
      if (idVeiculo != null) updatePatch.plataforma_veiculo_id = String(idVeiculo);
      if (idCliente != null) updatePatch.plataforma_user_id = String(idCliente);

      // também atualizar veiculo.rede_veiculos_*
      if (idCliente != null || idVeiculo != null) {
        const veicPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (idCliente != null) veicPatch.rede_veiculos_cliente_id = String(idCliente);
        if (idVeiculo != null) veicPatch.rede_veiculos_veiculo_id = String(idVeiculo);
        await supabase.from('veiculos').update(veicPatch).eq('id', veic.id);
      }

      await supabase.rpc('set_audit_origem', { origem: 'edge:rede-veiculos-executar-anderson' }).catch(() => {});
      const { error: updErr } = await supabase.from('rastreadores').update(updatePatch).eq('id', RASTREADOR_ID);
      out.etapas.etapa4_gravar_local = { patch: updatePatch, ok: !updErr, error: updErr?.message || null };
    } else {
      out.etapas.etapa4_gravar_local = { dry_run: dryRun, motivo: 'sem IDs ou dry_run', idCliente, idVeiculo, idEquipamento };
    }

    out.success = true;
    return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    out.success = false;
    out.error = err?.message || String(err);
    return new Response(JSON.stringify(out, null, 2), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
