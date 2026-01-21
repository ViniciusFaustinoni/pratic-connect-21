import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
const isSandbox = ASAAS_API_KEY?.includes('_hmlg_') || ASAAS_API_KEY?.startsWith('$aact_hmlg');
const ASAAS_BASE_URL = isSandbox
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Mapeamento de status ASAAS para status do App
const STATUS_MAP: Record<string, string> = {
  'PENDING': 'pendente',
  'RECEIVED': 'pago',
  'CONFIRMED': 'pago',
  'OVERDUE': 'vencido',
  'REFUNDED': 'estornado',
  'RECEIVED_IN_CASH': 'pago',
  'REFUND_REQUESTED': 'processando',
  'REFUND_IN_PROGRESS': 'processando',
  'CHARGEBACK_REQUESTED': 'processando',
  'CHARGEBACK_DISPUTE': 'processando',
  'AWAITING_CHARGEBACK_REVERSAL': 'processando',
  'DUNNING_REQUESTED': 'processando',
  'DUNNING_RECEIVED': 'pago',
  'AWAITING_RISK_ANALYSIS': 'processando',
  'CANCELED': 'cancelado',
};

// Fazer requisição para API ASAAS
async function asaasRequest(endpoint: string, method = 'GET'): Promise<any> {
  const url = `${ASAAS_BASE_URL}${endpoint}`;
  console.log(`[ASAAS] ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers: {
      'access_token': ASAAS_API_KEY!,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ASAAS] Error ${response.status}: ${errorText}`);
    throw new Error(`ASAAS API error: ${response.status}`);
  }

  return response.json();
}

// Buscar QR Code do PIX para um pagamento
async function buscarPixQrCode(paymentId: string): Promise<{ qrCode: string; payload: string; expirationDate: string } | null> {
  try {
    const data = await asaasRequest(`/payments/${paymentId}/pixQrCode`);
    return {
      qrCode: data.encodedImage || null,
      payload: data.payload || null,
      expirationDate: data.expirationDate || null,
    };
  } catch (error) {
    console.error(`[ASAAS] Erro ao buscar PIX para ${paymentId}:`, error);
    return null;
  }
}

// Buscar linha digitável do boleto
async function buscarIdentificacaoBoleto(paymentId: string): Promise<{ identificationField: string; nossoNumero: string; barCode: string } | null> {
  try {
    const data = await asaasRequest(`/payments/${paymentId}/identificationField`);
    return {
      identificationField: data.identificationField || null,
      nossoNumero: data.nossoNumero || null,
      barCode: data.barCode || null,
    };
  } catch (error) {
    console.error(`[ASAAS] Erro ao buscar boleto para ${paymentId}:`, error);
    return null;
  }
}

// Extrair referência (mês/ano) do campo description ou externalReference
function extrairReferencia(payment: any): { mes: number; ano: number; label: string } {
  const now = new Date();
  const defaultRef = {
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
    label: `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
  };

  // Tentar extrair de externalReference ou description
  const ref = payment.externalReference || payment.description || '';
  
  // Padrões comuns: "01/2026", "2026-01", "Janeiro/2026"
  const matchMesAno = ref.match(/(\d{1,2})[\/\-](\d{4})/);
  if (matchMesAno) {
    const mes = parseInt(matchMesAno[1]);
    const ano = parseInt(matchMesAno[2]);
    if (mes >= 1 && mes <= 12) {
      return { mes, ano, label: `${String(mes).padStart(2, '0')}/${ano}` };
    }
  }

  // Padrão: "2026-01" (ano-mês)
  const matchAnoMes = ref.match(/(\d{4})[\/\-](\d{1,2})/);
  if (matchAnoMes) {
    const ano = parseInt(matchAnoMes[1]);
    const mes = parseInt(matchAnoMes[2]);
    if (mes >= 1 && mes <= 12) {
      return { mes, ano, label: `${String(mes).padStart(2, '0')}/${ano}` };
    }
  }

  // Usar data de vencimento como fallback
  if (payment.dueDate) {
    const dueDate = new Date(payment.dueDate);
    return {
      mes: dueDate.getMonth() + 1,
      ano: dueDate.getFullYear(),
      label: `${String(dueDate.getMonth() + 1).padStart(2, '0')}/${dueDate.getFullYear()}`,
    };
  }

  return defaultRef;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar API Key
    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY não configurada');
    }

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autenticação não fornecido');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Criar cliente Supabase com token do usuário para autenticação
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Criar cliente com service role para operações administrativas
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verificar usuário autenticado
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      console.error('[AUTH] Erro de autenticação:', authError);
      throw new Error('Usuário não autenticado');
    }

    console.log(`[AUTH] Usuário autenticado: ${user.id}`);

    // Buscar associado vinculado ao usuário
    const { data: associado, error: assocError } = await supabaseAdmin
      .from('associados')
      .select('id, nome')
      .eq('user_id', user.id)
      .maybeSingle();

    if (assocError) {
      console.error('[DB] Erro ao buscar associado:', assocError);
      throw new Error('Erro ao buscar dados do associado');
    }

    if (!associado) {
      console.log('[DB] Nenhum associado vinculado ao usuário');
      return new Response(
        JSON.stringify({ success: true, boletos: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[DB] Associado encontrado: ${associado.id} - ${associado.nome}`);

    // Buscar customer_id ASAAS do associado
    const { data: asaasCliente, error: clienteError } = await supabaseAdmin
      .from('asaas_clientes')
      .select('asaas_id')
      .eq('associado_id', associado.id)
      .maybeSingle();

    if (clienteError) {
      console.error('[DB] Erro ao buscar cliente ASAAS:', clienteError);
      throw new Error('Erro ao buscar dados de pagamento');
    }

    if (!asaasCliente) {
      console.log('[DB] Nenhum cliente ASAAS vinculado');
      return new Response(
        JSON.stringify({ success: true, boletos: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ASAAS] Customer ID: ${asaasCliente.asaas_id}`);

    // Buscar pagamentos do cliente na API ASAAS
    const paymentsData = await asaasRequest(
      `/payments?customer=${asaasCliente.asaas_id}&limit=50&offset=0`
    );

    console.log(`[ASAAS] Encontrados ${paymentsData.data?.length || 0} pagamentos`);

    // Processar cada pagamento
    const boletos = await Promise.all(
      (paymentsData.data || []).map(async (payment: any) => {
        const statusApp = STATUS_MAP[payment.status] || 'pendente';
        const referencia = extrairReferencia(payment);
        
        // Buscar dados do PIX se for pagamento pendente com PIX habilitado
        let pixData = null;
        if (
          (payment.billingType === 'PIX' || payment.billingType === 'UNDEFINED') &&
          ['PENDING', 'OVERDUE'].includes(payment.status)
        ) {
          pixData = await buscarPixQrCode(payment.id);
        }

        // Buscar linha digitável se for boleto pendente
        let boletoData = null;
        if (
          (payment.billingType === 'BOLETO' || payment.billingType === 'UNDEFINED') &&
          ['PENDING', 'OVERDUE'].includes(payment.status)
        ) {
          boletoData = await buscarIdentificacaoBoleto(payment.id);
        }

        // Atualizar cache local (asaas_cobrancas)
        const updateData: any = {
          status: statusApp,
          sincronizado_em: new Date().toISOString(),
        };

        if (payment.paymentDate) {
          updateData.data_pagamento = payment.paymentDate;
          updateData.pagamento_data = payment.paymentDate;
        }
        if (payment.netValue) {
          updateData.valor_liquido = payment.netValue;
        }
        if (payment.value) {
          updateData.valor = payment.value;
        }
        if (pixData?.payload) {
          updateData.pix_copia_cola = pixData.payload;
        }
        if (pixData?.qrCode) {
          updateData.pix_qrcode = pixData.qrCode;
        }
        if (pixData?.expirationDate) {
          updateData.pix_expiracao = pixData.expirationDate;
        }
        if (boletoData?.identificationField) {
          updateData.linha_digitavel = boletoData.identificationField;
        }
        if (boletoData?.barCode) {
          updateData.boleto_codigo_barras = boletoData.barCode;
        }
        if (boletoData?.nossoNumero) {
          updateData.boleto_nosso_numero = boletoData.nossoNumero;
        }
        if (payment.bankSlipUrl) {
          updateData.boleto_url = payment.bankSlipUrl;
        }

        // Atualizar registro no banco
        await supabaseAdmin
          .from('asaas_cobrancas')
          .update(updateData)
          .eq('asaas_id', payment.id);

        return {
          id: payment.id,
          referencia: referencia.label,
          competenciaMes: referencia.mes,
          competenciaAno: referencia.ano,
          valor: payment.value,
          valorFinal: payment.value,
          valorPago: payment.netValue || null,
          vencimento: payment.dueDate,
          status: statusApp,
          linhaDigitavel: boletoData?.identificationField || payment.nossoNumero || null,
          codigoBarras: boletoData?.barCode || null,
          pixCopiaCola: pixData?.payload || null,
          pixQrCode: pixData?.qrCode || null,
          pixExpiracao: pixData?.expirationDate || null,
          dataPagamento: payment.paymentDate || null,
          linkBoleto: payment.bankSlipUrl || null,
          invoiceUrl: payment.invoiceUrl || null,
          tipo: payment.billingType,
          descricao: payment.description || null,
        };
      })
    );

    // Ordenar por vencimento (mais recentes primeiro)
    boletos.sort((a, b) => {
      const dateA = new Date(a.vencimento);
      const dateB = new Date(b.vencimento);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`[SUCCESS] Retornando ${boletos.length} boletos`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        boletos,
        sandbox: isSandbox,
        total: boletos.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ERROR]', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno',
        boletos: [],
      }),
      { 
        status: 200, // Retornar 200 mesmo com erro para fallback funcionar
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
