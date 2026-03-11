import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!;

// Detectar ambiente: prioriza ASAAS_ENV, senão infere pelo prefixo da chave
// $aact_ = produção, caso contrário sandbox
function getAsaasBaseUrl() {
  const envExplicito = Deno.env.get('ASAAS_ENV');
  
  let ambiente: 'production' | 'sandbox';
  
  if (envExplicito) {
    ambiente = envExplicito === 'production' ? 'production' : 'sandbox';
    console.log(`[gerar-cobrancas] Ambiente definido por ASAAS_ENV: ${ambiente}`);
  } else {
    // Chaves sandbox contêm '_hmlg_' (homologação)
    const isSandbox = ASAAS_API_KEY?.includes('_hmlg_');
    ambiente = isSandbox ? 'sandbox' : 'production';
    console.log(`[gerar-cobrancas] Ambiente inferido pela chave API: ${ambiente}`);
  }
  
  const baseUrl = ambiente === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
  
  console.log(`[gerar-cobrancas] Base URL: ${baseUrl}`);
  
  return baseUrl;
}

const ASAAS_API_URL = getAsaasBaseUrl();

interface Associado {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  dia_vencimento: number | null;
  plano_id: string | null;
  whatsapp: string | null;
  telefone: string | null;
  planos: {
    nome: string;
  } | null;
  contratos: {
    id: string;
    valor_mensal: number;
    status: string;
  }[] | null;
  asaas_clientes: {
    asaas_id: string;
  }[] | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { mes, ano, forceRegenerate } = await req.json().catch(() => ({}));
    
    const targetMes = mes || new Date().getMonth() + 1;
    const targetAno = ano || new Date().getFullYear();
    const competencia = `${targetAno}-${String(targetMes).padStart(2, '0')}`;
    
    console.log(`[gerar-cobrancas] Gerando cobranças para ${competencia}`);

    // Buscar associados ativos com plano, contrato ativo e cliente ASAAS
    const { data: associados, error: fetchError } = await supabase
      .from('associados')
      .select(`
        id,
        nome,
        email,
        cpf,
        dia_vencimento,
        plano_id,
        whatsapp,
        telefone,
        planos:plano_id (
          nome
        ),
        contratos!inner (
          id,
          valor_mensal,
          status
        ),
        asaas_clientes (
          asaas_id
        )
      `)
      .eq('status', 'ativo')
      .eq('contratos.status', 'ativo')
      .not('plano_id', 'is', null);

    if (fetchError) {
      throw new Error(`Erro ao buscar associados: ${fetchError.message}`);
    }

    console.log(`[gerar-cobrancas] ${associados?.length || 0} associados ativos encontrados`);

    const resultados = {
      total: associados?.length || 0,
      geradas: 0,
      jaExistentes: 0,
      erros: 0,
      whatsappEnviados: 0,
      detalhes: [] as any[],
      errosDetalhes: [] as Array<{ associado_id: string; motivo: string }>,
    };

    for (const associado of (associados || []) as unknown as Associado[]) {
      try {
        // Verificar se já existe cobrança para este mês
        const { data: existente } = await supabase
          .from('asaas_cobrancas')
          .select('id')
          .eq('associado_id', associado.id)
          .eq('competencia', competencia)
          .eq('tipo', 'mensalidade')
          .maybeSingle();

        if (existente && !forceRegenerate) {
          resultados.jaExistentes++;
          continue;
        }

        // Calcular data de vencimento
        const diaVenc = associado.dia_vencimento || 10;
        const dataVencimento = new Date(targetAno, targetMes - 1, diaVenc);
        
        // Ajustar se data já passou
        if (dataVencimento < new Date()) {
          dataVencimento.setMonth(dataVencimento.getMonth() + 1);
        }

        // Buscar valor mensal do contrato ativo
        const contrato = associado.contratos?.[0];
        const valorMensalidade = contrato?.valor_mensal;

        if (!valorMensalidade || valorMensalidade <= 0) {
          console.error(`[gerar-cobrancas] Associado ${associado.id} (${associado.nome}) sem contrato ativo com valor_mensal válido. Cobrança NÃO gerada.`);
          resultados.errosDetalhes.push({ associado_id: associado.id, motivo: 'sem_contrato_ativo_com_valor' });
          resultados.erros++;
          continue;
        }

        const asaasClienteId = associado.asaas_clientes?.[0]?.asaas_id;

        // Criar cobrança no ASAAS se tiver cliente cadastrado
        let asaasCobranca: any = null;
        if (asaasClienteId && ASAAS_API_KEY) {
          const asaasResponse = await fetch(`${ASAAS_API_URL}/payments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY,
            },
            body: JSON.stringify({
              customer: asaasClienteId,
              billingType: 'BOLETO',
              value: valorMensalidade,
              dueDate: dataVencimento.toISOString().split('T')[0],
              description: `Mensalidade ${competencia} - ${associado.nome}`,
              externalReference: `${associado.id}-${competencia}`,
            }),
          });

          if (asaasResponse.ok) {
            asaasCobranca = await asaasResponse.json();
            console.log(`[gerar-cobrancas] Cobrança ASAAS criada: ${asaasCobranca.id}`);
            
            // Buscar dados do PIX (endpoint separado)
            try {
              const pixResponse = await fetch(`${ASAAS_API_URL}/payments/${asaasCobranca.id}/pixQrCode`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'access_token': ASAAS_API_KEY,
                },
              });

              if (pixResponse.ok) {
                const pixData = await pixResponse.json();
                asaasCobranca.pixPayload = pixData.payload;
                asaasCobranca.pixEncodedImage = pixData.encodedImage;
                console.log(`[gerar-cobrancas] PIX obtido para ${asaasCobranca.id}`);
              } else {
                console.warn(`[gerar-cobrancas] PIX não disponível para ${asaasCobranca.id}`);
              }
            } catch (pixError) {
              console.warn(`[gerar-cobrancas] Erro ao buscar PIX:`, pixError);
            }
          } else {
            const errorText = await asaasResponse.text();
            console.error(`[gerar-cobrancas] Erro ASAAS: ${errorText}`);
          }
        }

        // Inserir cobrança no banco
        const { error: insertError } = await supabase
          .from('asaas_cobrancas')
          .insert({
            associado_id: associado.id,
            asaas_id: asaasCobranca?.id || `LOCAL-${Date.now()}-${associado.id.slice(0, 8)}`,
            tipo: 'mensalidade',
            competencia,
            valor: valorMensalidade,
            data_emissao: new Date().toISOString().split('T')[0],
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            status: 'PENDING',
            boleto_url: asaasCobranca?.bankSlipUrl,
            linha_digitavel: asaasCobranca?.nossoNumero,
            pix_copia_cola: asaasCobranca?.pixPayload || null,
            pix_qrcode: asaasCobranca?.pixEncodedImage ? `data:image/png;base64,${asaasCobranca.pixEncodedImage}` : null,
          });

        if (insertError) {
          throw new Error(`Erro ao inserir: ${insertError.message}`);
        }

        // Enviar WhatsApp com PIX para o associado
        let whatsappEnviado = false;
        const telefone = associado.whatsapp || associado.telefone;
        if (telefone && asaasCobranca?.pixPayload) {
          try {
            const valorFormatado = valorMensalidade.toLocaleString('pt-BR', { 
              style: 'currency', 
              currency: 'BRL' 
            });
            const dataFormatada = dataVencimento.toLocaleDateString('pt-BR');
            const nomeAbreviado = associado.nome.split(' ')[0];
            
            const mensagem = `📄 *Nova Fatura Disponível*

Olá ${nomeAbreviado}! 👋

Sua mensalidade de *${valorFormatado}* está disponível.

📅 Vencimento: *${dataFormatada}*

💠 *PIX Copia e Cola:*
\`${asaasCobranca.pixPayload}\`

📱 Basta copiar o código acima e colar no seu banco!

${asaasCobranca.nossoNumero ? `📊 *Linha Digitável:*\n${asaasCobranca.nossoNumero}\n\n` : ''}Pague agora e evite atrasos! 😊`;

            await supabase.functions.invoke('whatsapp-send-text', {
              body: {
                telefone: telefone.replace(/\D/g, ''),
                mensagem,
                delay_ms: 500,
                template_name: 'cobranca_mensalidade',
                template_params: [nomeAbreviado, valorFormatado, dataFormatada],
              },
            });
            
            whatsappEnviado = true;
            resultados.whatsappEnviados++;
            console.log(`[gerar-cobrancas] WhatsApp enviado para ${associado.nome}`);
          } catch (whatsError) {
            console.error(`[gerar-cobrancas] Erro WhatsApp para ${associado.nome}:`, whatsError);
          }
        }

        resultados.geradas++;
        resultados.detalhes.push({
          associado: associado.nome,
          valor: valorMensalidade,
          vencimento: dataVencimento.toISOString().split('T')[0],
          asaas_id: asaasCobranca?.id,
          pix_disponivel: !!asaasCobranca?.pixPayload,
          whatsapp_enviado: whatsappEnviado,
        });

      } catch (error: any) {
        console.error(`[gerar-cobrancas] Erro para ${associado.nome}:`, error.message);
        resultados.erros++;
        resultados.detalhes.push({
          associado: associado.nome,
          erro: error.message,
        });
      }
    }

    console.log(`[gerar-cobrancas] Resultado: ${resultados.geradas} geradas, ${resultados.jaExistentes} já existentes, ${resultados.whatsappEnviados} WhatsApp enviados, ${resultados.erros} erros`);

    return new Response(JSON.stringify(resultados), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[gerar-cobrancas] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
