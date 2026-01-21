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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contratoId } = await req.json();
    console.log('[asaas-verificar-pagamento] Verificando contrato:', contratoId);

    if (!contratoId) {
      return new Response(
        JSON.stringify({ success: false, pago: false, erro: 'contratoId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar cobrança pendente no banco
    const { data: cobranca, error: cobrancaError } = await supabase
      .from('asaas_cobrancas')
      .select('id, asaas_id, status, contrato_id, associado_id')
      .eq('contrato_id', contratoId)
      .eq('tipo', 'adesao')
      .in('status', ['PENDING', 'OVERDUE'])
      .maybeSingle();

    if (cobrancaError) {
      console.error('[asaas-verificar-pagamento] Erro ao buscar cobrança:', cobrancaError);
      return new Response(
        JSON.stringify({ success: false, pago: false, erro: 'Erro ao buscar cobrança' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cobranca?.asaas_id) {
      console.log('[asaas-verificar-pagamento] Nenhuma cobrança pendente encontrada');
      
      // Verificar se já está pago no contrato
      const { data: contrato } = await supabase
        .from('contratos')
        .select('adesao_paga')
        .eq('id', contratoId)
        .maybeSingle();
      
      if (contrato?.adesao_paga) {
        return new Response(
          JSON.stringify({ success: true, pago: true, status: 'ALREADY_PAID' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, pago: false, erro: 'Cobrança não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[asaas-verificar-pagamento] Consultando Asaas:', cobranca.asaas_id);

    // 2. Consultar status na API do Asaas
    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/payments/${cobranca.asaas_id}`, {
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!asaasResponse.ok) {
      const errorText = await asaasResponse.text();
      console.error('[asaas-verificar-pagamento] Erro API Asaas:', errorText);
      return new Response(
        JSON.stringify({ success: false, pago: false, erro: 'Erro ao consultar Asaas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asaasData = await asaasResponse.json();
    console.log('[asaas-verificar-pagamento] Status Asaas:', asaasData.status);

    // 3. Verificar se está pago
    const statusPago = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
    
    if (statusPago.includes(asaasData.status)) {
      console.log('[asaas-verificar-pagamento] Pagamento confirmado! Atualizando banco...');

      // Atualizar status da cobrança
      const { error: updateCobrancaError } = await supabase
        .from('asaas_cobrancas')
        .update({ 
          status: asaasData.status,
          data_pagamento: asaasData.paymentDate || new Date().toISOString().split('T')[0],
          pagamento_valor: asaasData.value,
          pagamento_forma: asaasData.billingType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cobranca.id);

      if (updateCobrancaError) {
        console.error('[asaas-verificar-pagamento] Erro ao atualizar cobrança:', updateCobrancaError);
      }

      // Atualizar contrato
      const { error: updateContratoError } = await supabase
        .from('contratos')
        .update({ 
          adesao_paga: true,
          adesao_paga_em: new Date().toISOString(),
        })
        .eq('id', contratoId);

      if (updateContratoError) {
        console.error('[asaas-verificar-pagamento] Erro ao atualizar contrato:', updateContratoError);
      }

      // Buscar cotação vinculada ao contrato
      const { data: cotacao } = await supabase
        .from('cotacoes')
        .select('id')
        .eq('contrato_gerado_id', contratoId)
        .maybeSingle();

      if (cotacao) {
        const { error: updateCotacaoError } = await supabase
          .from('cotacoes')
          .update({ 
            status_contratacao: 'pagamento_ok',
            status: 'aceita',
          })
          .eq('id', cotacao.id);

        if (updateCotacaoError) {
          console.error('[asaas-verificar-pagamento] Erro ao atualizar cotação:', updateCotacaoError);
        }
      }

      // Registrar no histórico
      await supabase
        .from('contratos_historico')
        .insert({
          contrato_id: contratoId,
          tipo: 'pagamento',
          descricao: `Pagamento de adesão confirmado via verificação ativa (${asaasData.status})`,
          dados: {
            asaas_id: cobranca.asaas_id,
            status: asaasData.status,
            valor: asaasData.value,
            forma_pagamento: asaasData.billingType,
          },
        });

      console.log('[asaas-verificar-pagamento] Banco atualizado com sucesso!');

      return new Response(
        JSON.stringify({ 
          success: true, 
          pago: true, 
          status: asaasData.status,
          valor: asaasData.value,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pagamento ainda não confirmado
    console.log('[asaas-verificar-pagamento] Pagamento ainda pendente:', asaasData.status);
    return new Response(
      JSON.stringify({ 
        success: true, 
        pago: false, 
        status: asaasData.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[asaas-verificar-pagamento] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, pago: false, erro: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
