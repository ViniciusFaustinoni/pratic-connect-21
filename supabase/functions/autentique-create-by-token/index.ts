// ============================================
// EDGE FUNCTION: autentique-create-by-token
// Cria documento Autentique a partir de link_token (uso público)
// ============================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { gerarPosicoesAssinatura, buscarPosicoesConfig } from "../_shared/autentique-positions.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { generateTermoAfiliacao, generateSecaoRastreador } from "../_shared/termo-afiliacao-template.ts";
import { mapearDadosParaTemplate, buscarConfiguracoesEmpresa } from "../_shared/termo-afiliacao-utils.ts";
import { buscarEGerarAditivos, substituirVariaveis, limparVariaveisNaoSubstituidas, generateStyles, generateHeader, generateFooter, generateSecaoAssinatura, markdownParaHTML, hasSignatureArea, sanitizeSignatureBlocks, exigeRastreador, extrairCodigosBeneficios } from "../_shared/template-utils.ts";

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
      contrato.associados
    );
    templateData.configRastreador = configRastreador;

    // ============= BUSCAR TEMPLATE DO BANCO =============
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
      console.warn(`[autentique-create-by-token] ⚠️ ${templatesDB.length} templates com is_default_autentique=true! Usando o mais recente: ${templatesDB[0].codigo}`);
    }

    const templateDB = templatesDB?.[0] || null;
    const usandoTemplateBanco = !templateError && templateDB?.conteudo;

    // ============= GERAR HTML DO TERMO DE AFILIAÇÃO =============
    let contratoHTML: string;
    let templateUsado: string;

    if (usandoTemplateBanco) {
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

      // Só injetar assinatura padrão se o conteúdo + aditivos não contiverem uma
      const conteudoCompleto = conteudoHTML + (aditivosHTML || '') + rastreadorHTML;
      const assinaturaHTML = hasSignatureArea(conteudoCompleto) ? '' : generateSecaoAssinatura(templateData);

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
    ${aditivosHTML}
    ${rastreadorHTML}
    ${assinaturaHTML}
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

    // Limpeza final: garantir que nenhuma variável bruta apareça no HTML
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
    
    // Preparar operations JSON
    const operations = {
      query: mutation,
      variables: {
        document: {
          name: documentName,
        },
        signers: [
          {
            name: clienteNome,
            email: clienteEmail,
            action: "SIGN",
            delivery_method: "DELIVERY_METHOD_LINK",
            positions: gerarPosicoesAssinatura(await buscarPosicoesConfig(supabase)),
          },
        ],
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

    // Enviar link de assinatura via WhatsApp (fire-and-forget)
    try {
      const telefoneWpp = clienteTelefone || contrato.cliente_telefone || contrato.associados?.telefone || contrato.leads?.telefone;
      if (signatureLink && telefoneWpp) {
        const linkCode = signatureLink.replace('https://assina.ae/', '');
        const nomeDoc = `Termo de Afiliação ${contrato.numero}`;
        await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ telefone: telefoneWpp, template_name: 'assinatura_documento', params: [clienteNome, nomeDoc], button_params: [linkCode] }),
        });
        console.log('[autentique-create-by-token] WhatsApp assinatura enviado para', telefoneWpp);
      }
    } catch (whatsErr) {
      console.error('[autentique-create-by-token] Erro ao enviar WhatsApp assinatura (não-fatal):', whatsErr);
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
