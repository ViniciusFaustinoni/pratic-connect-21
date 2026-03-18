import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfiguracaoNumero } from "../_shared/config-helper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!;

// Detectar ambiente: prioriza ASAAS_ENV, senão infere pelo prefixo da chave
// $aact_ = produção, caso contrário sandbox
function getAsaasConfig() {
  const envExplicito = Deno.env.get('ASAAS_ENV');
  
  let ambiente: 'production' | 'sandbox';
  
  if (envExplicito) {
    ambiente = envExplicito === 'production' ? 'production' : 'sandbox';
    console.log(`[asaas-cobranca-adesao] Ambiente definido por ASAAS_ENV: ${ambiente}`);
  } else {
    // Inferir pelo prefixo da chave API - chaves sandbox contêm '_hmlg_' (homologação)
    const isSandbox = ASAAS_API_KEY?.includes('_hmlg_');
    ambiente = isSandbox ? 'sandbox' : 'production';
    console.log(`[asaas-cobranca-adesao] Ambiente inferido pela chave API: ${ambiente}`);
  }
  
  const baseUrl = ambiente === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
  
  console.log(`[asaas-cobranca-adesao] Base URL: ${baseUrl}`);
  
  return { ambiente, baseUrl };
}

const { ambiente: ASAAS_ENV, baseUrl: ASAAS_API_URL } = getAsaasConfig();

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CobrancaAdesaoRequest {
  contratoId: string;
  valor: number;
  formaPagamento?: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED'; // Suporta múltiplas formas
  cliente: {
    nome: string;
    email: string;
    cpfCnpj: string;
  };
}

async function asaasRequest(endpoint: string, method: string, body?: object) {
  const url = `${ASAAS_API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('[asaas-cobranca-adesao] Erro Asaas:', data);
    throw new Error(data.errors?.[0]?.description || 'Erro na API do Asaas');
  }

  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    let { contratoId, valor, formaPagamento, cliente }: CobrancaAdesaoRequest = await req.json();

    // GUARD: Adesão zerada — retorna sucesso sem criar cobrança
    if (valor <= 0) {
      console.log(`[asaas-cobranca-adesao] Adesão isenta (valor=${valor}). Pulando criação de cobrança.`);
      return new Response(
        JSON.stringify({ success: true, isento: true, message: 'Adesão isenta — nenhuma cobrança criada.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitizar CPF/CNPJ
    let cpfCnpj = (cliente.cpfCnpj || '').replace(/\D/g, '');
    if (cpfCnpj.length > 0 && cpfCnpj.length < 11) {
      cpfCnpj = cpfCnpj.padStart(11, '0');
    }
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return new Response(
        JSON.stringify({ success: false, error: `CPF/CNPJ inválido (${cpfCnpj.length} dígitos)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    cliente.cpfCnpj = cpfCnpj;
    console.log(`[asaas-cobranca-adesao] CPF sanitizado: ***${cpfCnpj.slice(-4)}`);

    console.log(`[asaas-cobranca-adesao] Iniciando para contrato ${contratoId}, valor recebido: R$ ${valor}, forma: ${formaPagamento || 'UNDEFINED'}`);

    // Definir billingType - usar UNDEFINED como padrão para permitir PIX e Cartão
    const billingType = formaPagamento || 'UNDEFINED';

    // VALIDAÇÃO DE VALOR MÍNIMO - Asaas não aceita cobranças abaixo de R$ 5,00
    const VALOR_MINIMO_ASAAS = 5;
    
    if (valor < VALOR_MINIMO_ASAAS) {
      console.log(`[asaas-cobranca-adesao] ⚠️ Valor ${valor} abaixo do mínimo. Buscando valor do plano...`);
      
      // Buscar valor correto do plano através do contrato -> cotação -> plano
      const { data: contratoInfo, error: contratoInfoError } = await supabase
        .from('contratos')
        .select(`
          cotacao_id,
          cotacoes:cotacao_id (
            plano_id,
            valor_adesao,
            planos:plano_id (
              valor_adesao
            )
          )
        `)
        .eq('id', contratoId)
        .single();

      if (contratoInfoError) {
        console.error('[asaas-cobranca-adesao] Erro ao buscar info do contrato:', contratoInfoError);
      }

      // Priorizar valor da cotação (definido pelo consultor) sobre o valor fixo do plano
      const cotacao = contratoInfo?.cotacoes as any;
      const valorPlano = cotacao?.valor_adesao || cotacao?.planos?.valor_adesao;
      
      if (valorPlano && valorPlano >= VALOR_MINIMO_ASAAS) {
        console.log(`[asaas-cobranca-adesao] ✅ Valor corrigido de R$ ${valor} para R$ ${valorPlano} (valor do plano)`);
        valor = valorPlano;
      } else {
        // Se ainda não encontrou valor válido, retornar erro claro
        console.error(`[asaas-cobranca-adesao] ❌ Valor inválido: R$ ${valor}. Valor do plano: ${valorPlano}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Valor de adesão inválido: R$ ${valor.toFixed(2)}. O valor mínimo aceito pelo Asaas é R$ 5,00. Por favor, verifique a configuração do plano.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    console.log(`[asaas-cobranca-adesao] Verificando cobrança existente para contrato ${contratoId}, valor final: R$ ${valor}`);

    // PROTEÇÃO CONTRA DUPLICIDADE: Verificar se já existe cobrança de adesão pendente
    const { data: cobrancaExistente, error: existenteError } = await supabase
      .from('asaas_cobrancas')
      .select('*')
      .eq('contrato_id', contratoId)
      .eq('tipo', 'adesao')
      .in('status', ['PENDING', 'OVERDUE'])
      .maybeSingle();

    if (existenteError) {
      console.warn('[asaas-cobranca-adesao] Erro ao verificar cobrança existente:', existenteError);
    }

    // Se já existe cobrança pendente, retornar ela ao invés de criar nova
    if (cobrancaExistente) {
      console.log(`[asaas-cobranca-adesao] Cobrança existente encontrada: ${cobrancaExistente.id}, retornando dados existentes`);
      
      return new Response(
        JSON.stringify({
          success: true,
          cobranca_id: cobrancaExistente.id,
          asaas_id: cobrancaExistente.asaas_id,
          pix_copia_cola: cobrancaExistente.pix_copia_cola,
          pix_qrcode: cobrancaExistente.pix_qrcode,
          boleto_url: cobrancaExistente.boleto_url,
          linha_digitavel: cobrancaExistente.linha_digitavel,
          valor: cobrancaExistente.valor,
          vencimento: cobrancaExistente.data_vencimento,
          message: 'Cobrança existente retornada',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[asaas-cobranca-adesao] Nenhuma cobrança existente, criando nova para contrato ${contratoId}`);

    // Buscar contrato para obter associado_id
    const { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .select('id, associado_id, lead_id, numero')
      .eq('id', contratoId)
      .single();

    if (contratoError) {
      throw new Error(`Contrato não encontrado: ${contratoError.message}`);
    }

    // Buscar ou criar cliente no Asaas
    let asaasClienteId: string;
    
    // Verificar se já existe cliente com esse CPF
    const searchResult = await asaasRequest(`/customers?cpfCnpj=${cliente.cpfCnpj}`, 'GET');
    
    if (searchResult.data && searchResult.data.length > 0) {
      asaasClienteId = searchResult.data[0].id;
      console.log(`[asaas-cobranca-adesao] Cliente existente encontrado: ${asaasClienteId}`);
    } else {
      // Criar novo cliente
      const novoCliente = await asaasRequest('/customers', 'POST', {
        name: cliente.nome,
        email: cliente.email,
        cpfCnpj: cliente.cpfCnpj,
      });
      asaasClienteId = novoCliente.id;
      console.log(`[asaas-cobranca-adesao] Novo cliente criado: ${asaasClienteId}`);
    }

    // Criar cobrança com PIX e boleto (prazo dinâmico)
    const prazoAdesao = await getConfiguracaoNumero(supabase, 'prazo_vencimento_adesao_dias', 3);
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + prazoAdesao);

    // Criar cobrança com forma de pagamento selecionada
    // Se for UNDEFINED, permite múltiplas formas no link de pagamento
    const cobrancaData = await asaasRequest('/payments', 'POST', {
      customer: asaasClienteId,
      billingType: billingType,
      value: valor,
      dueDate: vencimento.toISOString().split('T')[0],
      description: `Adesão - Contrato ${contrato.numero || contratoId.slice(0, 8)}`,
      externalReference: contratoId,
    });

    console.log(`[asaas-cobranca-adesao] Cobrança criada: ${cobrancaData.id} com billingType: ${billingType}`);

    // Buscar dados do PIX (se aplicável)
    let pixData = null;
    if (billingType === 'PIX' || billingType === 'UNDEFINED') {
      try {
        pixData = await asaasRequest(`/payments/${cobrancaData.id}/pixQrCode`, 'GET');
        console.log('[asaas-cobranca-adesao] Dados PIX obtidos');
      } catch (pixError) {
        console.warn('[asaas-cobranca-adesao] Não foi possível obter PIX:', pixError);
      }
    }

    // Gerar link de pagamento para cartão de crédito
    const linkPagamento = `https://www.asaas.com/c/${cobrancaData.id}`;

    // Salvar cobrança no banco de dados
    // Usar associado_id se existir, ou criar um placeholder para lead
    const associadoId = contrato.associado_id || '00000000-0000-0000-0000-000000000000';

    const { data: cobrancaSalva, error: saveError } = await supabase
      .from('asaas_cobrancas')
      .insert({
        asaas_id: cobrancaData.id,
        asaas_cliente_id: asaasClienteId,
        associado_id: associadoId,
        contrato_id: contratoId,
        tipo: 'adesao',
        valor: valor,
        status: 'PENDING',
        data_emissao: new Date().toISOString(),
        data_vencimento: vencimento.toISOString(),
        boleto_url: cobrancaData.bankSlipUrl,
        linha_digitavel: cobrancaData.nossoNumero,
        pix_copia_cola: pixData?.payload,
        pix_qrcode: pixData?.encodedImage,
        pix_expiracao: pixData?.expirationDate,
        referencia: `adesao-${contratoId}`,
        forma_pagamento: billingType,
      })
      .select()
      .single();

    if (saveError) {
      // TRATAMENTO DE RACE CONDITION: Se erro for de constraint unique (23505), 
      // significa que outra requisição simultânea já inseriu - retorna a existente
      if (saveError.code === '23505') {
        console.log('[asaas-cobranca-adesao] ⚠️ Conflito de duplicata detectado (race condition), buscando cobrança existente...');
        
        // Aguardar um momento para a outra transação commitar
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const { data: cobrancaExistenteDup } = await supabase
          .from('asaas_cobrancas')
          .select('*')
          .eq('contrato_id', contratoId)
          .eq('tipo', 'adesao')
          .not('status', 'in', '(CANCELLED,REFUNDED,REFUND_REQUESTED)')
          .single();

        if (cobrancaExistenteDup) {
          console.log(`[asaas-cobranca-adesao] ✅ Retornando cobrança existente após conflito: ${cobrancaExistenteDup.id}`);
          
          // Tentar cancelar a cobrança recém-criada no Asaas (para evitar duplicata lá também)
          try {
            await asaasRequest(`/payments/${cobrancaData.id}`, 'DELETE');
            console.log(`[asaas-cobranca-adesao] 🗑️ Cobrança duplicada cancelada no Asaas: ${cobrancaData.id}`);
          } catch (cancelError) {
            console.warn('[asaas-cobranca-adesao] Não foi possível cancelar duplicata no Asaas (pode já estar paga):', cancelError);
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              cobranca_id: cobrancaExistenteDup.id,
              asaas_id: cobrancaExistenteDup.asaas_id,
              pix_copia_cola: cobrancaExistenteDup.pix_copia_cola,
              pix_qrcode: cobrancaExistenteDup.pix_qrcode,
              boleto_url: cobrancaExistenteDup.boleto_url,
              linha_digitavel: cobrancaExistenteDup.linha_digitavel,
              valor: cobrancaExistenteDup.valor,
              vencimento: cobrancaExistenteDup.data_vencimento,
              message: 'Cobrança existente retornada (race condition tratada)',
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
      
      console.error('[asaas-cobranca-adesao] ❌ ERRO CRÍTICO ao salvar cobrança no banco:', saveError);
      console.error('[asaas-cobranca-adesao] Dados que tentaram ser inseridos:', {
        asaas_id: cobrancaData.id,
        asaas_cliente_id: asaasClienteId,
        associado_id: associadoId,
        contrato_id: contratoId,
      });
      // Continua mesmo com erro ao salvar - o webhook pode usar fallback via externalReference
    } else {
      console.log('[asaas-cobranca-adesao] ✅ Cobrança salva com sucesso no banco');
    }

    // Registrar no histórico do contrato
    await supabase.from('contratos_historico').insert({
      contrato_id: contratoId,
      evento: 'cobranca_adesao_criada',
      descricao: `Cobrança de adesão no valor de R$ ${valor.toFixed(2)} gerada`,
      dados: { 
        asaas_id: cobrancaData.id, 
        valor, 
        vencimento: vencimento.toISOString() 
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        cobranca_id: cobrancaSalva?.id || cobrancaData.id,
        asaas_id: cobrancaData.id,
        pix_copia_cola: pixData?.payload,
        pix_qrcode: pixData?.encodedImage,
        boleto_url: cobrancaData.bankSlipUrl,
        linha_digitavel: cobrancaData.nossoNumero,
        link_pagamento: linkPagamento, // Link para pagamento com cartão
        invoice_url: cobrancaData.invoiceUrl, // Link da fatura
        valor: valor,
        vencimento: vencimento.toISOString(),
        billing_type: billingType,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    console.error('[asaas-cobranca-adesao] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});