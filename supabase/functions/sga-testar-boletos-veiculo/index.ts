// Edge function de TESTE — NÃO grava em cobrancas, apenas inspeciona.
// Body: { veiculo_id?: string, placa?: string, dias?: number (1..90, default 90) }
// Retorna o JSON cru da Hinova + boletos normalizados para a UI exibir.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getHinovaCreds,
  autenticarHinova,
  buscarVeiculoPorPlaca,
  listarBoletosVeiculoJanela,
  mapStatusBoleto,
  parseDataHinova,
  toNumber,
  HinovaTransientError,
  HinovaNotFoundError,
} from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const cleanCPF = (v?: string | null) => String(v || '').replace(/\D/g, '');

function extractCodigoAssociado(payload: any): number | null {
  const candidates = [
    payload?.codigo_associado, payload?.codigo_associado_pf, payload?.codigo,
    payload?.data?.codigo_associado, payload?.data?.codigo_associado_pf, payload?.data?.codigo,
    payload?.associado?.codigo_associado, payload?.associado?.codigo_associado_pf,
    Array.isArray(payload) ? payload[0]?.codigo_associado : null,
    Array.isArray(payload) ? payload[0]?.codigo_associado_pf : null,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function buscarAssociadoPorCpf(session: any, cpf: string) {
  const cpfLimpo = cleanCPF(cpf);
  if (cpfLimpo.length !== 11) return null;
  const r = await fetch(`${session.apiUrl}/associado/buscar/${cpfLimpo}/cpf`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.tokenUsuario}` },
  });
  const txt = await r.text();
  if (!r.ok) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json().catch(() => ({}));
    const veiculoId: string | undefined = body.veiculo_id;
    const placaInput: string | undefined = body.placa;
    const diasRaw = Number(body.dias ?? 90);
    const dias = Math.min(90, Math.max(1, isFinite(diasRaw) ? diasRaw : 90));

    if (!veiculoId && !placaInput) {
      return json(400, { success: false, error: 'Informe veiculo_id ou placa' });
    }

    // Carrega veículo + associado
    let veiculo: any = null;
    if (veiculoId) {
      const { data, error } = await supabase
        .from('veiculos')
        .select('id, placa, codigo_hinova, associado_id, associados:associados(id, codigo_hinova, cpf, nome)')
        .eq('id', veiculoId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      veiculo = data;
    } else if (placaInput) {
      const placaLimpa = placaInput.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const { data, error } = await supabase
        .from('veiculos')
        .select('id, placa, codigo_hinova, associado_id, associados:associados(id, codigo_hinova, cpf, nome)')
        .ilike('placa', placaLimpa)
        .maybeSingle();
      if (error) throw new Error(error.message);
      veiculo = data;
    }
    if (!veiculo) return json(404, { success: false, error: 'Veículo não encontrado no sistema' });

    const associado: any = Array.isArray(veiculo.associados) ? veiculo.associados[0] : veiculo.associados;
    if (!associado) return json(404, { success: false, error: 'Associado vinculado não encontrado' });

    // Autentica
    const creds = await getHinovaCreds(supabase);
    if (!creds) return json(500, { success: false, error: 'Credenciais Hinova não configuradas' });
    const session = await autenticarHinova(creds);
    if (!session) return json(500, { success: false, error: 'Falha ao autenticar Hinova' });

    let codigoVeiculo = Number(veiculo.codigo_hinova) || null;
    let codigoAssociado = Number(associado.codigo_hinova) || null;
    const reconciliacao: any = { por_placa: null, por_cpf: null };

    // Reconcilia por placa, se necessário
    if (!codigoVeiculo && veiculo.placa) {
      try {
        const { found } = await buscarVeiculoPorPlaca(session, veiculo.placa);
        const cv = Number(found?.codigo_veiculo) || null;
        const ca = extractCodigoAssociado(found);
        reconciliacao.por_placa = { codigo_veiculo: cv, codigo_associado: ca };
        if (cv) codigoVeiculo = cv;
        if (ca && !codigoAssociado) codigoAssociado = ca;
      } catch (e) {
        if (e instanceof HinovaTransientError) throw e;
        if (e instanceof HinovaNotFoundError) reconciliacao.por_placa = { not_found: true };
      }
    }

    // Reconcilia por CPF se ainda faltar associado
    if (!codigoAssociado && associado.cpf) {
      const ap = await buscarAssociadoPorCpf(session, associado.cpf);
      const ca = extractCodigoAssociado(ap);
      reconciliacao.por_cpf = { codigo_associado: ca };
      if (ca) codigoAssociado = ca;
    }

    if (!codigoVeiculo || !codigoAssociado) {
      return json(200, {
        success: false,
        error: 'Códigos Hinova ausentes após reconciliação',
        codigo_veiculo: codigoVeiculo,
        codigo_associado: codigoAssociado,
        reconciliacao,
      });
    }

    const dataFinal = new Date();
    const dataInicial = new Date(dataFinal);
    dataInicial.setDate(dataInicial.getDate() - (dias - 1));

    const t0 = Date.now();
    const { boletos, raw, request_payload, http_status } = await listarBoletosVeiculoJanela(
      session,
      codigoAssociado,
      codigoVeiculo,
      { dataInicial, dataFinal, linkBoleto: true },
    );
    const duracao = Date.now() - t0;

    const boletosNormalizados = boletos.map((b: any) => ({
      nosso_numero: String(b.nosso_numero ?? b.nossoNumero ?? ''),
      tipo_boleto: b.tipo_boleto ?? null,
      situacao_boleto: b.situacao_boleto ?? null,
      status_interno: mapStatusBoleto(b.situacao_boleto),
      valor_boleto: toNumber(b.valor_boleto),
      valor_final: toNumber(b.valor_boleto_multa_mora ?? b.valor_boleto),
      multa: toNumber(b.valor_multa),
      mora: toNumber(b.valor_mora),
      data_emissao: parseDataHinova(b.data_emissao),
      data_vencimento: parseDataHinova(b.data_vencimento),
      data_vencimento_original: parseDataHinova(b.data_vencimento_original),
      data_pagamento: parseDataHinova(b.data_pagamento),
      linha_digitavel: b.linha_digitavel ?? null,
      link_boleto: b.link_boleto ?? b.url_boleto ?? b.boleto_url ?? null,
      pix: b.pix ?? null,
    }));

    // Log de auditoria (não falha se der erro)
    await supabase.from('sga_sync_logs').insert({
      veiculo_id: veiculo.id,
      associado_id: associado.id,
      action: 'teste_listar_boletos',
      status: boletos.length > 0 ? 'success' : 'info',
      duracao_ms: duracao,
      request_payload,
      response_payload: { http_status, quantidade: boletos.length },
    }).then(() => {}, () => {});

    return json(200, {
      success: true,
      veiculo: {
        id: veiculo.id,
        placa: veiculo.placa,
        codigo_hinova_armazenado: veiculo.codigo_hinova,
      },
      associado: {
        id: associado.id,
        nome: associado.nome,
        codigo_hinova_armazenado: associado.codigo_hinova,
      },
      codigo_veiculo_utilizado: codigoVeiculo,
      codigo_associado_utilizado: codigoAssociado,
      reconciliacao,
      janela: {
        dias,
        data_inicial: request_payload.data_vencimento_inicial,
        data_final: request_payload.data_vencimento_final,
      },
      hinova_http_status: http_status,
      duracao_ms: duracao,
      request_payload,
      raw_response: raw,
      quantidade: boletos.length,
      boletos_normalizados: boletosNormalizados,
    });
  } catch (err: any) {
    if (err instanceof HinovaTransientError) {
      return json(200, {
        success: false,
        retry: true,
        reason: err.reason,
        http_status: err.httpStatus,
        body_sample: err.bodySample,
        error: err.message,
      });
    }
    if (err instanceof HinovaNotFoundError) {
      return json(200, { success: false, not_found: true, error: err.message });
    }
    console.error('[sga-testar-boletos-veiculo]', err);
    return json(200, { success: false, error: String(err?.message || err) });
  }
});
