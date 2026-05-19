// @ts-nocheck
// ============================================
// EDGE FUNCTION: autentique-create-by-token
// Cria documento Autentique a partir de link_token (uso público)
// ============================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { gerarPosicoesAssinatura, buscarPosicoesConfig, estimarPaginasHTML } from "../_shared/autentique-positions.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { generateTermoAfiliacao, generateSecaoRastreador } from "../_shared/termo-afiliacao-template.ts";
import { filterEligibleItems } from "../_shared/eligibility-filter.ts";
import { mapearDadosParaTemplate, buscarConfiguracoesEmpresa, buscarRegrasVenda, buscarRegrasDepreciacao } from "../_shared/termo-afiliacao-utils.ts";
import { buscarEGerarAditivos, substituirVariaveis, limparVariaveisNaoSubstituidas, generateStyles, generateHeader, generateFooter, markdownParaHTML, sanitizeSignatureBlocks, exigeRastreador, extrairCodigosBeneficios } from "../_shared/template-utils.ts";
import { logEdgeFunction } from "../_shared/log-edge-function.ts";
import { enviarTermoFiliacaoWhatsApp } from "../_shared/enviar-termo-filiacao-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============= BUSCAR CONFIG RASTREADOR =============
async function buscarConfigRastreador(supabase: any) {
  try {
    const _startTime = Date.now();
    const { data, error } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', [
        'operacional_fipe_minimo_rastreador',
        'operacional_fipe_minimo_rastreador_moto'
      ]);
    
    if (error) throw error;
    
    const config: Record<string, string> = {};
    for (const row of (data || [])) {
      config[row.chave] = row.valor;
    }
    
    const result = {
      fipeMinCarro: Number(config['operacional_fipe_minimo_rastreador']) || 30000,
      fipeMinMoto: Number(config['operacional_fipe_minimo_rastreador_moto']) || 9000,
    };
    console.log('[autentique-create-by-token] Config rastreador:', result);
    return result;
  } catch (err) {
    console.warn('[autentique-create-by-token] Fallback: erro ao buscar config rastreador:', err);
    return { fipeMinCarro: 30000, fipeMinMoto: 9000 };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Timing instrumentation
  const timings: Record<string, number | string> = {};
  const t0 = Date.now();

  try {
    const { contratoToken } = await req.json();

    if (!contratoToken) {
      console.error('[autentique-create-by-token] Token não fornecido');
      return new Response(
        JSON.stringify({ success: false, error: 'Token não fornecido', errorCode: 'TOKEN_MISSING' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar formato UUID antes de fazer query no banco
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(contratoToken)) {
      console.error('[autentique-create-by-token] Token com formato inválido:', contratoToken.substring(0, 20) + '...');
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido', errorCode: 'TOKEN_INVALID' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[autentique-create-by-token] Processando token:', contratoToken.substring(0, 8) + '...');

    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) {
      throw new Error("AUTENTIQUE_API_KEY não configurada");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar contrato por link_token com embeds explícitos
    const { data: contrato, error: contratoError } = await supabase
      .from("contratos")
      .select(`
        *,
        planos:plano_id (*),
        leads:lead_id (id, nome, email, telefone, cpf, veiculo_marca, veiculo_modelo, veiculo_placa, veiculo_ano, veiculo_fipe),
        associados:associado_id (id, nome, email, telefone, cpf)
      `)
      .eq("link_token", contratoToken)
      .single();

    timings.fetchContrato = Date.now() - t0;

    if (contratoError) {
      console.error('[autentique-create-by-token] Erro ao buscar contrato:', contratoError.message, contratoError.details);
      if (contratoError.message?.includes('invalid input syntax for type uuid')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token inválido', errorCode: 'TOKEN_INVALID' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar contrato', errorCode: 'DATABASE_ERROR' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!contrato) {
      console.error('[autentique-create-by-token] Contrato não encontrado para o token');
      return new Response(
        JSON.stringify({ success: false, error: 'Contrato não encontrado. O link pode ter expirado.', errorCode: 'CONTRACT_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[autentique-create-by-token] Contrato encontrado:', contrato.numero);
    console.log('[autentique-create-by-token] adesao_paga:', contrato.adesao_paga);
    console.log('[autentique-create-by-token] autentique_url:', contrato.autentique_url);

    // Validar regras de negócio
    if (!contrato.adesao_paga) {
      console.warn('[autentique-create-by-token] Adesão ainda não foi paga');
      return new Response(
        JSON.stringify({ success: false, error: 'Aguardando confirmação do pagamento', errorCode: 'PAYMENT_PENDING' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se já existe autentique_url, retornar o link existente (evita duplicação)
    if (contrato.autentique_url) {
      console.log('[autentique-create-by-token] Link já existe, retornando:', contrato.autentique_url);
      return new Response(
        JSON.stringify({ 
          success: true, 
          signatureLink: contrato.autentique_url,
          message: 'Link já existe',
          timingsMs: timings
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= BUSCAR CONFIGURAÇÕES DA EMPRESA =============
    const empresaConfig = await buscarConfiguracoesEmpresa(supabase);

    // ============= BUSCAR CONFIG RASTREADOR =============
    const configRastreador = await buscarConfigRastreador(supabase);

    // ============= BUSCAR REGRAS DE VENDA =============
    const [{ regras: regrasVenda, faltantes: regrasFaltantes }, regrasDepreciacao] = await Promise.all([
      buscarRegrasVenda(supabase),
      buscarRegrasDepreciacao(supabase),
    ]);

    // ============= BUSCAR VEÍCULO DO BANCO (FLAGS DE DEPRECIAÇÃO + CÂMBIO/TIPO) =============
    let veiculoDB: any = null;
    if (contrato.veiculo_id) {
      const { data: veiculoData } = await supabase
        .from('veiculos')
        .select('flag_placa_vermelha, flag_ex_taxi, flag_taxi_ativo, flag_chassi_remarcado, flag_ex_ressarcido, flag_avarias_vistoria, blindado, ano_fabricacao, ano_modelo, cambio, numero_motor')
        .eq('id', contrato.veiculo_id)
        .maybeSingle();
      veiculoDB = veiculoData;
    }
    // Tipo (carro/moto/...) derivado de marcas_modelos (fonte canônica)
    {
      const marcaTipo = (contrato as any).veiculo_marca;
      const modeloTipo = (contrato as any).veiculo_modelo;
      if (marcaTipo) {
        const { data: mm } = await supabase
          .from('marcas_modelos')
          .select('tipo_veiculo')
          .eq('marca', marcaTipo)
          .eq('modelo', modeloTipo || '')
          .eq('ativo', true)
          .maybeSingle();
        const tipoFromMM = mm?.tipo_veiculo
          || (await supabase
                .from('marcas_modelos')
                .select('tipo_veiculo')
                .eq('marca', marcaTipo)
                .eq('ativo', true)
                .not('tipo_veiculo', 'is', null)
                .limit(1)
                .maybeSingle()).data?.tipo_veiculo
          || null;
        veiculoDB = { ...(veiculoDB || {}), tipo_veiculo: tipoFromMM };
      }
    }

    // Obter dados do cliente (associado tem prioridade, depois lead)
    const cliente = contrato.associados || contrato.leads;
    const clienteNome = cliente?.nome || 'Cliente';
    const clienteEmail = cliente?.email || '';
    const clienteCpf = cliente?.cpf || '';
    const clienteTelefone = cliente?.telefone || '';

    if (!clienteEmail) {
      throw new Error('Email do cliente não encontrado');
    }

    // ============= MAPEAR DADOS PARA O TEMPLATE =============
    const templateData = mapearDadosParaTemplate(
      {
        ...contrato,
        cliente_nome: clienteNome,
        cliente_cpf: clienteCpf,
        cliente_email: clienteEmail,
        cliente_telefone: clienteTelefone,
      },
      contrato.planos,
      empresaConfig,
      contrato.leads,
      contrato.associados,
      undefined,
      veiculoDB
    );
    templateData.configRastreador = configRastreador;
    templateData.regrasDepreciacao = regrasDepreciacao;
    if (regrasVenda) {
      templateData.regrasVenda = regrasVenda;
    }

    // ============= BUSCAR COBERTURAS E BENEFÍCIOS DO PLANO (COM FILTRO DE ELEGIBILIDADE) =============
    const planoId = contrato.planos?.id || contrato.plano_id;
    if (planoId) {
      try {
        const [{ data: coberturasData }, { data: beneficiosData }] = await Promise.all([
          supabase
            .from('planos_coberturas')
            .select('cobertura_id, valor_limite, carencia_dias, franquia_percentual, coberturas:cobertura_id(id, nome, descricao)')
            .eq('plano_id', planoId),
          supabase
            .from('planos_beneficios')
            .select('benefit_id, custom_value, benefits:benefit_id(id, name, description)')
            .eq('plano_id', planoId),
        ]);

        // Aplicar filtro de elegibilidade baseado no veículo do contrato
        const veiculoParams = {
          valor_fipe: contrato.veiculo_valor_fipe || contrato.valor_fipe,
          regiao: contrato.regiao || contrato.cliente_uf,
          combustivel: contrato.veiculo_combustivel,
          tipo_placa: veiculoDB?.flag_placa_vermelha ? 'vermelha' : 'normal',
          tipo_uso: contrato.uso_aplicativo ? 'aplicativo' : 'particular',
        };

        const cobIds = (coberturasData || []).map((pc: any) => pc.cobertura_id).filter(Boolean);
        const benIds = (beneficiosData || []).map((pb: any) => pb.benefit_id).filter(Boolean);

        const { coberturas: cobElegiveis, beneficios: benElegiveis } = await filterEligibleItems(
          supabase,
          coberturasData || [],
          beneficiosData || [],
          veiculoParams,
          cobIds,
          benIds,
          planoId
        );

        if (cobElegiveis.length) {
          templateData.plano.coberturas_detalhadas = cobElegiveis.map((pc: any) => ({
            nome: pc.coberturas?.nome || '',
            descricao: pc.coberturas?.descricao || '',
            valor_personalizado: pc.valor_limite ? `R$ ${Number(pc.valor_limite).toLocaleString('pt-BR')}` : '',
            carencia_dias: pc.carencia_dias,
            franquia_percentual: pc.franquia_percentual,
          }));
          console.log(`[autentique-create-by-token] ${cobElegiveis.length} coberturas elegíveis (de ${(coberturasData || []).length} total)`);
        }

        if (benElegiveis.length) {
          templateData.plano.beneficios_detalhados = benElegiveis.map((pb: any) => ({
            nome: pb.benefits?.name || '',
            descricao: pb.benefits?.description || '',
            valor_personalizado: pb.custom_value || '',
          }));
          console.log(`[autentique-create-by-token] ${benElegiveis.length} benefícios elegíveis (de ${(beneficiosData || []).length} total)`);
        }
      } catch (err) {
        console.warn('[autentique-create-by-token] Erro ao buscar coberturas/benefícios (não-bloqueante):', err);
      }
    }

    // ============= BUSCAR OFICINA VINCULADA VIA OS =============
    try {
      let oficinaId: string | null = null;
      const { data: osData } = await supabase
        .from('ordens_servico')
        .select('oficina_id')
        .or(`contrato_id.eq.${contrato.id}${contrato.veiculo_id ? `,veiculo_id.eq.${contrato.veiculo_id}` : ''}`)
        .not('oficina_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      oficinaId = osData?.oficina_id || null;

      if (oficinaId) {
        const { data: oficina } = await supabase
          .from('oficinas')
          .select('nome_fantasia, razao_social, cnpj, telefone, whatsapp, logradouro, numero, bairro, cidade, estado, cep')
          .eq('id', oficinaId)
          .maybeSingle();
        if (oficina) {
          templateData.oficina = {
            nome: oficina.nome_fantasia || oficina.razao_social || '—',
            cnpj: oficina.cnpj || '',
            telefone: oficina.telefone || '',
            whatsapp: oficina.whatsapp || '',
            logradouro: oficina.logradouro || '',
            numero: oficina.numero || '',
            bairro: oficina.bairro || '',
            cidade: oficina.cidade || '',
            estado: oficina.estado || '',
            cep: oficina.cep || '',
          };
          console.log(`[autentique-create-by-token] Oficina vinculada encontrada: ${templateData.oficina.nome}`);
        }
      }
    } catch (err) {
      console.warn('[autentique-create-by-token] Erro ao buscar oficina (não-bloqueante):', err);
    }

    // Fetch migration data if applicable
    if (contrato.tipo_entrada === 'migracao') {
      let solMigracao = null;

      // Primeiro: buscar por cotacao_id (fluxo padrão)
      if (contrato.cotacao_id) {
        const { data } = await supabase
          .from('solicitacoes_migracao')
          .select('associacao_origem, aprovado_em, status')
          .eq('cotacao_id', contrato.cotacao_id)
          .eq('status', 'aprovada')
          .maybeSingle();
        solMigracao = data;
      }

      // Fallback: migração direta (sem cotação) — buscar pelo CPF do associado
      if (!solMigracao && contrato.associados?.cpf) {
        const { data } = await supabase
          .from('solicitacoes_migracao')
          .select('associacao_origem, aprovado_em, status')
          .eq('associado_cpf', contrato.associados.cpf)
          .eq('status', 'aprovada')
          .order('aprovado_em', { ascending: false })
          .limit(1)
          .maybeSingle();
        solMigracao = data;
        if (solMigracao) {
          console.log('[autentique-create-by-token] Migração direta encontrada via CPF:', contrato.associados.cpf);
        }
      }

      if (solMigracao) {
        templateData.migracao = {
          aprovada: true,
          associacao_origem: solMigracao.associacao_origem,
          data_aprovacao: solMigracao.aprovado_em || '',
          carencia_isenta: contrato.carencia_isenta || false,
        };
      }
    }

    // ============= BUSCAR DADOS DE SUBSTITUIÇÃO (quando aplicável) =============
    if ((contrato.tipo_entrada === 'substituicao_placa' || contrato.tipo_entrada === 'substituicao') && contrato.associado_id && contrato.veiculo_id) {
      const { data: subst } = await supabase
        .from('substituicoes_veiculo')
        .select('veiculo_antigo_placa, veiculo_antigo_modelo, veiculo_antigo_fipe')
        .eq('associado_id', contrato.associado_id)
        .eq('veiculo_novo_id', contrato.veiculo_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subst) {
        templateData.substituicao = {
          placa_anterior: subst.veiculo_antigo_placa || '',
          modelo_anterior: subst.veiculo_antigo_modelo || '',
          fipe_anterior: subst.veiculo_antigo_fipe || 0,
        };
        console.log('[autentique-create-by-token] Dados de substituição encontrados:', subst.veiculo_antigo_placa);
      }
    }

    // ============= BUSCAR DADOS DE TROCA DE TITULARIDADE (quando aplicável) =============
    if (contrato.tipo_entrada === 'troca_titularidade' && contrato.origem_troca_titularidade_id) {
      const { data: solTroca } = await supabase
        .from('chat_solicitacoes_ia')
        .select('dados')
        .eq('id', contrato.origem_troca_titularidade_id)
        .maybeSingle();

      if (solTroca?.dados) {
        const dadosTroca = solTroca.dados as any;
        let titularAnterior = '';
        if (dadosTroca.associado_id) {
          const { data: assocAnterior } = await supabase
            .from('associados')
            .select('nome')
            .eq('id', dadosTroca.associado_id)
            .maybeSingle();
          titularAnterior = assocAnterior?.nome || '';
        }

        const cenario = dadosTroca.cenario_aplicado || dadosTroca.cenario || '';
        const cenarioLabels: Record<string, string> = {
          'A': 'Cenário A — Vistoria dispensada',
          'B': 'Cenário B — Vistoria obrigatória',
        };

        templateData.trocaTitularidade = {
          titular_anterior: titularAnterior,
          cenario: cenario,
          cenario_label: cenarioLabels[cenario?.toUpperCase()] || `Cenário ${cenario}`,
        };
        console.log('[autentique-create-by-token] Dados de troca de titularidade encontrados. Cenário:', cenario);
      }
    }

    // ============= BUSCAR TEMPLATE DO BANCO =============
    // Priorizar template vinculado ao plano, senão fallback para is_default_autentique
    let templateDB: any = null;
    const planoTemplateId = contrato.planos?.template_contrato_id;

    if (planoTemplateId) {
      const { data: tpl, error: tplErr } = await supabase
        .from("documento_templates")
        .select("id, codigo, nome, conteudo, config_layout")
        .eq("id", planoTemplateId)
        .eq("ativo", true)
        .single();
      if (!tplErr && tpl) {
        templateDB = tpl;
        console.log(`[autentique-create-by-token] Usando template vinculado ao plano: ${tpl.codigo} (${tpl.nome})`);
      } else {
        console.warn(`[autentique-create-by-token] Template do plano (${planoTemplateId}) não encontrado, usando fallback`);
      }
    }

    if (!templateDB) {
      const { data: templatesDB, error: templateError } = await supabase
        .from("documento_templates")
        .select("id, codigo, nome, conteudo, config_layout")
        .eq("is_default_autentique", true)
        .eq("ativo", true)
        .order("updated_at", { ascending: false })
        .limit(2);

      if (templateError) {
        console.warn("[autentique-create-by-token] Erro ao buscar template:", templateError.message);
      }
      if (templatesDB && templatesDB.length > 1) {
        console.warn(`[autentique-create-by-token] ⚠️ ${templatesDB.length} templates com is_default_autentique=true!`);
      }
      templateDB = templatesDB?.[0] || null;
    }

    const usandoTemplateBanco = templateDB?.conteudo;

    // ============= GERAR HTML DO TERMO DE AFILIAÇÃO =============
    let contratoHTML: string;
    let templateUsado: string;

    if (usandoTemplateBanco) {
      // Validar regras se o template usa variáveis {{regras.*}}
      if (templateDB.conteudo.includes('{{regras.') && regrasFaltantes.length > 0) {
        console.error('[autentique-create-by-token] Template usa variáveis de regras mas há configurações faltantes:', regrasFaltantes);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Configurações de Regras de Venda incompletas. Chaves faltantes: ${regrasFaltantes.join(', ')}. Configure em Diretoria > Regras de Venda.`,
            errorCode: 'MISSING_REGRAS_VENDA',
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Usar template dinâmico do banco (mesma lógica do autentique-create)
      const conteudoPreenchido = substituirVariaveis(templateDB.conteudo, templateData);
      let conteudoHTML = markdownParaHTML(conteudoPreenchido);
      // Sanitizar blocos de assinatura manual que possam existir no template
      conteudoHTML = sanitizeSignatureBlocks(conteudoHTML);
      const aditivosHTML = await buscarEGerarAditivos(supabase, templateData.veiculo, templateData, {
        beneficios_codigos: extrairCodigosBeneficios(contrato),
        configRastreador: templateData.configRastreador,
      });

      // Injetar seção de rastreador se obrigatório (não coberta pelos aditivos do banco)
      const rastreadorResult = exigeRastreador(templateData.veiculo, templateData.configRastreador);
      const rastreadorHTML = rastreadorResult.exige ? generateSecaoRastreador(templateData) : '';

      // Assinatura será feita via Autentique (rubrica + assinatura digital) — sem bloco visual

      // Injetar coberturas/benefícios se o template não os continha
      let coberturasInjetadasHTML = '';
      const jaTemCoberturas = conteudoHTML.includes('COBERTURAS E BENEF') || 
        conteudoHTML.includes('plan-details') ||
        conteudoHTML.includes('tabela_coberturas') ||
        conteudoHTML.includes('tabela_completa');
      if (!jaTemCoberturas) {
        const { gerarSecaoCoberturasInjetavel } = await import("../_shared/template-utils.ts");
        coberturasInjetadasHTML = gerarSecaoCoberturasInjetavel(templateData);
        if (coberturasInjetadasHTML) {
          console.log('[autentique-create-by-token] Seção de coberturas/benefícios injetada automaticamente');
        }
      }

      contratoHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Afiliação - ${contrato.numero}</title>
  ${generateStyles()}
</head>
<body>
  <div class="page">
    ${generateHeader(templateData)}
    ${conteudoHTML}
    ${coberturasInjetadasHTML}
    ${aditivosHTML}
    ${rastreadorHTML}
    ${generateFooter(templateData)}
  </div>
</body>
</html>`;
      templateUsado = `${templateDB.codigo} (banco de dados)`;
    } else {
      // Fallback: template hardcoded + aditivos dinâmicos
      contratoHTML = generateTermoAfiliacao(templateData);
      
      // Injetar aditivos dinâmicos antes do </body>
      const aditivosHTML = await buscarEGerarAditivos(supabase, templateData.veiculo, templateData, {
        beneficios_codigos: extrairCodigosBeneficios(contrato),
        configRastreador: templateData.configRastreador,
      });
      if (aditivosHTML) {
        contratoHTML = contratoHTML.replace('</body>', `${aditivosHTML}</body>`);
      }
      templateUsado = "Termo de Afiliação (hardcoded fallback + aditivos dinâmicos)";
    }

    // ============= ANEXAR TEMPLATES MARCADOS COMO "ANEXAR À PROPOSTA" =============
    try {
      const { data: templatesAnexos } = await supabase
        .from('documento_templates')
        .select('nome, conteudo, is_default_rastreador')
        .eq('anexar_proposta', true)
        .eq('ativo', true)
        .order('ordem_anexo')
        .order('nome');

      // Filtrar templates de rastreador já injetados dinamicamente via generateSecaoRastreador
      const templatesFiltrados = (templatesAnexos || []).filter(
        (t: any) => !t.is_default_rastreador
      );

      if (templatesFiltrados.length > 0) {
        console.log(`[autentique-create-by-token] Anexando ${templatesFiltrados.length} template(s) ao documento (excluídos ${(templatesAnexos?.length || 0) - templatesFiltrados.length} template(s) de rastreador já injetados)`);
        let anexosHTML = '';
        for (const tmpl of templatesFiltrados) {
          // Substituir variáveis no conteúdo do anexo antes de inserir
          let conteudoSubstituido = substituirVariaveis(tmpl.conteudo, templateData);
          // Remover blocos de assinatura manual do template do anexo
          conteudoSubstituido = sanitizeSignatureBlocks(conteudoSubstituido);
          anexosHTML += `
            <div style="page-break-before: always;">
              <h2 style="text-align: center; margin-top: 40px; margin-bottom: 20px; font-size: 16px; text-transform: uppercase;">${tmpl.nome}</h2>
              <div style="font-size: 12px; line-height: 1.6;">${conteudoSubstituido}</div>
            </div>
          `;
        }
        if (contratoHTML.includes('</body>')) {
          contratoHTML = contratoHTML.replace('</body>', `${anexosHTML}</body>`);
        } else {
          contratoHTML += anexosHTML;
        }
      }
    } catch (err) {
      console.warn('[autentique-create-by-token] Erro ao buscar templates para anexar:', err);
    }

    // Limpeza final: garantir que nenhuma variável bruta apareça no HTML (após anexos)
    contratoHTML = limparVariaveisNaoSubstituidas(contratoHTML);

    console.log(`[autentique-create-by-token] Template usado: ${templateUsado}`);
    console.log('[autentique-create-by-token] HTML gerado, tamanho:', contratoHTML.length, 'bytes');

    // ============= ENVIAR PARA AUTENTIQUE =============
    const mutation = `
      mutation CreateDocumentMutation(
        $document: DocumentInput!
        $signers: [SignerInput!]!
        $file: Upload!
      ) {
        createDocument(
          document: $document
          signers: $signers
          file: $file
        ) {
          id
          name
          refusable
          sortable
          created_at
          signatures {
            public_id
            name
            email
            created_at
            action { name }
            link { short_link }
            user { id name email }
          }
        }
      }
    `;

    timings.generateHtml = Date.now() - t0 - (timings.fetchContrato as number || 0);
    
    const documentName = `Termo de Afiliação ${contrato.numero} - ${clienteNome}`;
    
    // Validar CPF
    const cpfRaw = (clienteCpf || '').replace(/\D/g, '');
    const cpfOk = cpfRaw.length === 11 && !/^(\d)\1{10}$/.test(cpfRaw) && (() => {
      for (let t = 9; t < 11; t++) { let d = 0; for (let c = 0; c < t; c++) d += parseInt(cpfRaw[c]) * ((t+1)-c); d = ((10*d)%11)%10; if (parseInt(cpfRaw[t]) !== d) return false; } return true;
    })();
    console.log(`[autentique-create-by-token] CPF: ${cpfRaw} (válido: ${cpfOk})`);
    // Sanitização final de blocos de assinatura manual no HTML completo (antes de estimar páginas)
    contratoHTML = sanitizeSignatureBlocks(contratoHTML);
    // Estimar páginas reais do HTML para posicionar SIGNATURE na última página
    const posConfig = await buscarPosicoesConfig(supabase);
    const paginasEstimadas = estimarPaginasHTML(contratoHTML);
    posConfig.totalPaginas = paginasEstimadas;
    console.log(`[autentique-create-by-token] Usando ${paginasEstimadas} páginas estimadas para posições de assinatura`);
    const signerObj: any = { name: clienteNome, email: clienteEmail, action: "SIGN", delivery_method: "DELIVERY_METHOD_LINK", positions: gerarPosicoesAssinatura(posConfig), security_verifications: [{ type: "PF_FACIAL" }] };
    if (cpfOk) signerObj.configs = { cpf: cpfRaw };

    // Preparar operations JSON
    const operations = {
      query: mutation,
      variables: {
        document: { name: documentName, new_signature_style: true },
        signers: [signerObj],
        file: null,
      },
    };

    // Map indica onde o arquivo será injetado
    const map = {
      "0": ["variables.file"],
    };

    // Criar FormData seguindo GraphQL Multipart Request Spec
    const formData = new FormData();
    formData.append("operations", JSON.stringify(operations));
    formData.append("map", JSON.stringify(map));
    
    // Criar Blob do HTML e anexar ao FormData
    const htmlBlob = new Blob([contratoHTML], { type: "text/html" });
    formData.append("0", htmlBlob, `termo-afiliacao-${contrato.numero}.html`);

    console.log("[autentique-create-by-token] Enviando para Autentique via multipart/form-data...");
    console.log("[autentique-create-by-token] Document name:", documentName);
    console.log("[autentique-create-by-token] Signer name:", clienteNome);
    console.log("[autentique-create-by-token] Signer email:", clienteEmail);

    const autentiqueResponse = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${autentiqueApiKey}`,
      },
      body: formData,
    });

    const autentiqueData = await autentiqueResponse.json();
    
    timings.createDocument = Date.now() - t0 - (timings.fetchContrato as number || 0) - (timings.generateHtml as number || 0);
    
    console.log("[autentique-create-by-token] Resposta Autentique:", JSON.stringify(autentiqueData, null, 2));

    // Tratamento de erros específicos do Autentique
    if (autentiqueData.errors) {
      const errorMsg = autentiqueData.errors[0]?.message || 'unknown_error';
      console.error("[autentique-create-by-token] Erro do Autentique:", errorMsg);
      
      // Mapear códigos de erro conhecidos
      let errorCode = 'AUTENTIQUE_ERROR';
      let userMessage = 'Erro no serviço de assinatura. Tente novamente.';
      
      if (errorMsg === 'unavailable_credits' || errorMsg.includes('credits')) {
        errorCode = 'UNAVAILABLE_CREDITS';
        userMessage = 'Serviço de assinatura indisponível no momento. Nossa equipe foi notificada.';
      } else if (errorMsg === 'unauthorized' || errorMsg.includes('token') || errorMsg.includes('auth')) {
        errorCode = 'AUTENTIQUE_UNAUTHORIZED';
        userMessage = 'Configuração do serviço de assinatura inválida. Contate o suporte.';
      } else if (autentiqueData.validation) {
        errorCode = 'AUTENTIQUE_VALIDATION';
        userMessage = 'Dados incompletos para assinatura. Contate o vendedor.';
      }
      
      // Registrar erro no histórico do contrato
      await supabase.from('contratos_historico').insert({
        contrato_id: contrato.id,
        tipo: 'erro_autentique',
        descricao: `Erro ao criar documento: ${errorCode}`,
        dados: { error_code: errorCode, raw: autentiqueData }
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: userMessage,
        error_code: errorCode,
        timings
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    const document = autentiqueData.data?.createDocument;
    if (!document) {
      throw new Error("Documento não foi criado no Autentique");
    }

    console.log("[autentique-create-by-token] Documento criado com ID:", document.id);

    // Encontrar a assinatura do cliente (action = SIGN)
    const signerSignature = document.signatures?.find(
      (sig: any) => sig.action?.name === "SIGN"
    );

    if (!signerSignature || !signerSignature.public_id) {
      console.error("[autentique-create-by-token] Assinatura não encontrada:", document.signatures);
      throw new Error("Assinatura do cliente não encontrada no documento");
    }

    console.log("[autentique-create-by-token] Public ID da assinatura:", signerSignature.public_id);

    // Tentar obter o link diretamente da resposta do createDocument
    let signatureLink = signerSignature.link?.short_link;
    
    if (signatureLink) {
      console.log("[autentique-create-by-token] Link obtido diretamente do createDocument:", signatureLink);
      timings.getLinkMethod = 'direct';
    } else {
      // Fallback: chamar createLinkToSignature se o link não veio na resposta inicial
      console.log("[autentique-create-by-token] Link não veio na resposta, chamando createLinkToSignature...");
      
      const linkMutation = `
        mutation {
          createLinkToSignature(public_id: "${signerSignature.public_id}") {
            short_link
          }
        }
      `;

      const linkResponse = await fetch(AUTENTIQUE_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${autentiqueApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: linkMutation }),
      });

      const linkData = await linkResponse.json();
      
      timings.createLinkToSignature = Date.now() - t0 - (timings.fetchContrato as number || 0) - (timings.generateHtml as number || 0) - (timings.createDocument as number || 0);
      
      console.log("[autentique-create-by-token] Resposta createLinkToSignature:", JSON.stringify(linkData, null, 2));

      if (linkData.errors) {
        console.error("[autentique-create-by-token] Erro ao obter link:", linkData.errors);
        throw new Error(`Erro ao obter link de assinatura: ${JSON.stringify(linkData.errors)}`);
      }

      signatureLink = linkData.data?.createLinkToSignature?.short_link;
      timings.getLinkMethod = 'createLinkToSignature';
    }

    if (!signatureLink) {
      throw new Error("Link de assinatura não foi retornado pelo Autentique");
    }

    console.log("[autentique-create-by-token] Link de assinatura obtido:", signatureLink);

    // Atualizar contrato com dados do Autentique
    const { error: updateError } = await supabase
      .from("contratos")
      .update({
        autentique_documento_id: document.id,
        autentique_url: signatureLink,
        autentique_status: "pending",
        status: "pendente_assinatura",
        data_envio: new Date().toISOString(),
      })
      .eq("id", contrato.id);

    if (updateError) {
      console.error("[autentique-create-by-token] Erro ao atualizar contrato:", updateError);
      throw new Error(`Erro ao atualizar contrato: ${updateError.message}`);
    }

    // Registrar no histórico do contrato
    await supabase.from("contratos_historico").insert({
      contrato_id: contrato.id,
      evento: "enviado_assinatura",
      descricao: `Termo de Afiliação enviado para assinatura via link público`,
      dados: { 
        autentique_id: document.id, 
        link: signatureLink,
        template_usado: templateUsado
      },
    });

    // Envio do link de assinatura via WhatsApp (template Meta com botão URL dinâmico)
    try {
      const cliente: any = contrato.associados || contrato.leads || {};
      const telefoneCliente = cliente.telefone;
      const nomeCliente = cliente.nome;
      const veiculoLabel = [contrato.leads?.veiculo_modelo, contrato.leads?.veiculo_placa]
        .filter(Boolean).join(' - ') || null;
      await enviarTermoFiliacaoWhatsApp(supabase, {
        contratoId: contrato.id,
        telefone: telefoneCliente,
        nomeCompleto: nomeCliente,
        veiculoLabel,
        numeroContrato: contrato.numero,
        autentiqueUrl: signatureLink,
      });
    } catch (waErr) {
      console.warn('[autentique-create-by-token] envio WhatsApp falhou (não bloqueante):', waErr);
    }

    // Registrar no histórico do lead se existir
    if (contrato.lead_id) {
      await supabase.from("leads_historico").insert({
        lead_id: contrato.lead_id,
        acao: "contrato_enviado",
        descricao: `Termo de Afiliação ${contrato.numero} (${contrato.planos?.nome}) enviado para assinatura via link público`,
        etapa_anterior: "contrato_enviado",
        etapa_nova: "contrato_enviado",
      });

      // Atualizar etapa do lead
      await supabase
        .from("leads")
        .update({ etapa: "contrato_enviado" })
        .eq("id", contrato.lead_id);
    }

    timings.updateDb = Date.now() - t0 - Number(timings.fetchContrato || 0) - Number(timings.generateHtml || 0) - Number(timings.createDocument || 0) - Number(timings.createLinkToSignature || 0);
    timings.total = Date.now() - t0;
    
    console.log("[autentique-create-by-token] Sucesso! Documento criado:", document.id);
    console.log("[autentique-create-by-token] Timings (ms):", JSON.stringify(timings));

    logEdgeFunction({ functionName: "autentique-create-by-token", plataforma: "autentique", operacao: "create-by-token", status: "sucesso", tempoMs: Date.now() - _startTime });

    return new Response(
      JSON.stringify({
        success: true,
        documentId: document.id,
        signatureLink,
        message: "Termo de Afiliação enviado para assinatura com sucesso",
        timingsMs: timings,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[autentique-create-by-token] Erro:", error);

    logEdgeFunction({ functionName: "autentique-create-by-token", plataforma: "autentique", operacao: "create-by-token", status: "erro", erroMensagem: error.message, tempoMs: Date.now() - _startTime });
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
