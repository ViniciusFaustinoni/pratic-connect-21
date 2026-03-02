import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!;

function getAsaasBaseUrl() {
  const envExplicito = Deno.env.get('ASAAS_ENV');
  if (envExplicito) {
    return envExplicito === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
  }
  return ASAAS_API_KEY?.includes('_hmlg_')
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';
}

const ASAAS_API_URL = getAsaasBaseUrl();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { cobranca_id } = await req.json();
    if (!cobranca_id) throw new Error('cobranca_id é obrigatório');

    console.log(`[emitir-boleto] Processando cobrança ${cobranca_id}`);

    // 1. Buscar cobrança com associado e cliente ASAAS
    const { data: cobranca, error: fetchErr } = await supabase
      .from('asaas_cobrancas')
      .select(`
        *,
        associado:associados(id, nome, email, cpf, telefone, whatsapp, dia_vencimento),
        veiculo:veiculos(id, placa)
      `)
      .eq('id', cobranca_id)
      .single();

    if (fetchErr || !cobranca) {
      throw new Error(`Cobrança não encontrada: ${fetchErr?.message}`);
    }

    // 2. Verificar se já foi emitida (asaas_id real)
    if (cobranca.asaas_id && !cobranca.asaas_id.startsWith('LOCAL-')) {
      return new Response(JSON.stringify({
        success: true,
        ja_emitido: true,
        asaas_id: cobranca.asaas_id,
        boleto_url: cobranca.boleto_url,
        pix_copia_cola: cobranca.pix_copia_cola,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Buscar cliente ASAAS do associado
    const { data: clienteAsaas } = await supabase
      .from('asaas_clientes')
      .select('asaas_id')
      .eq('associado_id', cobranca.associado_id)
      .maybeSingle();

    let asaasCustomerId = clienteAsaas?.asaas_id;

    // 4. Se não tem cliente, sincronizar
    if (!asaasCustomerId) {
      console.log(`[emitir-boleto] Cliente não encontrado, sincronizando...`);
      const syncResponse = await supabase.functions.invoke('asaas-clientes', {
        body: { action: 'sincronizar', associado_id: cobranca.associado_id },
      });

      if (syncResponse.error || !syncResponse.data?.success) {
        throw new Error(`Erro ao sincronizar cliente: ${syncResponse.error?.message || syncResponse.data?.error || 'Erro desconhecido'}`);
      }

      asaasCustomerId = syncResponse.data.asaas_id;
      if (!asaasCustomerId) {
        throw new Error('Não foi possível obter o ID do cliente no ASAAS');
      }
    }

    // 5. Montar descrição
    const composicao = cobranca.composicao_resumo as any;
    const placas = composicao?.veiculos?.map((v: any) => v.placa).join(', ') || cobranca.veiculo?.placa || '';
    const descricao = `Contribuição Mensal — ${cobranca.competencia} — ${cobranca.associado?.nome}${placas ? ` — ${placas}` : ''}`;

    // 6. Criar payment no ASAAS
    console.log(`[emitir-boleto] Criando payment para ${cobranca.associado?.nome}`);
    const paymentResponse = await fetch(`${ASAAS_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'UNDEFINED',
        value: Math.round(cobranca.valor * 100) / 100,
        dueDate: cobranca.data_vencimento,
        description: descricao,
        externalReference: `${cobranca.associado_id}-${cobranca.competencia}-rateio`,
        fine: { value: 2, type: 'PERCENTAGE' },
        interest: { value: 1, type: 'PERCENTAGE' },
      }),
    });

    if (!paymentResponse.ok) {
      const errorData = await paymentResponse.json();
      const errorMsg = errorData.errors?.[0]?.description || `Erro ASAAS: ${paymentResponse.status}`;
      throw new Error(errorMsg);
    }

    const payment = await paymentResponse.json();
    console.log(`[emitir-boleto] Payment criado: ${payment.id}`);

    // 7. Buscar QR Code PIX
    let pixPayload = null;
    let pixEncodedImage = null;
    try {
      const pixResponse = await fetch(`${ASAAS_API_URL}/payments/${payment.id}/pixQrCode`, {
        headers: { 'access_token': ASAAS_API_KEY },
      });
      if (pixResponse.ok) {
        const pixData = await pixResponse.json();
        pixPayload = pixData.payload;
        pixEncodedImage = pixData.encodedImage;
      }
    } catch (e) {
      console.warn('[emitir-boleto] PIX QR Code não disponível:', e);
    }

    // 8. Atualizar cobrança no banco
    const { error: updateErr } = await supabase
      .from('asaas_cobrancas')
      .update({
        asaas_id: payment.id,
        asaas_cliente_id: asaasCustomerId,
        status: payment.status || 'PENDING',
        boleto_url: payment.bankSlipUrl,
        boleto_codigo_barras: payment.barCode,
        boleto_nosso_numero: payment.nossoNumero,
        linha_digitavel: payment.identificationField,
        pix_copia_cola: pixPayload,
        pix_qrcode: pixEncodedImage ? `data:image/png;base64,${pixEncodedImage}` : null,
        sincronizado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', cobranca_id);

    if (updateErr) {
      console.error('[emitir-boleto] Erro ao atualizar cobrança:', updateErr);
    }

    return new Response(JSON.stringify({
      success: true,
      asaas_id: payment.id,
      boleto_url: payment.bankSlipUrl,
      pix_copia_cola: pixPayload,
      status: payment.status,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('[emitir-boleto] Erro:', error);
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';

    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
