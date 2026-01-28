import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
// Chaves sandbox contêm '_hmlg_' (homologação)
const isSandbox = ASAAS_API_KEY?.includes('_hmlg_');
const ASAAS_BASE_URL = isSandbox
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CobrancaRequest {
  action: 'criar' | 'buscar' | 'cancelar' | 'segunda_via' | 'listar';
  cobranca_id?: string;
  asaas_id?: string;
  associado_id?: string;
  dados?: {
    customer: string;
    billingType: 'BOLETO' | 'PIX' | 'UNDEFINED';
    value: number;
    dueDate: string;
    description?: string;
    externalReference?: string;
    tipo?: string;
    competencia?: string;
    veiculo_id?: string;
    contrato_id?: string;
    desconto?: number;
  };
}

async function asaasRequest(endpoint: string, method: string, body?: object) {
  const url = `${ASAAS_BASE_URL}${endpoint}`;
  console.log(`[asaas-cobrancas] ${method} ${url}`);
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY!,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error(`[asaas-cobrancas] Erro ASAAS:`, data);
    throw new Error(data.errors?.[0]?.description || `Erro ASAAS: ${response.status}`);
  }

  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY não configurada');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, cobranca_id, asaas_id, associado_id, dados }: CobrancaRequest = await req.json();

    console.log(`[asaas-cobrancas] Action: ${action}`);

    let result;

    switch (action) {
      case 'criar': {
        if (!dados) throw new Error('Dados da cobrança são obrigatórios');

        // CORREÇÃO: Buscar asaas_id do cliente pelo associado_id se não fornecido
        let customerAsaasId = dados.customer;
        
        if (!customerAsaasId && associado_id) {
          const { data: clienteAsaas, error: clienteError } = await supabase
            .from('asaas_clientes')
            .select('asaas_id')
            .eq('associado_id', associado_id)
            .maybeSingle();
          
          if (clienteError) {
            console.error('[asaas-cobrancas] Erro ao buscar cliente:', clienteError);
          }
          
          if (!clienteAsaas?.asaas_id) {
            throw new Error('Cliente não sincronizado com ASAAS. Sincronize o cliente primeiro.');
          }
          
          customerAsaasId = clienteAsaas.asaas_id;
          console.log(`[asaas-cobrancas] Cliente ASAAS encontrado: ${customerAsaasId}`);
        }
        
        if (!customerAsaasId) {
          throw new Error('customer ou associado_id é obrigatório para criar cobrança');
        }

        // Criar cobrança no ASAAS
        const asaasCobranca = await asaasRequest('/payments', 'POST', {
          customer: customerAsaasId,
          billingType: dados.billingType,
          value: dados.value,
          dueDate: dados.dueDate,
          description: dados.description || `Cobrança ${dados.tipo || 'mensalidade'}`,
          externalReference: dados.externalReference,
          fine: {
            value: 2,
            type: 'PERCENTAGE',
          },
          interest: {
            value: 1,
            type: 'PERCENTAGE',
          },
          discount: dados.desconto ? {
            value: dados.desconto,
            dueDateLimitDays: 0,
            type: 'FIXED',
          } : undefined,
        });

        console.log(`[asaas-cobrancas] Cobrança criada: ${asaasCobranca.id}`);

        // Buscar dados do PIX se aplicável
        let pixData = null;
        if (dados.billingType === 'PIX' || dados.billingType === 'UNDEFINED') {
          try {
            pixData = await asaasRequest(`/payments/${asaasCobranca.id}/pixQrCode`, 'GET');
          } catch (e) {
            console.log('[asaas-cobrancas] PIX não disponível ainda');
          }
        }

        // Buscar associado_id a partir do customer
        let finalAssociadoId = associado_id;
        if (!finalAssociadoId && dados.customer) {
          const { data: cliente } = await supabase
            .from('asaas_clientes')
            .select('associado_id')
            .eq('asaas_id', dados.customer)
            .maybeSingle();
          finalAssociadoId = cliente?.associado_id;
        }

        if (!finalAssociadoId) {
          throw new Error('Não foi possível identificar o associado');
        }

        // Salvar no banco
        const { data: cobrancaSalva, error: insertError } = await supabase
          .from('asaas_cobrancas')
          .insert({
            asaas_id: asaasCobranca.id,
            asaas_cliente_id: dados.customer,
            associado_id: finalAssociadoId,
            veiculo_id: dados.veiculo_id || null,
            contrato_id: dados.contrato_id || null,
            tipo: dados.tipo || 'mensalidade',
            competencia: dados.competencia,
            referencia: dados.externalReference,
            valor: dados.value,
            desconto: dados.desconto || 0,
            data_emissao: new Date().toISOString().split('T')[0],
            data_vencimento: dados.dueDate,
            status: asaasCobranca.status,
            forma_pagamento: dados.billingType,
            boleto_url: asaasCobranca.bankSlipUrl,
            boleto_codigo_barras: asaasCobranca.barCode,
            boleto_nosso_numero: asaasCobranca.nossoNumero,
            linha_digitavel: asaasCobranca.identificationField,
            pix_qrcode: pixData?.encodedImage,
            pix_copia_cola: pixData?.payload,
            pix_expiracao: pixData?.expirationDate,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`[asaas-cobrancas] Erro ao salvar:`, insertError);
          throw new Error('Erro ao salvar cobrança no banco');
        }

        result = { 
          success: true, 
          cobranca: cobrancaSalva,
          asaas: asaasCobranca,
          pix: pixData,
        };
        break;
      }

      case 'buscar': {
        if (asaas_id) {
          const asaasCobranca = await asaasRequest(`/payments/${asaas_id}`, 'GET');
          
          // Buscar dados do PIX
          let pixData = null;
          if (asaasCobranca.billingType === 'PIX' || asaasCobranca.billingType === 'UNDEFINED') {
            try {
              pixData = await asaasRequest(`/payments/${asaas_id}/pixQrCode`, 'GET');
            } catch (e) {
              console.log('[asaas-cobrancas] PIX não disponível');
            }
          }

          result = { success: true, cobranca: asaasCobranca, pix: pixData };
        } else if (cobranca_id) {
          const { data: cobranca } = await supabase
            .from('asaas_cobrancas')
            .select('*, associado:associados(nome, cpf, telefone, whatsapp)')
            .eq('id', cobranca_id)
            .single();
          
          if (cobranca?.asaas_id) {
            const asaasCobranca = await asaasRequest(`/payments/${cobranca.asaas_id}`, 'GET');
            result = { success: true, cobranca, asaas: asaasCobranca };
          } else {
            result = { success: false, message: 'Cobrança não encontrada' };
          }
        } else {
          throw new Error('asaas_id ou cobranca_id é obrigatório');
        }
        break;
      }

      case 'listar': {
        if (!associado_id) throw new Error('associado_id é obrigatório');

        const { data: cobrancas } = await supabase
          .from('asaas_cobrancas')
          .select('*')
          .eq('associado_id', associado_id)
          .order('data_vencimento', { ascending: false });

        result = { success: true, cobrancas: cobrancas || [] };
        break;
      }

      case 'cancelar': {
        if (!asaas_id) throw new Error('asaas_id é obrigatório');

        const asaasCobranca = await asaasRequest(`/payments/${asaas_id}`, 'DELETE');

        // Atualizar no banco
        await supabase
          .from('asaas_cobrancas')
          .update({ 
            status: 'CANCELLED',
            updated_at: new Date().toISOString(),
          })
          .eq('asaas_id', asaas_id);

        result = { success: true, message: 'Cobrança cancelada' };
        break;
      }

      case 'segunda_via': {
        if (!asaas_id) throw new Error('asaas_id é obrigatório');

        // Buscar cobrança atual
        const asaasCobranca = await asaasRequest(`/payments/${asaas_id}`, 'GET');

        // Buscar dados do PIX atualizados
        let pixData = null;
        try {
          pixData = await asaasRequest(`/payments/${asaas_id}/pixQrCode`, 'GET');
        } catch (e) {
          console.log('[asaas-cobrancas] PIX não disponível');
        }

        // Atualizar no banco com dados mais recentes
        await supabase
          .from('asaas_cobrancas')
          .update({
            boleto_url: asaasCobranca.bankSlipUrl,
            boleto_codigo_barras: asaasCobranca.barCode,
            linha_digitavel: asaasCobranca.identificationField,
            pix_qrcode: pixData?.encodedImage,
            pix_copia_cola: pixData?.payload,
            pix_expiracao: pixData?.expirationDate,
            updated_at: new Date().toISOString(),
          })
          .eq('asaas_id', asaas_id);

        result = { 
          success: true, 
          cobranca: asaasCobranca,
          pix: pixData,
          boletoUrl: asaasCobranca.bankSlipUrl,
        };
        break;
      }

      default:
        throw new Error(`Ação não suportada: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[asaas-cobrancas] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
