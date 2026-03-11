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
  preview?: boolean;
  enviar_whatsapp?: boolean;
  limite?: number;
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

// Helper: fetch all rows with pagination (bypass 1000-row limit)
async function fetchAllRows(supabase: any, table: string, filters: Record<string, any>, selectFields: string): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(selectFields).range(offset, offset + PAGE_SIZE - 1);
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Erro ao buscar ${table}: ${error.message}`);
    const rows = data || [];
    allRows = allRows.concat(rows);
    hasMore = rows.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  return allRows;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body: FaturasRequest = await req.json().catch(() => ({}));
    
    let fechamentoId = body.fechamento_id;
    
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

    // 2. Buscar configurações dinâmicas (eliminar hardcodes)
    const { data: configRows } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['atuarial_valor_por_cota', 'taxa_administrativa_padrao']);

    const configMap: Record<string, string> = {};
    for (const row of (configRows || [])) {
      configMap[row.chave] = row.valor;
    }

    const valorPorCotaConfig = Number(configMap['atuarial_valor_por_cota']) || 5000;
    const taxaAdminPadrao = Number(configMap['taxa_administrativa_padrao']) || 49.90;

    console.log(`[gerar-faturas] Config: valorPorCota=${valorPorCotaConfig}, taxaAdminPadrao=${taxaAdminPadrao}`);

    // 3. Criar mapa de valor por cota por benefício
    const valorPorCotaBeneficio: Record<string, number> = {};
    for (const despesa of (fechamento.despesas_rateio || [])) {
      valorPorCotaBeneficio[despesa.tipo_beneficio] = despesa.valor_por_cota || 0;
    }

    console.log('[gerar-faturas] Valores por cota:', valorPorCotaBeneficio);

    // 4. Buscar associados ativos com veículos (COM PAGINAÇÃO)
    const selectFields = `
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
    `;

    const associados = await fetchAllRows(supabase, 'associados', { status: 'ativo' }, selectFields);

    // 5. Buscar taxas administrativas por faixa
    const { data: taxasAdmin } = await supabase
      .from('faixas_taxa_administrativa')
      .select('*')
      .eq('ativo', true)
      .order('fipe_de', { ascending: true });

    const taxasMap = taxasAdmin || [];

    function getTaxaAdministrativa(valorFipe: number): number {
      const faixa = taxasMap.find((t: any) => valorFipe >= t.fipe_de && valorFipe <= t.fipe_ate);
      return faixa?.valor_taxa || taxaAdminPadrao;
    }

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

    console.log(`[gerar-faturas] ${associados.length} associados para processar`);

    const competencia = `${fechamento.ano}-${String(fechamento.mes).padStart(2, '0')}`;
    const resultados = {
      total: associados.length,
      geradas: 0,
      jaExistentes: 0,
      erros: 0,
      alertas: 0,
      whatsappEnviados: 0,
      preview: body.preview,
      faturas: [] as any[],
    };

    // 6. Processar cada associado
    for (const associado of associados) {
      try {
        const veiculosAtivos = (associado.veiculos || []).filter((v: any) => v.status === 'ativo');
        if (veiculosAtivos.length === 0) continue;

        if (veiculosAtivos.length > 1) {
          console.log(`[MULTI-VEICULO] Associado ${associado.id} (${associado.nome}): ${veiculosAtivos.length} veículos ativos`);
        }

        const proRata = calcularProRata(associado.data_adesao, fechamento.mes, fechamento.ano);

        let totalGeral = 0;
        let subtotalRateioGeral = 0;
        let taxaAdminGeral = 0;
        const composicoesPorVeiculo: Array<{
          veiculo: any;
          valorFipe: number;
          cotas: number;
          composicao: ComposicaoFatura;
          subtotalRateio: number;
        }> = [];

        for (const veiculo of veiculosAtivos) {
          const v = veiculo as any;
          const valorFipe = v.valor_fipe;

          // Se veículo não tem FIPE, alertar e usar cotas da faixa ou pular
          if (!valorFipe) {
            console.warn(`[gerar-faturas] ALERTA: Veículo ${v.placa || v.id} sem valor FIPE. Usando cotas cadastradas ou pulando.`);
            resultados.alertas++;
          }

          // Cotas: priorizar cadastro direto > faixa > cálculo dinâmico via config
          const cotas = v.quantidade_cotas ||
                        (v.faixas_cotas as any)?.quantidade_cotas ||
                        (valorFipe ? Math.ceil(valorFipe / valorPorCotaConfig) : 1);

          const composicao: ComposicaoFatura = {
            taxa_administrativa: valorFipe ? getTaxaAdministrativa(valorFipe) : taxaAdminPadrao,
            rateio_colisao: v.cobertura_total ? (valorPorCotaBeneficio['colisao'] || 0) * cotas : 0,
            rateio_incendio: v.cobertura_total ? (valorPorCotaBeneficio['incendio'] || 0) * cotas : 0,
            rateio_roubo_furto: (v.cobertura_roubo_furto || v.cobertura_total) 
              ? (valorPorCotaBeneficio['roubo_furto'] || 0) * cotas : 0,
            rateio_vidros: v.cobertura_vidros ? (valorPorCotaBeneficio['vidros'] || 0) * cotas : 0,
            rateio_terceiros: v.cobertura_terceiros ? (valorPorCotaBeneficio['terceiros'] || 0) * cotas : 0,
            rateio_assistencia: v.cobertura_assistencia !== false 
              ? (valorPorCotaBeneficio['assistencia'] || 0) * cotas : 0,
            adicionais: 0,
            adicionais_detalhes: {} as Record<string, number>,
            fator_prorata: proRata,
            total: 0,
          };

          const subtotalRateio = composicao.rateio_colisao + 
                                 composicao.rateio_roubo_furto + 
                                 composicao.rateio_incendio +
                                 composicao.rateio_vidros +
                                 composicao.rateio_terceiros +
                                 composicao.rateio_assistencia;

          composicao.total = (composicao.taxa_administrativa + subtotalRateio) * proRata;

          totalGeral += composicao.total;
          subtotalRateioGeral += subtotalRateio * proRata;
          taxaAdminGeral += composicao.taxa_administrativa * proRata;

          composicoesPorVeiculo.push({ veiculo: v, valorFipe: valorFipe || 0, cotas, composicao, subtotalRateio });
        }

        // Adicionais contratados (por associado)
        let totalAdicionais = 0;
        const adicionaisDetalhes: Record<string, number> = {};
        
        const { data: adicionaisAtivos } = await supabase
          .from('associados_beneficios_adicionais')
          .select('valor_contratado, beneficio_adicional:beneficio_adicional_id(nome)')
          .eq('associado_id', associado.id)
          .eq('ativo', true);

        for (const adicional of (adicionaisAtivos || [])) {
          const nome = (adicional.beneficio_adicional as any)?.nome || 'Adicional';
          const valor = adicional.valor_contratado || 0;
          totalAdicionais += valor;
          adicionaisDetalhes[nome] = (adicionaisDetalhes[nome] || 0) + valor;
        }

        if (composicoesPorVeiculo.length > 0) {
          composicoesPorVeiculo[0].composicao.adicionais = totalAdicionais;
          composicoesPorVeiculo[0].composicao.adicionais_detalhes = adicionaisDetalhes;
          composicoesPorVeiculo[0].composicao.total += totalAdicionais * proRata;
        }
        totalGeral += totalAdicionais * proRata;

        const placas = composicoesPorVeiculo.map(c => c.veiculo.placa);
        const descricaoVeiculos = veiculosAtivos.length === 1
          ? placas[0]
          : `${veiculosAtivos.length} veículos: ${placas.join(', ')}`;

        const composicaoResumo = {
          veiculos: composicoesPorVeiculo.map(c => ({
            veiculo_id: c.veiculo.id,
            placa: c.veiculo.placa,
            valor_fipe: c.valorFipe,
            cotas: c.cotas,
            valor: c.composicao.total,
          })),
          quantidade_veiculos: veiculosAtivos.length,
          taxa_administrativa_total: taxaAdminGeral,
          rateio_total: subtotalRateioGeral,
          fator_prorata: proRata,
          total: totalGeral,
        };

        // Preview mode
        if (body.preview) {
          resultados.faturas.push({
            associado_id: associado.id,
            associado_nome: associado.nome,
            veiculos: composicaoResumo.veiculos,
            quantidade_veiculos: veiculosAtivos.length,
            composicao_total: totalGeral,
            composicao_resumo: composicaoResumo,
          });
          resultados.geradas++;
          continue;
        }

        // Verificar duplicidade
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

        // Data de vencimento
        const diaVenc = associado.dia_vencimento || 10;
        const dataVencimento = new Date(fechamento.ano, fechamento.mes, diaVenc);
        if (dataVencimento < new Date()) {
          dataVencimento.setMonth(dataVencimento.getMonth() + 1);
        }

        // Criar cobrança no ASAAS
        const asaasClienteId = associado.asaas_clientes?.[0]?.asaas_id;
        let asaasCobranca: any = null;

        if (asaasClienteId && ASAAS_API_KEY && totalGeral > 0) {
          const descricao = `Fatura ${competencia} - ${associado.nome} - ${descricaoVeiculos}\nTaxa Admin: R$ ${taxaAdminGeral.toFixed(2)}\nRateio: R$ ${subtotalRateioGeral.toFixed(2)}`;
          
          const asaasResponse = await fetch(`${ASAAS_API_URL}/payments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY,
            },
            body: JSON.stringify({
              customer: asaasClienteId,
              billingType: 'UNDEFINED',
              value: Math.round(totalGeral * 100) / 100,
              dueDate: dataVencimento.toISOString().split('T')[0],
              description: descricao,
              externalReference: `${associado.id}-${competencia}-rateio`,
            }),
          });

          if (asaasResponse.ok) {
            asaasCobranca = await asaasResponse.json();
            
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
            valor: totalGeral,
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
            composicao_resumo: composicaoResumo,
            veiculo_id: veiculosAtivos.length === 1 ? (veiculosAtivos[0] as any).id : null,
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`Erro ao inserir cobrança: ${insertError.message}`);
        }

        // Inserir composição detalhada
        if (cobrancaInserida) {
          for (const item of composicoesPorVeiculo) {
            await supabase.from('cobrancas_composicao').insert({
              cobranca_id: cobrancaInserida.id,
              valor_taxa_administrativa: item.composicao.taxa_administrativa,
              valor_rateio_colisao: item.composicao.rateio_colisao,
              valor_rateio_roubo_furto: item.composicao.rateio_roubo_furto,
              valor_rateio_incendio: item.composicao.rateio_incendio,
              valor_rateio_vidros: item.composicao.rateio_vidros,
              valor_rateio_terceiros: item.composicao.rateio_terceiros,
              valor_rateio_assistencia: item.composicao.rateio_assistencia,
              valor_adicionais: item.composicao.adicionais,
              valor_adicionais_detalhes: item.composicao.adicionais_detalhes,
              fator_prorata: item.composicao.fator_prorata,
              dias_ativos: Math.round(item.composicao.fator_prorata * 30),
              veiculo_id: item.veiculo.id,
              valor_fipe: item.valorFipe,
              quantidade_cotas: item.cotas,
              faixa_id: item.veiculo.faixa_cota_id,
            });
          }
        }

        // WhatsApp
        if (body.enviar_whatsapp && asaasCobranca?.pixPayload) {
          const telefone = associado.whatsapp || associado.telefone;
          if (telefone) {
            try {
              const valorFormatado = totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              const dataFormatada = dataVencimento.toLocaleDateString('pt-BR');
              
              const veiculosInfo = veiculosAtivos.length > 1
                ? `\n🚗 *${veiculosAtivos.length} veículos:* ${placas.join(', ')}`
                : `\n🚗 *Veículo:* ${placas[0]}`;

              const mensagem = `📄 *Fatura Rateio ${competencia}*

Olá ${associado.nome.split(' ')[0]}! 👋

Sua fatura de *${valorFormatado}* está disponível.${veiculosInfo}

📊 *Composição:*
• Taxa Admin: R$ ${taxaAdminGeral.toFixed(2)}
• Rateio: R$ ${subtotalRateioGeral.toFixed(2)}

📅 Vencimento: *${dataFormatada}*

💠 *PIX Copia e Cola:*
\`${asaasCobranca.pixPayload}\`

${asaasCobranca.bankSlipUrl ? `📋 Boleto: ${asaasCobranca.bankSlipUrl}` : ''}`;

              const primeiroNomeFatura = associado.nome.split(' ')[0];
              const valorStr = totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              const dataVencStr = dataVencimento.toLocaleDateString('pt-BR');
              await supabase.functions.invoke('whatsapp-send-text', {
                body: {
                  telefone: telefone.replace(/\D/g, ''),
                  mensagem,
                  template_name: 'cobranca_mensalidade',
                  template_params: [primeiroNomeFatura, valorStr, dataVencStr],
                },
              });
              
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
          valor: totalGeral,
          quantidade_veiculos: veiculosAtivos.length,
          asaas_id: asaasCobranca?.id,
        });

      } catch (error: any) {
        console.error(`[gerar-faturas] Erro para ${associado.nome}:`, error.message);
        resultados.erros++;
      }
    }

    // Atualizar status do fechamento
    if (!body.preview && resultados.geradas > 0) {
      await supabase
        .from('fechamentos_mensais')
        .update({
          status: 'processado',
          processado_em: new Date().toISOString(),
          total_geral: resultados.faturas.reduce((acc: number, f: any) => acc + (f.valor || 0), 0),
        })
        .eq('id', fechamentoId);
    }

    console.log(`[gerar-faturas] Resultado: ${resultados.geradas} geradas, ${resultados.jaExistentes} existentes, ${resultados.erros} erros, ${resultados.alertas} alertas`);

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
