import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!;

function getAsaasBaseUrl() {
  const envExplicito = Deno.env.get('ASAAS_ENV');
  let ambiente: 'production' | 'sandbox';
  
  if (envExplicito) {
    ambiente = envExplicito === 'production' ? 'production' : 'sandbox';
  } else {
    const isSandbox = ASAAS_API_KEY?.includes('_hmlg_');
    ambiente = isSandbox ? 'sandbox' : 'production';
  }
  
  return ambiente === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
}

const ASAAS_API_URL = getAsaasBaseUrl();

interface FaturasRequest {
  fechamento_id?: string;
  mes?: number;
  ano?: number;
  preview?: boolean; // Se true, retorna preview sem criar boletos
  enviar_whatsapp?: boolean;
  limite?: number; // Para processar em lotes
}

interface ComposicaoFatura {
  taxa_administrativa: number;
  rateio_colisao: number;
  rateio_roubo_furto: number;
  rateio_incendio: number;
  rateio_vidros: number;
  rateio_terceiros: number;
  rateio_assistencia: number;
  adicionais: number;
  adicionais_detalhes: Record<string, number>;
  fator_prorata: number;
  total: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body: FaturasRequest = await req.json().catch(() => ({}));
    
    let fechamentoId = body.fechamento_id;
    
    // Buscar fechamento pelo mês/ano se não passou ID
    if (!fechamentoId && body.mes && body.ano) {
      const { data: fechamento } = await supabase
        .from('fechamentos_mensais')
        .select('id')
        .eq('mes', body.mes)
        .eq('ano', body.ano)
        .single();
      
      if (fechamento) fechamentoId = fechamento.id;
    }

    if (!fechamentoId) {
      throw new Error('Fechamento não encontrado. Informe fechamento_id ou mes/ano');
    }

    // 1. Buscar fechamento e verificar status
    const { data: fechamento, error: fetchError } = await supabase
      .from('fechamentos_mensais')
      .select('*, despesas_rateio(*)')
      .eq('id', fechamentoId)
      .single();

    if (fetchError || !fechamento) {
      throw new Error(`Fechamento não encontrado: ${fetchError?.message}`);
    }

    if (fechamento.status !== 'aprovado' && !body.preview) {
      throw new Error(`Fechamento deve estar aprovado para gerar faturas. Status atual: ${fechamento.status}`);
    }

    console.log(`[gerar-faturas] Processando fechamento ${fechamento.mes}/${fechamento.ano}`);

    // 2. Criar mapa de valor por cota por benefício
    const valorPorCotaBeneficio: Record<string, number> = {};
    for (const despesa of (fechamento.despesas_rateio || [])) {
      valorPorCotaBeneficio[despesa.tipo_beneficio] = despesa.valor_por_cota || 0;
    }

    console.log('[gerar-faturas] Valores por cota:', valorPorCotaBeneficio);

    // 3. Buscar associados ativos com veículos e faixas
    const { data: associados, error: assocError } = await supabase
      .from('associados')
      .select(`
        id,
        nome,
        email,
        cpf,
        dia_vencimento,
        whatsapp,
        telefone,
        data_adesao,
        veiculos (
          id,
          placa,
          status,
          quantidade_cotas,
          faixa_cota_id,
          valor_fipe,
          cobertura_total,
          cobertura_roubo_furto,
          cobertura_vidros,
          cobertura_terceiros,
          cobertura_assistencia,
          faixas_cotas:faixa_cota_id (
            id,
            quantidade_cotas,
            fipe_de,
            fipe_ate
          )
        ),
        asaas_clientes (
          asaas_id
        )
      `)
      .eq('status', 'ativo')
      .limit(body.limite || 500);

    if (assocError) {
      throw new Error(`Erro ao buscar associados: ${assocError.message}`);
    }

    // 4. Buscar taxas administrativas por faixa
    const { data: taxasAdmin } = await supabase
      .from('faixas_taxa_administrativa')
      .select('*')
      .eq('ativo', true)
      .order('fipe_de', { ascending: true });

    const taxasMap = taxasAdmin || [];

    // Função para buscar taxa administrativa por valor FIPE
    function getTaxaAdministrativa(valorFipe: number): number {
      const faixa = taxasMap.find(t => valorFipe >= t.fipe_de && valorFipe <= t.fipe_ate);
      return faixa?.valor_taxa || 49.90; // Default
    }

    // Função para calcular pró-rata
    function calcularProRata(dataAdesao: string | null, mes: number, ano: number): number {
      if (!dataAdesao) return 1;
      
      const adesao = new Date(dataAdesao);
      const inicioMes = new Date(ano, mes - 1, 1);
      const fimMes = new Date(ano, mes, 0);
      
      if (adesao <= inicioMes) return 1;
      if (adesao > fimMes) return 0;
      
      const diasMes = fimMes.getDate();
      const diasAtivos = fimMes.getDate() - adesao.getDate() + 1;
      
      return Math.max(0, Math.min(1, diasAtivos / diasMes));
    }

    console.log(`[gerar-faturas] ${associados?.length || 0} associados para processar`);

    const competencia = `${fechamento.ano}-${String(fechamento.mes).padStart(2, '0')}`;
    const resultados = {
      total: associados?.length || 0,
      geradas: 0,
      jaExistentes: 0,
      erros: 0,
      whatsappEnviados: 0,
      preview: body.preview,
      faturas: [] as any[],
    };

    // 5. Processar cada associado
    for (const associado of (associados || [])) {
      try {
        // Pegar primeiro veículo ativo
        const veiculos = (associado.veiculos || []).filter((v: any) => v.status === 'ativo');
        if (veiculos.length === 0) continue;
        
        const veiculo = veiculos[0] as any;
        const valorFipe = veiculo.valor_fipe || 50000;
        const cotas = veiculo.quantidade_cotas || 
                      (veiculo.faixas_cotas as any)?.quantidade_cotas || 
                      Math.ceil(valorFipe / 5000);

        // Calcular composição da fatura
        const proRata = calcularProRata(associado.data_adesao, fechamento.mes, fechamento.ano);
        
        // Calcular composição da fatura verificando cobertura específica de cada benefício
        const composicao: ComposicaoFatura = {
          taxa_administrativa: getTaxaAdministrativa(valorFipe),
          // Colisão e incêndio requerem cobertura total
          rateio_colisao: veiculo.cobertura_total ? (valorPorCotaBeneficio['colisao'] || 0) * cotas : 0,
          rateio_incendio: veiculo.cobertura_total ? (valorPorCotaBeneficio['incendio'] || 0) * cotas : 0,
          // Roubo/furto: cobertura específica OU cobertura total
          rateio_roubo_furto: (veiculo.cobertura_roubo_furto || veiculo.cobertura_total) 
            ? (valorPorCotaBeneficio['roubo_furto'] || 0) * cotas : 0,
          // Vidros: cobertura específica (não depende de cobertura_total)
          rateio_vidros: veiculo.cobertura_vidros ? (valorPorCotaBeneficio['vidros'] || 0) * cotas : 0,
          // Terceiros: cobertura específica (não depende de cobertura_total)
          rateio_terceiros: veiculo.cobertura_terceiros ? (valorPorCotaBeneficio['terceiros'] || 0) * cotas : 0,
          // Assistência 24h: cobertura específica (true por padrão)
          rateio_assistencia: veiculo.cobertura_assistencia !== false 
            ? (valorPorCotaBeneficio['assistencia'] || 0) * cotas : 0,
          adicionais: 0, // TODO: buscar adicionais do contrato (rastreador, etc)
          adicionais_detalhes: {},
          fator_prorata: proRata,
          total: 0,
        };

        // Calcular total
        const subtotalRateio = composicao.rateio_colisao + 
                               composicao.rateio_roubo_furto + 
                               composicao.rateio_incendio +
                               composicao.rateio_vidros +
                               composicao.rateio_terceiros +
                               composicao.rateio_assistencia;
        
        composicao.total = (composicao.taxa_administrativa + subtotalRateio + composicao.adicionais) * proRata;

        // Se é preview, apenas adicionar ao resultado
        if (body.preview) {
          resultados.faturas.push({
            associado_id: associado.id,
            associado_nome: associado.nome,
            veiculo_placa: veiculo.placa,
            valor_fipe: valorFipe,
            cotas,
            composicao,
          });
          resultados.geradas++;
          continue;
        }

        // Verificar se já existe cobrança
        const { data: existente } = await supabase
          .from('asaas_cobrancas')
          .select('id')
          .eq('associado_id', associado.id)
          .eq('mes_referencia', fechamento.mes)
          .eq('ano_referencia', fechamento.ano)
          .eq('modelo_cobranca', 'rateio')
          .maybeSingle();

        if (existente) {
          resultados.jaExistentes++;
          continue;
        }

        // Calcular data de vencimento
        const diaVenc = associado.dia_vencimento || 10;
        const dataVencimento = new Date(fechamento.ano, fechamento.mes, diaVenc);
        if (dataVencimento < new Date()) {
          dataVencimento.setMonth(dataVencimento.getMonth() + 1);
        }

        // Criar cobrança no ASAAS
        const asaasClienteId = associado.asaas_clientes?.[0]?.asaas_id;
        let asaasCobranca: any = null;

        if (asaasClienteId && ASAAS_API_KEY && composicao.total > 0) {
          const descricao = `Fatura ${competencia} - ${associado.nome}\nTaxa Admin: R$ ${composicao.taxa_administrativa.toFixed(2)}\nRateio: R$ ${subtotalRateio.toFixed(2)}`;
          
          const asaasResponse = await fetch(`${ASAAS_API_URL}/payments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY,
            },
            body: JSON.stringify({
              customer: asaasClienteId,
              billingType: 'UNDEFINED', // Permite boleto e PIX
              value: Math.round(composicao.total * 100) / 100,
              dueDate: dataVencimento.toISOString().split('T')[0],
              description: descricao,
              externalReference: `${associado.id}-${competencia}-rateio`,
            }),
          });

          if (asaasResponse.ok) {
            asaasCobranca = await asaasResponse.json();
            
            // Buscar QRCode PIX
            try {
              const pixResponse = await fetch(`${ASAAS_API_URL}/payments/${asaasCobranca.id}/pixQrCode`, {
                headers: { 'access_token': ASAAS_API_KEY },
              });
              if (pixResponse.ok) {
                const pixData = await pixResponse.json();
                asaasCobranca.pixPayload = pixData.payload;
                asaasCobranca.pixEncodedImage = pixData.encodedImage;
              }
            } catch (e) {
              console.warn('[gerar-faturas] Erro ao buscar PIX:', e);
            }
          } else {
            const errorText = await asaasResponse.text();
            console.error(`[gerar-faturas] Erro ASAAS para ${associado.nome}:`, errorText);
          }
        }

        // Inserir cobrança no banco
        const { data: cobrancaInserida, error: insertError } = await supabase
          .from('asaas_cobrancas')
          .insert({
            associado_id: associado.id,
            asaas_id: asaasCobranca?.id || `LOCAL-${Date.now()}-${associado.id.slice(0, 8)}`,
            tipo: 'mensalidade_rateio',
            competencia,
            valor: composicao.total,
            data_emissao: new Date().toISOString().split('T')[0],
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            status: 'PENDING',
            boleto_url: asaasCobranca?.bankSlipUrl,
            pix_copia_cola: asaasCobranca?.pixPayload,
            pix_qrcode: asaasCobranca?.pixEncodedImage ? `data:image/png;base64,${asaasCobranca.pixEncodedImage}` : null,
            fechamento_id: fechamentoId,
            mes_referencia: fechamento.mes,
            ano_referencia: fechamento.ano,
            modelo_cobranca: 'rateio',
            composicao_resumo: composicao,
            veiculo_id: veiculo.id,
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`Erro ao inserir cobrança: ${insertError.message}`);
        }

        // Inserir composição detalhada
        if (cobrancaInserida) {
          await supabase.from('cobrancas_composicao').insert({
            cobranca_id: cobrancaInserida.id,
            valor_taxa_administrativa: composicao.taxa_administrativa,
            valor_rateio_colisao: composicao.rateio_colisao,
            valor_rateio_roubo_furto: composicao.rateio_roubo_furto,
            valor_rateio_incendio: composicao.rateio_incendio,
            valor_rateio_vidros: composicao.rateio_vidros,
            valor_rateio_terceiros: composicao.rateio_terceiros,
            valor_rateio_assistencia: composicao.rateio_assistencia,
            valor_adicionais: composicao.adicionais,
            valor_adicionais_detalhes: composicao.adicionais_detalhes,
            fator_prorata: composicao.fator_prorata,
            dias_ativos: Math.round(composicao.fator_prorata * 30),
            veiculo_id: veiculo.id,
            valor_fipe: valorFipe,
            quantidade_cotas: cotas,
            faixa_id: veiculo.faixa_cota_id,
          });
        }

        // Enviar WhatsApp se solicitado
        if (body.enviar_whatsapp && asaasCobranca?.pixPayload) {
          const telefone = associado.whatsapp || associado.telefone;
          if (telefone) {
            try {
              const valorFormatado = composicao.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              const dataFormatada = dataVencimento.toLocaleDateString('pt-BR');
              
              const mensagem = `📄 *Fatura Rateio ${competencia}*

Olá ${associado.nome.split(' ')[0]}! 👋

Sua fatura de *${valorFormatado}* está disponível.

📊 *Composição:*
• Taxa Admin: R$ ${composicao.taxa_administrativa.toFixed(2)}
• Rateio: R$ ${subtotalRateio.toFixed(2)}

📅 Vencimento: *${dataFormatada}*

💠 *PIX Copia e Cola:*
\`${asaasCobranca.pixPayload}\`

${asaasCobranca.bankSlipUrl ? `📋 Boleto: ${asaasCobranca.bankSlipUrl}` : ''}`;

              await supabase.functions.invoke('whatsapp-send-text', {
                body: { telefone: telefone.replace(/\D/g, ''), mensagem },
              });
              
              // Marcar como enviado
              await supabase
                .from('asaas_cobrancas')
                .update({ enviada_whatsapp: true, enviada_whatsapp_em: new Date().toISOString() })
                .eq('id', cobrancaInserida.id);
              
              resultados.whatsappEnviados++;
            } catch (e) {
              console.error('[gerar-faturas] Erro WhatsApp:', e);
            }
          }
        }

        resultados.geradas++;
        resultados.faturas.push({
          associado_id: associado.id,
          associado_nome: associado.nome,
          valor: composicao.total,
          asaas_id: asaasCobranca?.id,
        });

      } catch (error: any) {
        console.error(`[gerar-faturas] Erro para ${associado.nome}:`, error.message);
        resultados.erros++;
      }
    }

    // Atualizar status do fechamento se não for preview
    if (!body.preview && resultados.geradas > 0) {
      await supabase
        .from('fechamentos_mensais')
        .update({
          status: 'processado',
          processado_em: new Date().toISOString(),
          total_geral: resultados.faturas.reduce((acc, f) => acc + (f.valor || 0), 0),
        })
        .eq('id', fechamentoId);
    }

    console.log(`[gerar-faturas] Resultado: ${resultados.geradas} geradas, ${resultados.jaExistentes} existentes, ${resultados.erros} erros`);

    return new Response(JSON.stringify({
      success: true,
      ...resultados,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[gerar-faturas] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
