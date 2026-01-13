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
      let cobranca = null;
      let fetchError = null;
      
      // Primeiro tentar buscar pelo asaas_id
      const { data: cobrancaByAsaasId, error: fetchError1 } = await supabase
        .from('asaas_cobrancas')
        .select(`
          id, 
          associado_id, 
          valor,
          competencia,
          contrato_id,
          tipo,
          associados:associado_id (
            email,
            nome
          )
        `)
        .eq('asaas_id', payment.id)
        .maybeSingle();

      if (cobrancaByAsaasId) {
        cobranca = cobrancaByAsaasId;
        console.log(`[asaas-webhook] Cobrança encontrada pelo asaas_id: ${payment.id}`);
      } else {
        fetchError = fetchError1;
        console.log(`[asaas-webhook] Cobrança não encontrada pelo asaas_id, tentando externalReference...`);
        
        // FALLBACK: Buscar pelo externalReference (contrato_id)
        if (payment.externalReference) {
          const { data: cobrancaByRef, error: fetchError2 } = await supabase
            .from('asaas_cobrancas')
            .select(`
              id, 
              associado_id, 
              valor,
              competencia,
              contrato_id,
              tipo,
              associados:associado_id (
                email,
                nome
              )
            `)
            .eq('contrato_id', payment.externalReference)
            .eq('tipo', 'adesao')
            .maybeSingle();
          
          if (cobrancaByRef) {
            cobranca = cobrancaByRef;
            console.log(`[asaas-webhook] Cobrança encontrada pelo externalReference (contrato_id): ${payment.externalReference}`);
            
            // Atualizar o asaas_id na cobrança para futuras buscas
            await supabase
              .from('asaas_cobrancas')
              .update({ asaas_id: payment.id })
              .eq('id', cobrancaByRef.id);
          } else {
            fetchError = fetchError2;
            console.log(`[asaas-webhook] Cobrança não encontrada pelo externalReference`);
          }
        }
      }

      if (fetchError) {
        console.error('[asaas-webhook] Erro ao buscar cobrança:', fetchError);
      }

      const associado = cobranca?.associados as any;
      
      // FALLBACK EXTRA: Se não encontrou cobrança mas tem externalReference (contrato_id),
      // atualizar o contrato diretamente para eventos de pagamento confirmado
      if (!cobranca && payment.externalReference && 
          (event.event === 'PAYMENT_RECEIVED' || event.event === 'PAYMENT_CONFIRMED')) {
        console.log(`[asaas-webhook] Fallback: Atualizando contrato ${payment.externalReference} diretamente`);
        
        const { error: updateContratoError } = await supabase
          .from('contratos')
          .update({ 
            adesao_paga: true,
            adesao_paga_em: new Date().toISOString(),
          })
          .eq('id', payment.externalReference);
        
        if (updateContratoError) {
          console.error('[asaas-webhook] Erro ao atualizar contrato via fallback:', updateContratoError);
        } else {
          console.log(`[asaas-webhook] Contrato ${payment.externalReference} atualizado via fallback`);
          
          // Registrar no histórico
          await supabase.from('contratos_historico').insert({
            contrato_id: payment.externalReference,
            evento: 'adesao_paga',
            descricao: `Pagamento de adesão confirmado via webhook fallback - R$ ${payment.value.toFixed(2)}`,
            dados: { 
              asaas_id: payment.id, 
              valor: payment.value,
              forma_pagamento: payment.billingType,
              fallback: true,
            },
          });

          // === CRIAR DOCUMENTO NO AUTENTIQUE AUTOMATICAMENTE (FALLBACK) ===
          try {
            const contratoId = payment.externalReference;
            
            // Buscar dados do contrato
            const { data: contratoFallback } = await supabase
              .from('contratos')
              .select(`
                id,
                cliente_nome,
                cliente_email,
                cliente_cpf,
                cliente_telefone,
                associado_id,
                lead_id
              `)
              .eq('id', contratoId)
              .single();

            if (contratoFallback) {
              let clienteNome = contratoFallback.cliente_nome;
              let clienteEmail = contratoFallback.cliente_email;
              let clienteCpf = contratoFallback.cliente_cpf;
              let clienteTelefone = contratoFallback.cliente_telefone;

              // Buscar do associado se necessário
              if ((!clienteNome || !clienteEmail || !clienteCpf) && contratoFallback.associado_id) {
                const { data: associadoData } = await supabase
                  .from('associados')
                  .select('nome, email, cpf, telefone')
                  .eq('id', contratoFallback.associado_id)
                  .single();
                
                if (associadoData) {
                  clienteNome = clienteNome || associadoData.nome;
                  clienteEmail = clienteEmail || associadoData.email;
                  clienteCpf = clienteCpf || associadoData.cpf;
                  clienteTelefone = clienteTelefone || associadoData.telefone;
                }
              }

              // Buscar do lead se necessário
              if ((!clienteNome || !clienteEmail || !clienteCpf) && contratoFallback.lead_id) {
                const { data: leadData } = await supabase
                  .from('leads')
                  .select('nome, email, cpf, telefone')
                  .eq('id', contratoFallback.lead_id)
                  .single();
                
                if (leadData) {
                  clienteNome = clienteNome || leadData.nome;
                  clienteEmail = clienteEmail || leadData.email;
                  clienteCpf = clienteCpf || leadData.cpf;
                  clienteTelefone = clienteTelefone || leadData.telefone;
                }
              }

              if (clienteNome && clienteEmail && clienteCpf) {
                console.log(`[asaas-webhook] Criando documento Autentique via fallback para contrato ${contratoId}...`);
                
                const { error: autentiqueError } = await supabase.functions.invoke('autentique-create', {
                  headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  },
                  body: {
                    contratoId,
                    clienteNome,
                    clienteEmail,
                    clienteCpf,
                    clienteTelefone,
                  }
                });

                if (autentiqueError) {
                  console.error('[asaas-webhook] Erro ao criar documento Autentique (fallback):', autentiqueError);
                } else {
                  console.log(`[asaas-webhook] Documento Autentique criado via fallback para contrato ${contratoId}`);
                }
              }
            }
          } catch (autentiqueErr) {
            console.error('[asaas-webhook] Erro ao processar Autentique (fallback):', autentiqueErr);
          }
        }
      }

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

            // Verificar se é cobrança de adesão vinculada a contrato
            // Agora usamos os dados já carregados na cobrança
            if (cobranca?.tipo === 'adesao' && cobranca.contrato_id) {
              // Atualizar contrato com adesão paga
              await supabase
                .from('contratos')
                .update({ 
                  adesao_paga: true,
                  adesao_paga_em: new Date().toISOString(),
                })
                .eq('id', cobranca.contrato_id);

              // Registrar no histórico do contrato
              await supabase.from('contratos_historico').insert({
                contrato_id: cobranca.contrato_id,
                evento: 'adesao_paga',
                descricao: `Pagamento de adesão confirmado - R$ ${payment.value.toFixed(2)}`,
                dados: { 
                  asaas_id: payment.id, 
                  valor: payment.value,
                  forma_pagamento: payment.billingType,
                },
              });

              console.log(`[asaas-webhook] Adesão paga para contrato ${cobranca.contrato_id}`);

              // === CRIAR DOCUMENTO NO AUTENTIQUE AUTOMATICAMENTE ===
              try {
                // Buscar dados completos do contrato para criação do documento
                const { data: contratoCompleto } = await supabase
                  .from('contratos')
                  .select(`
                    id,
                    cliente_nome,
                    cliente_email,
                    cliente_cpf,
                    cliente_telefone,
                    associado_id,
                    lead_id
                  `)
                  .eq('id', cobranca.contrato_id)
                  .single();

                if (contratoCompleto) {
                  // Buscar dados do associado ou lead se necessário
                  let clienteNome = contratoCompleto.cliente_nome;
                  let clienteEmail = contratoCompleto.cliente_email;
                  let clienteCpf = contratoCompleto.cliente_cpf;
                  let clienteTelefone = contratoCompleto.cliente_telefone;

                  // Se não tem dados no contrato, buscar do associado
                  if ((!clienteNome || !clienteEmail || !clienteCpf) && contratoCompleto.associado_id) {
                    const { data: associadoData } = await supabase
                      .from('associados')
                      .select('nome, email, cpf, telefone')
                      .eq('id', contratoCompleto.associado_id)
                      .single();
                    
                    if (associadoData) {
                      clienteNome = clienteNome || associadoData.nome;
                      clienteEmail = clienteEmail || associadoData.email;
                      clienteCpf = clienteCpf || associadoData.cpf;
                      clienteTelefone = clienteTelefone || associadoData.telefone;
                    }
                  }

                  // Se ainda não tem dados, buscar do lead
                  if ((!clienteNome || !clienteEmail || !clienteCpf) && contratoCompleto.lead_id) {
                    const { data: leadData } = await supabase
                      .from('leads')
                      .select('nome, email, cpf, telefone')
                      .eq('id', contratoCompleto.lead_id)
                      .single();
                    
                    if (leadData) {
                      clienteNome = clienteNome || leadData.nome;
                      clienteEmail = clienteEmail || leadData.email;
                      clienteCpf = clienteCpf || leadData.cpf;
                      clienteTelefone = clienteTelefone || leadData.telefone;
                    }
                  }

                  if (clienteNome && clienteEmail && clienteCpf) {
                    console.log(`[asaas-webhook] Criando documento Autentique para contrato ${cobranca.contrato_id}...`);
                    
                    // Chamar edge function do Autentique com service role key
                    const { error: autentiqueError } = await supabase.functions.invoke('autentique-create', {
                      headers: {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                      },
                      body: {
                        contratoId: cobranca.contrato_id,
                        clienteNome,
                        clienteEmail,
                        clienteCpf,
                        clienteTelefone,
                      }
                    });

                    if (autentiqueError) {
                      console.error('[asaas-webhook] Erro ao criar documento Autentique:', autentiqueError);
                    } else {
                      console.log(`[asaas-webhook] Documento Autentique criado com sucesso para contrato ${cobranca.contrato_id}`);
                    }
                  } else {
                    console.warn('[asaas-webhook] Dados insuficientes para criar documento Autentique:', { clienteNome, clienteEmail, clienteCpf });
                  }
                }
              } catch (autentiqueErr) {
                console.error('[asaas-webhook] Erro ao processar Autentique:', autentiqueErr);
                // Não bloqueia o fluxo principal se falhar
              }
            }

            // CORREÇÃO 7.5.6: Verificar se associado suspenso deve ser reativado
            const { data: associadoStatus } = await supabase
              .from('associados')
              .select('id, status')
              .eq('id', cobranca.associado_id)
              .single();

            if (associadoStatus?.status === 'suspenso') {
              // Verificar se ainda há cobranças pendentes/vencidas
              const { count: cobrancasPendentes } = await supabase
                .from('asaas_cobrancas')
                .select('*', { count: 'exact', head: true })
                .eq('associado_id', cobranca.associado_id)
                .in('status', ['PENDING', 'OVERDUE']);

              if (cobrancasPendentes === 0) {
                // Reativar associado
                await supabase
                  .from('associados')
                  .update({ 
                    status: 'ativo',
                    bloqueado: false,
                    motivo_bloqueio: null,
                    data_bloqueio: null,
                  })
                  .eq('id', cobranca.associado_id);

                // Notificar reativação
                await supabase.from('notificacoes').insert({
                  user_id: cobranca.associado_id,
                  titulo: 'Conta Reativada',
                  mensagem: 'Sua conta foi reativada após quitação das pendências financeiras.',
                  tipo: 'sucesso',
                });

                // Registrar no histórico
                await supabase.from('associados_historico').insert({
                  associado_id: cobranca.associado_id,
                  tipo: 'status_alterado',
                  descricao: 'Associado reativado automaticamente após quitação de débitos',
                  dados_anteriores: { status: 'suspenso' },
                  dados_novos: { status: 'ativo' },
                });

                console.log(`[asaas-webhook] Associado ${cobranca.associado_id} reativado automaticamente`);
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
