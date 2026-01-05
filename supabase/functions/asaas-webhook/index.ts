import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AsaasWebhookEvent {
  event: string;
  payment?: {
    id: string;
    customer: string;
    value: number;
    netValue: number;
    status: string;
    billingType: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    confirmedDate?: string;
    originalDueDate: string;
    dueDate: string;
    externalReference?: string;
    bankSlipUrl?: string;
    invoiceUrl?: string;
    transactionReceiptUrl?: string;
  };
  transfer?: object;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const event: AsaasWebhookEvent = await req.json();
    
    console.log(`[asaas-webhook] Evento recebido: ${event.event}`);
    console.log(`[asaas-webhook] Payload:`, JSON.stringify(event, null, 2));

    // Registrar log do webhook
    const { error: logError } = await supabase
      .from('asaas_webhooks_log')
      .insert({
        evento: event.event,
        payload: event,
        asaas_cobranca_id: event.payment?.id,
        asaas_cliente_id: event.payment?.customer,
      });

    if (logError) {
      console.error('[asaas-webhook] Erro ao registrar log:', logError);
    }

    // Processar eventos de pagamento
    if (event.payment) {
      const payment = event.payment;
      
      // Buscar cobrança no banco com dados do associado
      const { data: cobranca, error: fetchError } = await supabase
        .from('asaas_cobrancas')
        .select(`
          id, 
          associado_id, 
          valor,
          competencia,
          associados:associado_id (
            email,
            nome
          )
        `)
        .eq('asaas_id', payment.id)
        .maybeSingle();

      if (fetchError) {
        console.error('[asaas-webhook] Erro ao buscar cobrança:', fetchError);
      }

      const associado = cobranca?.associados as any;

      // Mapear status do ASAAS para status interno
      const statusMap: Record<string, string> = {
        'PENDING': 'PENDING',
        'RECEIVED': 'RECEIVED',
        'CONFIRMED': 'CONFIRMED',
        'OVERDUE': 'OVERDUE',
        'REFUNDED': 'REFUNDED',
        'RECEIVED_IN_CASH': 'RECEIVED_IN_CASH',
        'REFUND_REQUESTED': 'REFUND_REQUESTED',
        'CHARGEBACK_REQUESTED': 'CHARGEBACK_REQUESTED',
        'CHARGEBACK_DISPUTE': 'CHARGEBACK_DISPUTE',
        'AWAITING_CHARGEBACK_REVERSAL': 'AWAITING_CHARGEBACK_REVERSAL',
        'DUNNING_REQUESTED': 'DUNNING_REQUESTED',
        'DUNNING_RECEIVED': 'DUNNING_RECEIVED',
        'AWAITING_RISK_ANALYSIS': 'AWAITING_RISK_ANALYSIS',
      };

      const updateData: Record<string, any> = {
        status: statusMap[payment.status] || payment.status,
        updated_at: new Date().toISOString(),
      };

      // Dados adicionais baseados no evento
      switch (event.event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          updateData.data_pagamento = payment.paymentDate || payment.clientPaymentDate;
          updateData.pagamento_valor = payment.netValue || payment.value;
          updateData.pagamento_forma = payment.billingType;
          updateData.valor_liquido = payment.netValue;
          
          // Registrar pagamento na tabela de pagamentos
          if (cobranca) {
            await supabase.from('asaas_pagamentos').insert({
              asaas_id: `${payment.id}-${Date.now()}`,
              cobranca_id: cobranca.id,
              associado_id: cobranca.associado_id,
              valor: payment.value,
              valor_liquido: payment.netValue,
              data_pagamento: payment.paymentDate || payment.clientPaymentDate || new Date().toISOString(),
              forma_pagamento: payment.billingType,
              status: 'CONFIRMED',
              comprovante_url: payment.transactionReceiptUrl,
            });

            // Criar notificação para o associado
            await supabase.from('notificacoes').insert({
              user_id: cobranca.associado_id,
              titulo: 'Pagamento Confirmado',
              mensagem: `Seu pagamento de R$ ${payment.value.toFixed(2)} foi confirmado.`,
              tipo: 'sucesso',
            });

            // Enviar email de confirmação de pagamento
            if (associado?.email) {
              try {
                const dataPagamento = payment.paymentDate || payment.clientPaymentDate;
                const dataFormatada = dataPagamento 
                  ? new Date(dataPagamento).toLocaleDateString('pt-BR')
                  : new Date().toLocaleDateString('pt-BR');

                await supabase.functions.invoke('send-email', {
                  body: {
                    template: 'pagamento-confirmado',
                    to: associado.email,
                    data: {
                      competencia: cobranca.competencia || 'Mensalidade',
                      valor: payment.value.toFixed(2),
                      dataPagamento: dataFormatada,
                    }
                  }
                });
                console.log(`[asaas-webhook] Email de pagamento enviado para ${associado.email}`);
              } catch (emailError) {
                console.error('[asaas-webhook] Erro ao enviar email:', emailError);
              }
            }
          }
          break;

        case 'PAYMENT_OVERDUE':
          // Criar notificação de cobrança vencida
          if (cobranca) {
            await supabase.from('notificacoes').insert({
              user_id: cobranca.associado_id,
              titulo: 'Cobrança Vencida',
              mensagem: `Sua cobrança de R$ ${payment.value.toFixed(2)} está vencida. Regularize para evitar bloqueio.`,
              tipo: 'alerta',
            });
          }
          break;

        case 'PAYMENT_DELETED':
        case 'PAYMENT_REFUNDED':
          updateData.status = event.event === 'PAYMENT_DELETED' ? 'CANCELLED' : 'REFUNDED';
          break;

        case 'PAYMENT_UPDATED':
          updateData.data_vencimento = payment.dueDate;
          updateData.boleto_url = payment.bankSlipUrl;
          break;
      }

      // Atualizar cobrança no banco
      const { error: updateError } = await supabase
        .from('asaas_cobrancas')
        .update(updateData)
        .eq('asaas_id', payment.id);

      if (updateError) {
        console.error('[asaas-webhook] Erro ao atualizar cobrança:', updateError);
      } else {
        console.log(`[asaas-webhook] Cobrança ${payment.id} atualizada: ${payment.status}`);
      }

      // Marcar webhook como processado
      await supabase
        .from('asaas_webhooks_log')
        .update({ 
          processado: true, 
          processado_em: new Date().toISOString() 
        })
        .eq('asaas_cobranca_id', payment.id)
        .eq('evento', event.event)
        .order('created_at', { ascending: false })
        .limit(1);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[asaas-webhook] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Mesmo com erro, retornamos 200 para o ASAAS não reenviar
    return new Response(JSON.stringify({ 
      received: true, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
