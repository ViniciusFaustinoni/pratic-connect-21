// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAsaasConfig } from "../_shared/asaas-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type FormaPagamento = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
const FORMAS_VALIDAS: FormaPagamento[] = ['PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED'];

const STATUS_ALTERAVEIS = new Set([
  'PENDING',
  'OVERDUE',
  'AWAITING_RISK_ANALYSIS',
  'pendente',
  'em_aberto',
  'aguardando_pagamento',
  'atrasado',
]);

const formaLabel = (f: string) => {
  switch ((f || '').toUpperCase()) {
    case 'PIX': return 'PIX';
    case 'BOLETO': return 'Boleto';
    case 'CREDIT_CARD': return 'Cartão de Crédito';
    case 'UNDEFINED': return 'PIX ou Cartão';
    default: return f || '—';
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Sessão inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authUserId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { cobrancaId, novaForma } = body as { cobrancaId?: string; novaForma?: FormaPagamento };

    if (!cobrancaId || typeof cobrancaId !== 'string') {
      throw new Error('cobrancaId é obrigatório');
    }
    if (!novaForma || !FORMAS_VALIDAS.includes(novaForma)) {
      throw new Error(`novaForma inválida. Use uma de: ${FORMAS_VALIDAS.join(', ')}`);
    }

    // Buscar cobrança no banco
    const { data: cobranca, error: cobErr } = await supabase
      .from('asaas_cobrancas')
      .select('*')
      .eq('id', cobrancaId)
      .maybeSingle();

    if (cobErr || !cobranca) {
      throw new Error('Cobrança não encontrada');
    }

    if (!cobranca.asaas_id) {
      throw new Error('Cobrança não possui ID ASAAS — não é possível alterar.');
    }

    // Validar status
    const statusAtual = String(cobranca.status || '').trim();
    if (!STATUS_ALTERAVEIS.has(statusAtual) && !STATUS_ALTERAVEIS.has(statusAtual.toUpperCase())) {
      throw new Error(`Não é possível alterar a forma de pagamento de uma cobrança com status "${statusAtual}".`);
    }

    const formaAtual: string = cobranca.forma_pagamento || 'UNDEFINED';
    if (formaAtual.toUpperCase() === novaForma.toUpperCase()) {
      throw new Error(`A cobrança já está configurada como ${formaLabel(novaForma)}.`);
    }

    const asaasConfig = await getAsaasConfig(supabase);
    if (!asaasConfig) throw new Error('ASAAS não configurado.');
    const { apiKey: ASAAS_API_KEY, baseUrl: ASAAS_BASE_URL } = asaasConfig;

    async function asaasFetch(endpoint: string, method: string, payload?: any) {
      const res = await fetch(`${ASAAS_BASE_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }

    // Verifica status atual no ASAAS antes
    const statusAsaas = await asaasFetch(`/payments/${cobranca.asaas_id}`, 'GET');
    if (!statusAsaas.ok) {
      throw new Error(`Falha ao consultar cobrança no ASAAS: ${statusAsaas.data?.errors?.[0]?.description || statusAsaas.status}`);
    }
    const asaasStatus = String(statusAsaas.data?.status || '').toUpperCase();
    if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'REFUNDED'].includes(asaasStatus)) {
      throw new Error('Esta cobrança já foi paga. Não é possível alterar a forma de pagamento.');
    }

    // Estratégia 1: tentar atualizar via POST /payments/{id}
    let novaCobrancaAsaas: any = null;
    let novaCobrancaAsaasId: string = cobranca.asaas_id;
    let recriou = false;

    const updatePayload = { billingType: novaForma };
    const updateRes = await asaasFetch(`/payments/${cobranca.asaas_id}`, 'POST', updatePayload);

    if (updateRes.ok) {
      novaCobrancaAsaas = updateRes.data;
      console.log(`[alterar-forma] Atualização in-place OK para ${cobranca.asaas_id}`);
    } else {
      console.warn(`[alterar-forma] Update falhou (${updateRes.status}), tentando recriar:`, updateRes.data);

      // Estratégia 2: cancela + recria
      const cancelRes = await asaasFetch(`/payments/${cobranca.asaas_id}`, 'DELETE');
      if (!cancelRes.ok && cancelRes.status !== 404) {
        throw new Error(`Não foi possível cancelar a cobrança original: ${cancelRes.data?.errors?.[0]?.description || cancelRes.status}`);
      }

      const original = statusAsaas.data;
      const createPayload = {
        customer: original.customer,
        billingType: novaForma,
        value: Number(cobranca.valor) || original.value,
        dueDate: cobranca.data_vencimento || original.dueDate,
        description: original.description,
        externalReference: original.externalReference,
        fine: original.fine,
        interest: original.interest,
        discount: original.discount,
      };
      const createRes = await asaasFetch('/payments', 'POST', createPayload);
      if (!createRes.ok) {
        throw new Error(`Falha ao recriar cobrança no ASAAS: ${createRes.data?.errors?.[0]?.description || createRes.status}`);
      }
      novaCobrancaAsaas = createRes.data;
      novaCobrancaAsaasId = createRes.data.id;
      recriou = true;
      console.log(`[alterar-forma] Recriou cobrança: ${cobranca.asaas_id} -> ${novaCobrancaAsaasId}`);
    }

    // Buscar PIX se aplicável
    let pixData: any = null;
    if (novaForma === 'PIX' || novaForma === 'UNDEFINED') {
      const pixRes = await asaasFetch(`/payments/${novaCobrancaAsaasId}/pixQrCode`, 'GET');
      if (pixRes.ok) pixData = pixRes.data;
    }

    // Atualizar banco — asaas_cobrancas
    const updateDb: any = {
      forma_pagamento: novaForma,
      status: novaCobrancaAsaas.status || cobranca.status,
      boleto_url: novaCobrancaAsaas.bankSlipUrl ?? null,
      boleto_codigo_barras: novaCobrancaAsaas.barCode ?? null,
      linha_digitavel: novaCobrancaAsaas.identificationField ?? null,
      pix_qrcode: pixData?.encodedImage ?? null,
      pix_copia_cola: pixData?.payload ?? null,
      pix_expiracao: pixData?.expirationDate ?? null,
      updated_at: new Date().toISOString(),
    };
    if (recriou) {
      updateDb.asaas_id = novaCobrancaAsaasId;
    }

    const { error: updErr } = await supabase
      .from('asaas_cobrancas')
      .update(updateDb)
      .eq('id', cobrancaId);

    if (updErr) {
      console.error('[alterar-forma] Erro ao atualizar asaas_cobrancas:', updErr);
    }

    // Espelhar em cobrancas (se existir vínculo por asaas_id antigo)
    await supabase
      .from('cobrancas')
      .update({
        forma_pagamento: novaForma,
        updated_at: new Date().toISOString(),
      })
      .or(`asaas_id.eq.${cobranca.asaas_id},asaas_id.eq.${novaCobrancaAsaasId}`);

    // Histórico do associado
    try {
      await supabase.from('associados_historico').insert({
        associado_id: cobranca.associado_id,
        tipo: 'forma_pagamento_alterada',
        descricao: `Forma de pagamento alterada de ${formaLabel(formaAtual)} para ${formaLabel(novaForma)}${recriou ? ' (cobrança recriada)' : ''}.`,
        usuario_id: authUserId,
        metadata: {
          cobranca_id: cobrancaId,
          asaas_id_anterior: cobranca.asaas_id,
          asaas_id_novo: novaCobrancaAsaasId,
          forma_anterior: formaAtual,
          forma_nova: novaForma,
          recriou,
        },
      });
    } catch (e) {
      console.warn('[alterar-forma] Não foi possível registrar histórico:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      recriou,
      cobranca: novaCobrancaAsaas,
      pix: pixData,
      asaas_id: novaCobrancaAsaasId,
      invoiceUrl: novaCobrancaAsaas.invoiceUrl,
      bankSlipUrl: novaCobrancaAsaas.bankSlipUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[asaas-alterar-forma-pagamento] Erro:', error);
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
