import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') || '';
const IS_SANDBOX = Deno.env.get('ASAAS_SANDBOX') === 'true' || ASAAS_API_KEY.startsWith('$aact_');
const ASAAS_BASE_URL = IS_SANDBOX
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sinistroId } = await req.json();
    console.log('[asaas-verificar-cota-sinistro] Verificando sinistro:', sinistroId);

    if (!sinistroId) {
      return new Response(
        JSON.stringify({ success: false, pago: false, erro: 'sinistroId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar sinistro
    const { data: sinistro, error: sinistroError } = await supabase
      .from('sinistros')
      .select('id, cota_paga, cobranca_cota_id, status')
      .eq('id', sinistroId)
      .single();

    if (sinistroError || !sinistro) {
      console.error('[asaas-verificar-cota-sinistro] Sinistro não encontrado:', sinistroError);
      return new Response(
        JSON.stringify({ success: false, pago: false, erro: 'Sinistro não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Se já pago, retornar imediatamente (idempotente)
    if (sinistro.cota_paga) {
      console.log('[asaas-verificar-cota-sinistro] Cota já paga anteriormente');
      return new Response(
        JSON.stringify({ success: true, pago: true, status: 'ALREADY_PAID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Verificar se há cobrança vinculada
    if (!sinistro.cobranca_cota_id) {
      console.log('[asaas-verificar-cota-sinistro] Sinistro sem cobrança de cota vinculada');
      return new Response(
        JSON.stringify({ success: false, pago: false, erro: 'Nenhuma cobrança de cota vinculada ao sinistro' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Buscar cobrança no banco
    const { data: cobranca, error: cobrancaError } = await supabase
      .from('asaas_cobrancas')
      .select('id, asaas_id, status')
      .eq('id', sinistro.cobranca_cota_id)
      .single();

    if (cobrancaError || !cobranca) {
      console.error('[asaas-verificar-cota-sinistro] Cobrança não encontrada:', cobrancaError);
      return new Response(
        JSON.stringify({ success: false, pago: false, erro: 'Cobrança de cota não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Se a cobrança local já está marcada como paga, sincronizar sinistro
    const statusPago = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
    
    if (statusPago.includes(cobranca.status)) {
      console.log('[asaas-verificar-cota-sinistro] Cobrança local já marcada como paga, sincronizando sinistro...');
      await atualizarSinistro(supabase, sinistroId, sinistro.status, cobranca.status);
      return new Response(
        JSON.stringify({ success: true, pago: true, status: cobranca.status, fonte: 'banco_local' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Consultar API do Asaas para status atualizado
    console.log('[asaas-verificar-cota-sinistro] Consultando Asaas:', cobranca.asaas_id);
    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/payments/${cobranca.asaas_id}`, {
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!asaasResponse.ok) {
      const errorText = await asaasResponse.text();
      console.error('[asaas-verificar-cota-sinistro] Erro API Asaas:', errorText);
      return new Response(
        JSON.stringify({ success: false, pago: false, erro: 'Erro ao consultar Asaas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asaasData = await asaasResponse.json();
    console.log('[asaas-verificar-cota-sinistro] Status Asaas:', asaasData.status);

    if (statusPago.includes(asaasData.status)) {
      console.log('[asaas-verificar-cota-sinistro] Pagamento confirmado no Asaas! Atualizando banco...');

      // Atualizar status da cobrança local
      await supabase
        .from('asaas_cobrancas')
        .update({
          status: asaasData.status,
          data_pagamento: asaasData.paymentDate || new Date().toISOString().split('T')[0],
          pagamento_valor: asaasData.value,
          pagamento_forma: asaasData.billingType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cobranca.id);

      // Atualizar sinistro + registrar histórico
      await atualizarSinistro(supabase, sinistroId, sinistro.status, asaasData.status);

      return new Response(
        JSON.stringify({ success: true, pago: true, status: asaasData.status, valor: asaasData.value }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pagamento ainda pendente
    console.log('[asaas-verificar-cota-sinistro] Pagamento ainda pendente:', asaasData.status);
    return new Response(
      JSON.stringify({ success: true, pago: false, status: asaasData.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[asaas-verificar-cota-sinistro] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, pago: false, erro: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function atualizarSinistro(supabase: any, sinistroId: string, statusAtual: string, asaasStatus: string) {
  const { error: updateError } = await supabase
    .from('sinistros')
    .update({
      cota_paga: true,
      cota_paga_em: new Date().toISOString(),
      status: 'pecas_em_cotacao',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sinistroId);

  if (updateError) {
    console.error('[asaas-verificar-cota-sinistro] Erro ao atualizar sinistro:', updateError);
    return;
  }

  await supabase
    .from('sinistro_historico')
    .insert({
      sinistro_id: sinistroId,
      status_anterior: statusAtual,
      status_novo: 'pecas_em_cotacao',
      observacao: `Pagamento da cota de coparticipação confirmado via verificação ativa — status Asaas: ${asaasStatus}`,
    });

  console.log('[asaas-verificar-cota-sinistro] Sinistro atualizado com sucesso!');
}
