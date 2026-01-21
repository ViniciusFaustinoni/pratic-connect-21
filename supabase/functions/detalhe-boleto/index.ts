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

// Mapeamento de status ASAAS -> App
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

// Helper para fazer requisições à API ASAAS
async function asaasRequest(endpoint: string, method = 'GET'): Promise<any> {
  const url = `${ASAAS_BASE_URL}${endpoint}`;
  console.log(`[ASAAS] ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers: {
      'accept': 'application/json',
      'access_token': ASAAS_API_KEY!,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ASAAS] Erro ${response.status}: ${errorText}`);
    throw new Error(`ASAAS API error: ${response.status}`);
  }

  return response.json();
}

// Buscar QR Code PIX
async function buscarPixQrCode(paymentId: string): Promise<{ qrCode: string; payload: string; expirationDate: string } | null> {
  try {
    const data = await asaasRequest(`/payments/${paymentId}/pixQrCode`);
    return {
      qrCode: data.encodedImage || null,
      payload: data.payload || null,
      expirationDate: data.expirationDate || null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.log(`[PIX] QR Code não disponível para ${paymentId}:`, message);
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.log(`[BOLETO] Identificação não disponível para ${paymentId}:`, message);
    return null;
  }
}

// Extrair referência (mês/ano) da descrição
function extrairReferencia(payment: any): { mes: number; ano: number; label: string } {
  const descricao = payment.description || payment.externalReference || '';
  
  // Tentar extrair mês/ano da descrição (ex: "Mensalidade 01/2026")
  const matchDescricao = descricao.match(/(\d{1,2})\/(\d{4})/);
  if (matchDescricao) {
    return {
      mes: parseInt(matchDescricao[1]),
      ano: parseInt(matchDescricao[2]),
      label: `${matchDescricao[1].padStart(2, '0')}/${matchDescricao[2]}`
    };
  }
  
  // Fallback: usar data de vencimento
  const vencimento = new Date(payment.dueDate);
  return {
    mes: vencimento.getMonth() + 1,
    ano: vencimento.getFullYear(),
    label: `${String(vencimento.getMonth() + 1).padStart(2, '0')}/${vencimento.getFullYear()}`
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[DETALHE-BOLETO] Iniciando busca de detalhes');

    // Verificar API key ASAAS
    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY não configurada');
    }

    // Extrair e validar body
    const { payment_id } = await req.json();
    if (!payment_id) {
      throw new Error('ID do pagamento não fornecido');
    }
    console.log(`[DETALHE-BOLETO] Payment ID: ${payment_id}`);

    // Criar clientes Supabase
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autenticação não fornecido');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[AUTH] Erro:', authError?.message);
      throw new Error('Usuário não autenticado');
    }
    console.log(`[AUTH] Usuário autenticado: ${user.id}`);

    // Buscar associado do usuário
    const { data: associado, error: associadoError } = await supabaseAdmin
      .from('associados')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (associadoError || !associado) {
      console.error('[DB] Associado não encontrado:', associadoError?.message);
      throw new Error('Associado não encontrado para este usuário');
    }
    console.log(`[DB] Associado: ${associado.id}`);

    // Buscar cliente ASAAS vinculado
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('asaas_clientes')
      .select('asaas_id')
      .eq('associado_id', associado.id)
      .single();

    if (clienteError || !cliente) {
      console.error('[DB] Cliente ASAAS não encontrado:', clienteError?.message);
      throw new Error('Cliente ASAAS não encontrado');
    }
    console.log(`[DB] Cliente ASAAS: ${cliente.asaas_id}`);

    // Buscar detalhes do pagamento na API ASAAS
    const payment = await asaasRequest(`/payments/${payment_id}`);
    console.log(`[ASAAS] Pagamento encontrado: ${payment.id}, status: ${payment.status}`);

    // Validar que o pagamento pertence ao cliente correto
    if (payment.customer !== cliente.asaas_id) {
      console.error(`[SECURITY] Pagamento ${payment_id} não pertence ao cliente ${cliente.asaas_id}`);
      throw new Error('Boleto não pertence ao associado');
    }

    // Buscar dados do PIX (se aplicável e pendente)
    let pixData = null;
    const statusPermitePix = ['PENDING', 'OVERDUE'].includes(payment.status);
    const tipoPermitePix = ['PIX', 'UNDEFINED', 'BOLETO'].includes(payment.billingType);
    
    if (statusPermitePix && tipoPermitePix) {
      pixData = await buscarPixQrCode(payment_id);
    }

    // Buscar linha digitável (se aplicável e pendente)
    let boletoData = null;
    const statusPermiteBoleto = ['PENDING', 'OVERDUE'].includes(payment.status);
    const tipoPermiteBoleto = ['BOLETO', 'UNDEFINED'].includes(payment.billingType);
    
    if (statusPermiteBoleto && tipoPermiteBoleto) {
      boletoData = await buscarIdentificacaoBoleto(payment_id);
    }

    // Extrair referência
    const referencia = extrairReferencia(payment);

    // Mapear status
    const statusApp = STATUS_MAP[payment.status] || 'pendente';

    // Calcular valor com encargos
    const valorOriginal = payment.value || 0;
    const juros = payment.interest?.value || 0;
    const multa = payment.fine?.value || 0;
    const desconto = payment.discount?.value || 0;
    const valorFinal = valorOriginal + juros + multa - desconto;

    // Atualizar cache local
    const updateData: Record<string, any> = {
      status: statusApp,
      sincronizado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (pixData) {
      updateData.pix_qrcode = pixData.qrCode;
      updateData.pix_copia_cola = pixData.payload;
      updateData.pix_expiracao = pixData.expirationDate;
    }

    if (boletoData) {
      updateData.linha_digitavel = boletoData.identificationField;
      updateData.boleto_codigo_barras = boletoData.barCode;
      updateData.boleto_nosso_numero = boletoData.nossoNumero;
    }

    if (payment.paymentDate) {
      updateData.data_pagamento = payment.paymentDate;
    }

    if (payment.transactionReceiptUrl) {
      updateData.pagamento_forma = 'PIX';
    }

    if (juros > 0) {
      updateData.juros = juros;
    }

    if (multa > 0) {
      updateData.multa = multa;
    }

    // Atualizar no banco
    const { error: updateError } = await supabaseAdmin
      .from('asaas_cobrancas')
      .update(updateData)
      .eq('asaas_id', payment_id);

    if (updateError) {
      console.warn('[DB] Erro ao atualizar cache:', updateError.message);
    } else {
      console.log('[DB] Cache local atualizado');
    }

    // Montar resposta
    const boleto = {
      id: payment.id,
      valor: valorFinal,
      valorOriginal: valorOriginal,
      valorPago: payment.netValue || null,
      vencimento: payment.dueDate,
      status: statusApp,
      descricao: payment.description || null,
      referencia: referencia.label,
      
      // Boleto
      linha_digitavel: boletoData?.identificationField || null,
      codigo_barras: boletoData?.barCode || null,
      nosso_numero: boletoData?.nossoNumero || null,
      link_pdf: payment.bankSlipUrl || null,
      
      // PIX
      pix_payload: pixData?.payload || null,
      pix_qrcode_base64: pixData?.qrCode || null,
      pix_expiracao: pixData?.expirationDate || null,
      
      // Pagamento
      data_pagamento: payment.paymentDate || null,
      forma_pagamento: payment.billingType || null,
      
      // Encargos
      juros: juros > 0 ? juros : null,
      multa: multa > 0 ? multa : null,
      desconto: desconto > 0 ? desconto : null,
      
      // Metadados
      tipo_cobranca: payment.billingType,
      sandbox: isSandbox,
      
      // URLs
      invoice_url: payment.invoiceUrl || null,
      transaction_receipt_url: payment.transactionReceiptUrl || null,
    };

    console.log(`[DETALHE-BOLETO] Retornando boleto ${payment_id} com status ${statusApp}`);

    return new Response(
      JSON.stringify({
        success: true,
        boleto,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[DETALHE-BOLETO] Erro:', message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: message.includes('não autenticado') ? 401 : 400,
      }
    );
  }
});
