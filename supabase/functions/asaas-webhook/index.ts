import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getParametroPontuacao, registrarEventoPontuacao, estornarEventoPontuacao } from '../_shared/pontuacao-helper.ts';

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
    // Validar token de autenticação do ASAAS (se configurado)
    const asaasWebhookToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
    const headerToken = req.headers.get('asaas-access-token');

    if (asaasWebhookToken && headerToken !== asaasWebhookToken) {
      console.error('[asaas-webhook] Token de autenticação inválido');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

          // === PONTUAR NOVA ADESÃO (FALLBACK) ===
          try {
            const { data: contratoVendedorFallback } = await supabase
              .from('contratos')
              .select('vendedor_id')
              .eq('id', payment.externalReference)
              .maybeSingle();

            if (contratoVendedorFallback?.vendedor_id) {
              const pontos = await getParametroPontuacao(supabase, 'pontos_nova_adesao', 1.0);
              await registrarEventoPontuacao(supabase, {
                vendedor_id: contratoVendedorFallback.vendedor_id,
                tipo_operacao: 'nova_adesao',
                pontos,
                contrato_id: payment.externalReference,
                referencia_tipo: 'cobranca',
              });
            }
          } catch (pontErr) {
            console.error('[asaas-webhook] Erro ao pontuar adesão fallback:', pontErr);
          }

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

          // === CRIAR INSTALAÇÃO PÓS-PAGAMENTO (FALLBACK) ===
          // Buscar cotacao_id do contrato para criar instalação
          try {
            const { data: contratoParaInstalacao } = await supabase
              .from('contratos')
              .select('cotacao_id')
              .eq('id', payment.externalReference)
              .maybeSingle();

            if (contratoParaInstalacao?.cotacao_id) {
              console.log(`[asaas-webhook] Fallback: Criando instalação para cotação ${contratoParaInstalacao.cotacao_id}...`);
              
              const instalacaoResponse = await fetch(
                `${SUPABASE_URL}/functions/v1/criar-instalacao-pos-pagamento`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ cotacaoId: contratoParaInstalacao.cotacao_id })
                }
              );

              const instalacaoResult = await instalacaoResponse.json();
              
              if (instalacaoResult.success) {
                console.log(`[asaas-webhook] ✓ Fallback: Instalação criada: ${instalacaoResult.instalacaoId || 'já existente'}`);
              } else {
                console.warn(`[asaas-webhook] ⚠️ Fallback: Instalação não criada: ${instalacaoResult.error || instalacaoResult.message}`);
              }
            }
          } catch (instalacaoErr) {
            console.error('[asaas-webhook] Erro ao criar instalação (fallback):', instalacaoErr);
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

            // === GERAR COMISSÕES POR PLANO/NÍVEL ===
            if (cobranca.contrato_id) {
              try {
                const tipoComissao = cobranca.tipo === 'adesao' ? 'adesao' : 'recorrente';
                const { data: comissoesResult, error: comissoesError } = await supabase
                  .rpc('fn_gerar_comissao_plano_nivel', {
                    p_contrato_id: cobranca.contrato_id,
                    p_cobranca_id: cobranca.id,
                    p_valor_pago: payment.value,
                    p_tipo: tipoComissao,
                  });

                if (comissoesError) {
                  console.error('[asaas-webhook] Erro ao gerar comissões por plano:', comissoesError);
                } else if (comissoesResult > 0) {
                  console.log(`[asaas-webhook] ✓ ${comissoesResult} comissão(ões) gerada(s) para contrato ${cobranca.contrato_id} (${tipoComissao})`);
                }
              } catch (comErr) {
                console.error('[asaas-webhook] Erro ao chamar fn_gerar_comissao_plano_nivel:', comErr);
              }
            }

            // Buscar user_id do associado para notificações
            const { data: associadoUser } = await supabase
              .from('associados')
              .select('user_id')
              .eq('id', cobranca.associado_id)
              .single();

            // Disparar notificação centralizada (apenas para mensalidades, não adesão)
            if (associadoUser?.user_id && cobranca?.tipo !== 'adesao') {
              await supabase.functions.invoke('disparar-notificacao', {
                body: {
                  user_id: associadoUser.user_id,
                  associado_id: cobranca.associado_id,
                  tipo: 'boleto',
                  subtipo: 'pago',
                  dados: { 
                    valor: payment.value.toFixed(2),
                    mes: cobranca.competencia || 'Mensalidade'
                  },
                  referencia_tipo: 'cobranca',
                  referencia_id: cobranca.id
                }
              });
            }

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

              // === PONTUAR NOVA ADESÃO ===
              try {
                const { data: contratoVendedor } = await supabase
                  .from('contratos')
                  .select('vendedor_id')
                  .eq('id', cobranca.contrato_id)
                  .maybeSingle();

                if (contratoVendedor?.vendedor_id) {
                  const pontos = await getParametroPontuacao(supabase, 'pontos_nova_adesao', 1.0);
                  await registrarEventoPontuacao(supabase, {
                    vendedor_id: contratoVendedor.vendedor_id,
                    tipo_operacao: 'nova_adesao',
                    pontos,
                    contrato_id: cobranca.contrato_id,
                    referencia_tipo: 'cobranca',
                    referencia_id: cobranca.id,
                  });
                }
              } catch (pontErr) {
                console.error('[asaas-webhook] Erro ao pontuar adesão:', pontErr);
              }

              // === ATUALIZAR STATUS DA COTAÇÃO ===
              const { data: contratoData } = await supabase
                .from('contratos')
                .select('cotacao_id')
                .eq('id', cobranca.contrato_id)
                .maybeSingle();

              if (contratoData?.cotacao_id) {
                await supabase
                  .from('cotacoes')
                  .update({ 
                    status_contratacao: 'pagamento_ok',
                    status: 'aceita'
                  })
                  .eq('id', contratoData.cotacao_id);

                console.log(`[asaas-webhook] Cotação ${contratoData.cotacao_id} atualizada para pagamento_ok`);
              }

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

              // === CRIAR INSTALAÇÃO PÓS-PAGAMENTO (AUTOMÁTICO VIA BACKEND) ===
              // Garante que a instalação seja criada mesmo se o cliente fechar o navegador
              // Com retry e registro de falhas para reprocessamento
              if (contratoData?.cotacao_id) {
                let tentativas = 0;
                const maxTentativas = 3;
                let instalacaoCriada = false;
                let ultimoErro = '';

                while (!instalacaoCriada && tentativas < maxTentativas) {
                  tentativas++;
                  try {
                    console.log(`[asaas-webhook] Tentativa ${tentativas}/${maxTentativas} de criar instalação para cotação ${contratoData.cotacao_id}...`);
                    
                    const instalacaoResponse = await fetch(
                      `${SUPABASE_URL}/functions/v1/criar-instalacao-pos-pagamento`,
                      {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ cotacaoId: contratoData.cotacao_id })
                      }
                    );

                    const instalacaoResult = await instalacaoResponse.json();
                    
                    if (instalacaoResult.success) {
                      instalacaoCriada = true;
                      console.log(`[asaas-webhook] ✓ Instalação criada/confirmada: ${instalacaoResult.instalacaoId || 'já existente'}`);
                    } else if (instalacaoResult.message === 'Instalação já existente' || instalacaoResult.error === 'Instalação já existente') {
                      instalacaoCriada = true; // Já existe, não precisa retentar
                      console.log(`[asaas-webhook] ✓ Instalação já existente`);
                    } else {
                      ultimoErro = instalacaoResult.error || instalacaoResult.message || 'Erro desconhecido';
                      console.warn(`[asaas-webhook] ⚠️ Tentativa ${tentativas} falhou: ${ultimoErro}`);
                      if (tentativas < maxTentativas) {
                        // Backoff exponencial: 1s, 2s, 3s
                        await new Promise(r => setTimeout(r, 1000 * tentativas));
                      }
                    }
                  } catch (instalacaoErr) {
                    ultimoErro = instalacaoErr instanceof Error ? instalacaoErr.message : String(instalacaoErr);
                    console.error(`[asaas-webhook] Erro na tentativa ${tentativas}:`, instalacaoErr);
                    if (tentativas < maxTentativas) {
                      await new Promise(r => setTimeout(r, 1000 * tentativas));
                    }
                  }
                }

                // Se falhou após todas as tentativas, registrar para reprocessamento manual
                if (!instalacaoCriada) {
                  console.error(`[asaas-webhook] ❌ Falha ao criar instalação após ${maxTentativas} tentativas`);
                  try {
                    await supabase.from('instalacoes_pendentes_criacao').insert({
                      cotacao_id: contratoData.cotacao_id,
                      contrato_id: cobranca.contrato_id,
                      motivo: `Falha após ${maxTentativas} tentativas no webhook ASAAS`,
                      tentativas: tentativas,
                      ultima_tentativa: new Date().toISOString(),
                      erro_detalhes: ultimoErro,
                    });
                    console.log(`[asaas-webhook] 📝 Registrado em instalacoes_pendentes_criacao para reprocessamento`);
                  } catch (registroErr) {
                    console.error('[asaas-webhook] Erro ao registrar falha:', registroErr);
                  }
                }
              }
            }

            // Verificar se associado suspenso deve ser reativado (com regras de dias de atraso)
            const { data: associadoStatus } = await supabase
              .from('associados')
              .select('id, status, data_bloqueio')
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
                // Calcular dias de atraso desde a suspensão
                let diasAtraso = 0;
                if (associadoStatus.data_bloqueio) {
                  const dataBloqueio = new Date(associadoStatus.data_bloqueio);
                  const hoje = new Date();
                  diasAtraso = Math.floor((hoje.getTime() - dataBloqueio.getTime()) / (1000 * 60 * 60 * 24));
                }

                console.log(`[asaas-webhook] Associado ${cobranca.associado_id} - dias de atraso: ${diasAtraso}`);

                if (diasAtraso >= 120) {
                  // 120+ dias: NÃO reativar, já está em processo de exclusão
                  console.log(`[asaas-webhook] Associado ${cobranca.associado_id} com ${diasAtraso} dias - exclusão pendente, não reativar`);

                  // === PONTUAR REATIVAÇÃO 120+ DIAS ===
                  try {
                    const prazoReativacao = await getParametroPontuacao(supabase, 'prazo_reativacao_dias', 120);
                    if (diasAtraso >= prazoReativacao) {
                      const { data: contratoReativ } = await supabase
                        .from('contratos')
                        .select('id, vendedor_id')
                        .eq('associado_id', cobranca.associado_id)
                        .eq('status', 'ativo')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                      if (contratoReativ?.vendedor_id) {
                        const pontosReativ = await getParametroPontuacao(supabase, 'pontos_reativacao_120_dias', 1.0);
                        await registrarEventoPontuacao(supabase, {
                          vendedor_id: contratoReativ.vendedor_id,
                          tipo_operacao: 'reativacao_120_dias',
                          pontos: pontosReativ,
                          contrato_id: contratoReativ.id,
                          referencia_tipo: 'cobranca',
                          referencia_id: cobranca.id,
                        });
                        console.log(`[asaas-webhook] Pontuação reativação ${pontosReativ} pts para vendedor ${contratoReativ.vendedor_id}`);
                      }
                    }
                  } catch (pontErr) {
                    console.error('[asaas-webhook] Erro ao pontuar reativação:', pontErr);
                  }

                  await supabase.from('notificacoes').insert({
                    user_id: cobranca.associado_id,
                    titulo: 'Pagamento Recebido - Exclusão Pendente',
                    mensagem: 'Recebemos seu pagamento, porém devido ao período prolongado de inadimplência (120+ dias), sua reativação requer análise especial. Entre em contato com a associação.',
                    tipo: 'alerta',
                  });

                } else if (diasAtraso > 5) {
                  // 6-119 dias: paga mas precisa de revistoria para reativar
                  console.log(`[asaas-webhook] Associado ${cobranca.associado_id} com ${diasAtraso} dias - revistoria obrigatória`);

                  await supabase
                    .from('associados')
                    .update({
                      revistoria_pendente: true,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', cobranca.associado_id);

                  await supabase.from('notificacoes').insert({
                    user_id: cobranca.associado_id,
                    titulo: 'Pagamento Recebido - Revistoria Necessária',
                    mensagem: `Recebemos seu pagamento! Como sua proteção ficou suspensa por ${diasAtraso} dias, é necessário realizar uma revistoria para reativação. Acesse o app para iniciar.`,
                    tipo: 'alerta',
                  });

                  await supabase.from('associados_historico').insert({
                    associado_id: cobranca.associado_id,
                    tipo: 'status_alterado',
                    descricao: `Pagamento confirmado após ${diasAtraso} dias de suspensão. Revistoria obrigatória para reativação.`,
                    dados_anteriores: { status: 'suspenso', revistoria_pendente: false },
                    dados_novos: { status: 'suspenso', revistoria_pendente: true },
                  });

                } else {
                  // 0-5 dias: janela de tolerância, reativar automaticamente
                  await supabase
                    .from('associados')
                    .update({
                      status: 'ativo',
                      bloqueado: false,
                      motivo_bloqueio: null,
                      data_bloqueio: null,
                      revistoria_pendente: false,
                    })
                    .eq('id', cobranca.associado_id);

                  await supabase.from('notificacoes').insert({
                    user_id: cobranca.associado_id,
                    titulo: 'Conta Reativada',
                    mensagem: 'Sua conta foi reativada após quitação das pendências financeiras.',
                    tipo: 'sucesso',
                  });

                  await supabase.from('associados_historico').insert({
                    associado_id: cobranca.associado_id,
                    tipo: 'status_alterado',
                    descricao: `Associado reativado automaticamente após quitação (${diasAtraso} dias de atraso - dentro da tolerância)`,
                    dados_anteriores: { status: 'suspenso' },
                    dados_novos: { status: 'ativo' },
                  });

                  console.log(`[asaas-webhook] Associado ${cobranca.associado_id} reativado automaticamente (${diasAtraso} dias)`);

                  // Notificar Rede Veículos sobre adimplência
                  try {
                    await supabase.functions.invoke('rede-veiculos-informar-adimplente', {
                      body: {
                        associadoId: cobranca.associado_id,
                        motivo: 'pagamento_confirmado',
                      },
                    });
                  } catch (redeErr) {
                    console.warn(`[asaas-webhook] Erro ao notificar Rede Veículos:`, redeErr);
                  }
                }
              }
            }

            // === TRATAR COBRANÇA DE COTA DE PARTICIPAÇÃO (EVENTO/SINISTRO) ===
            if (cobranca?.tipo === 'cota_participacao') {
              console.log(`[asaas-webhook] Cota de participação paga para associado ${cobranca.associado_id}`);
              
              // Atualizar sinistro
              const { data: sinistroAtualizado } = await supabase
                .from('sinistros')
                .update({
                  cota_paga: true,
                  cota_paga_em: new Date().toISOString(),
                  status: 'pecas_em_cotacao',
                })
                .eq('cobranca_cota_id', cobranca.id)
                .select('id, protocolo, associado_id')
                .maybeSingle();

              // Atualizar link do evento
              if (sinistroAtualizado) {
                await supabase
                  .from('sinistro_evento_links')
                  .update({ pagamento_confirmado_em: new Date().toISOString() })
                  .eq('sinistro_id', sinistroAtualizado.id)
                  .eq('status', 'ativo');

                // Registrar histórico
                await supabase.from('sinistro_historico').insert({
                  sinistro_id: sinistroAtualizado.id,
                  status_anterior: 'aguardando_cota',
                  status_novo: 'pecas_em_cotacao',
                  observacao: `Pagamento da cota de coparticipação confirmado - R$ ${payment.value.toFixed(2)} via ${payment.billingType}. Peças em processo de cotação.`,
                });
              }

              // WhatsApp notification
              try {
                const { data: assocData } = await supabase
                  .from('associados')
                  .select('nome, whatsapp, telefone')
                  .eq('id', cobranca.associado_id)
                  .single();

                const tel = assocData?.whatsapp || assocData?.telefone;
                if (tel) {
                  await supabase.functions.invoke('whatsapp-send-text', {
                    body: {
                      phone: tel,
                      message: `✅ *PRATIC - Pagamento Confirmado*\n\nOlá ${assocData?.nome},\n\nO pagamento da cota de coparticipação no valor de R$ ${payment.value.toFixed(2)} foi confirmado!\n\nAs peças do seu veículo estão sendo cotadas junto aos nossos fornecedores. Você será notificado sobre cada etapa do processo! 🔧`,
                      template_name: 'notificacao_geral_v1',
                      template_params: [assocData?.nome?.split(' ')[0] || 'Associado', 'Pagamento confirmado', 'Cota de coparticipação recebida com sucesso'],
                    },
                  });
                }
              } catch (e) {
                console.error('[asaas-webhook] Erro WhatsApp cota_participacao:', e);
              }
            }
          }
          break;

        case 'PAYMENT_OVERDUE':
          // Disparar notificação de cobrança vencida via edge function centralizada
          if (cobranca) {
            const { data: associadoOverdue } = await supabase
              .from('associados')
              .select('user_id')
              .eq('id', cobranca.associado_id)
              .single();

            if (associadoOverdue?.user_id) {
              await supabase.functions.invoke('disparar-notificacao', {
                body: {
                  user_id: associadoOverdue.user_id,
                  associado_id: cobranca.associado_id,
                  tipo: 'boleto',
                  subtipo: 'vencido',
                  dados: { 
                    valor: payment.value.toFixed(2),
                    data: new Date(payment.dueDate).toLocaleDateString('pt-BR')
                  },
                  referencia_tipo: 'cobranca',
                  referencia_id: cobranca.id,
                  forcar_envio: true // Notificação urgente
                }
              });
            }

            // NOVO: Se for cobrança de adesão vencida, cancelar cotação
            if (cobranca.tipo === 'adesao' && cobranca.contrato_id) {
              console.log(`[asaas-webhook] Cobrança de adesão vencida - cancelando cotação do contrato ${cobranca.contrato_id}`);
              
              // Buscar cotação vinculada ao contrato
              const { data: contratoComCotacao } = await supabase
                .from('contratos')
                .select('cotacao_id')
                .eq('id', cobranca.contrato_id)
                .maybeSingle();

              if (contratoComCotacao?.cotacao_id) {
                // Atualizar cotação para expirada com motivo
                const { error: updateCotacaoError } = await supabase
                  .from('cotacoes')
                  .update({
                    status: 'expirada',
                    motivo_cancelamento: 'Pagamento de adesão não realizado dentro do prazo',
                    cancelada_em: new Date().toISOString(),
                  })
                  .eq('id', contratoComCotacao.cotacao_id)
                  .not('status', 'eq', 'expirada'); // Só atualiza se ainda não estiver expirada

                if (updateCotacaoError) {
                  console.error('[asaas-webhook] Erro ao cancelar cotação:', updateCotacaoError);
                } else {
                  console.log(`[asaas-webhook] Cotação ${contratoComCotacao.cotacao_id} cancelada por falta de pagamento de adesão`);
                  
                  // Registrar no histórico do contrato
                  await supabase.from('contratos_historico').insert({
                    contrato_id: cobranca.contrato_id,
                    evento: 'cotacao_cancelada',
                    descricao: 'Cotação cancelada automaticamente por falta de pagamento de adesão',
                    dados: {
                      cotacao_id: contratoComCotacao.cotacao_id,
                      cobranca_id: cobranca.id,
                      motivo: 'PAYMENT_OVERDUE',
                    },
                  });

                  // === ESTORNAR PONTUAÇÃO DE ADESÃO (respeitar toggle) ===
                  try {
                    const { data: paramEstorno } = await supabase
                      .from('comissoes_parametros')
                      .select('valor')
                      .eq('chave', 'estorno_cancelamento_antes_1_boleto')
                      .eq('ativo', true)
                      .maybeSingle();

                    const devEstornar = !paramEstorno || paramEstorno.valor === 'true';

                    if (devEstornar) {
                      const { data: contratoVendedorOverdue } = await supabase
                        .from('contratos')
                        .select('vendedor_id')
                        .eq('id', cobranca.contrato_id)
                        .maybeSingle();

                      if (contratoVendedorOverdue?.vendedor_id) {
                        const { data: eventoOriginal } = await supabase
                          .from('pontuacao_eventos')
                          .select('id, pontos')
                          .eq('contrato_id', cobranca.contrato_id)
                          .eq('tipo_operacao', 'nova_adesao')
                          .eq('estornado', false)
                          .maybeSingle();

                        if (eventoOriginal) {
                          await estornarEventoPontuacao(supabase, eventoOriginal.id, contratoVendedorOverdue.vendedor_id, cobranca.contrato_id);
                          console.log(`[asaas-webhook] Pontuação estornada para contrato ${cobranca.contrato_id}`);
                        }
                      }
                    } else {
                      console.log(`[asaas-webhook] Estorno desabilitado por parâmetro - contrato ${cobranca.contrato_id}`);
                    }
                  } catch (estornoErr) {
                    console.error('[asaas-webhook] Erro ao estornar pontuação:', estornoErr);
                  }

                  if (associadoOverdue?.user_id) {
                    await supabase.functions.invoke('disparar-notificacao', {
                      body: {
                        user_id: associadoOverdue.user_id,
                        associado_id: cobranca.associado_id,
                        tipo: 'sistema',
                        subtipo: 'alerta',
                        dados: { 
                          mensagem: 'Sua contratação foi cancelada por falta de pagamento. Entre em contato para regularizar.'
                        },
                        forcar_envio: true
                      }
                    });
                  }
                }
              }
            }
          }
          break;

        case 'PAYMENT_DELETED':
          updateData.status = 'CANCELLED';
          break;

        case 'PAYMENT_REFUNDED':
          updateData.status = 'REFUNDED';
          // Notificar estorno
          if (cobranca) {
            const { data: associadoRefund } = await supabase
              .from('associados')
              .select('user_id')
              .eq('id', cobranca.associado_id)
              .single();

            if (associadoRefund?.user_id) {
              await supabase.functions.invoke('disparar-notificacao', {
                body: {
                  user_id: associadoRefund.user_id,
                  associado_id: cobranca.associado_id,
                  tipo: 'sistema',
                  subtipo: 'atualizacao',
                  dados: { 
                    mensagem: `Estorno de R$ ${payment.value.toFixed(2)} processado`
                  }
                }
              });
            }
          }
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
