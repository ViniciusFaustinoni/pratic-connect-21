// ============================================
// EDGE FUNCTION: autentique-create
// Cria documento Autentique a partir de contratoId
// AGORA LÊ O TEMPLATE DO BANCO DE DADOS
// ============================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { gerarPosicoesAssinatura, buscarPosicoesConfig } from "../_shared/autentique-positions.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { generateTermoAfiliacao, generateSecaoRastreador } from "../_shared/termo-afiliacao-template.ts";
import { mapearDadosParaTemplate, buscarConfiguracoesEmpresa, buscarRegrasVenda } from "../_shared/termo-afiliacao-utils.ts";
import { 
  substituirVariaveis, 
  limparVariaveisNaoSubstituidas,
  generateStyles, 
  generateHeader, 
  generateFooter, 
  generateSecaoAssinatura,
  markdownParaHTML,
  buscarEGerarAditivos,
  hasSignatureArea,
  sanitizeSignatureBlocks,
  exigeRastreador,
  extrairCodigosBeneficios,
} from "../_shared/template-utils.ts";

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
    console.log('[autentique-create] Config rastreador:', result);
    return result;
  } catch (err) {
    console.warn('[autentique-create] Fallback: erro ao buscar config rastreador:', err);
    return { fipeMinCarro: 30000, fipeMinMoto: 9000 };
  }
}

// ============= GERAR HTML A PARTIR DO TEMPLATE DO BANCO =============

async function gerarHTMLDoTemplate(supabase: any, templateConteudo: string, dados: any): Promise<string> {
  // 1. Substituir variáveis no conteúdo do banco
  let conteudoPreenchido = substituirVariaveis(templateConteudo, dados);
  
  // 1b. Limpeza extra: remover qualquer resíduo de "Serviços: {{plano.descricao}}"
  conteudoPreenchido = conteudoPreenchido.replace(
    /<(p|div|td|li|tr)[^>]*>[\s\S]*?Servi([çc]|&ccedil;)os\s*:[\s\S]*?<\/\1>/gi,
    ''
  );
  conteudoPreenchido = conteudoPreenchido.replace(
    /<span[^>]*data-variable="[^"]*plano\.descricao[^"]*"[^>]*>[^<]*<\/span>/gi,
    ''
  );
  conteudoPreenchido = conteudoPreenchido.replace(
    /Servi([çc]|&ccedil;)os\s*:\s*[^\n<]*/gi,
    ''
  );
  
  // 2. Converter markdown para HTML
  let conteudoHTML = markdownParaHTML(conteudoPreenchido);
  
  // 3. Sanitizar blocos de assinatura manual que possam existir no template
  conteudoHTML = sanitizeSignatureBlocks(conteudoHTML);
  
  // 4. Buscar e gerar aditivos dinâmicos (com contexto de benefícios)
  const adicionaisCodigos = extrairCodigosBeneficios(dados);
  const aditivosHTML = await buscarEGerarAditivos(supabase, dados.veiculo, dados, {
    beneficios_codigos: adicionaisCodigos,
    configRastreador: dados.configRastreador,
  });
  
  // Injetar seção de rastreador se obrigatório (não coberta pelos aditivos do banco)
  const rastreadorResult = exigeRastreador(dados.veiculo, dados.configRastreador);
  const rastreadorHTML = rastreadorResult.exige ? generateSecaoRastreador(dados) : '';
  
  // 5. Só injetar assinatura padrão se o conteúdo + aditivos não contiverem uma
  const conteudoCompleto = conteudoHTML + (aditivosHTML || '') + rastreadorHTML;
  const assinaturaHTML = hasSignatureArea(conteudoCompleto) ? '' : generateSecaoAssinatura(dados);
  
  // 6. Montar HTML completo
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Afiliação - ${dados.contrato.numero}</title>
  ${generateStyles()}
</head>
<body>
  <div class="page">
    ${generateHeader(dados)}
    ${conteudoHTML}
    ${aditivosHTML}
    ${rastreadorHTML}
    ${assinaturaHTML}
    ${generateFooter(dados)}
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) {
      throw new Error("AUTENTIQUE_API_KEY não configurada");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Aceita ambos: contratoId ou contrato_id (compatibilidade com frontend)
    const body = await req.json();
    const contratoId = body.contratoId || body.contrato_id;
    const { clienteNome, clienteEmail, clienteCpf, clienteTelefone } = body;
    
    if (!contratoId) {
      throw new Error("contratoId ou contrato_id é obrigatório");
    }

    console.log("[autentique-create] Criando documento para contrato:", contratoId);

    // Buscar dados do contrato com plano e lead
    const { data: contrato, error: contratoError } = await supabase
      .from("contratos")
      .select(`
        *,
        planos (*),
        leads (*),
        associados:associados!fk_contratos_associado(*)
      `)
      .eq("id", contratoId)
      .single();

    if (contratoError || !contrato) {
      throw new Error(`Contrato não encontrado: ${contratoError?.message}`);
    }

    // PROTEÇÃO CONTRA DUPLICIDADE: Verificar se já existe documento Autentique para este contrato
    if (contrato.autentique_documento_id) {
      console.log(`[autentique-create] Contrato já possui documento Autentique: ${contrato.autentique_documento_id}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          documentId: contrato.autentique_documento_id,
          signatureLink: contrato.autentique_url,
          message: "Documento existente retornado - contrato já foi enviado para assinatura",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[autentique-create] Nenhum documento existente, criando novo para contrato ${contratoId}`);

    // ============= BUSCAR NOME DO CONSULTOR/VENDEDOR =============
    let vendedorNome: string | null = null;
    if (contrato.vendedor_id) {
      const { data: vendedorProfile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', contrato.vendedor_id)
        .maybeSingle();
      vendedorNome = vendedorProfile?.nome || null;
      console.log(`[autentique-create] Consultor: ${vendedorNome || 'não encontrado'}`);
    }

    // ============= BUSCAR TEMPLATE DO BANCO DE DADOS =============
    const { data: templatesDB, error: templateError } = await supabase
      .from("documento_templates")
      .select("id, codigo, nome, conteudo, config_layout")
      .eq("is_default_autentique", true)
      .eq("ativo", true)
      .order("updated_at", { ascending: false })
      .limit(2);

    if (templateError) {
      console.warn("[autentique-create] Erro ao buscar template:", templateError.message);
    }
    if (templatesDB && templatesDB.length > 1) {
      console.warn(`[autentique-create] ⚠️ ${templatesDB.length} templates com is_default_autentique=true! Usando o mais recente: ${templatesDB[0].codigo}`);
    }

    const templateDB = templatesDB?.[0] || null;
    const usandoTemplateBanco = !templateError && templateDB?.conteudo;
    
    if (usandoTemplateBanco) {
      console.log(`[autentique-create] Usando template do banco: ${templateDB.codigo} (${templateDB.nome})`);
    } else {
      console.log("[autentique-create] Nenhum template configurado no banco, usando template hardcoded como fallback");
    }

    // ============= BUSCAR CONFIGURAÇÕES DA EMPRESA =============
    const empresaConfig = await buscarConfiguracoesEmpresa(supabase);

    // ============= BUSCAR CONFIG RASTREADOR =============
    const configRastreador = await buscarConfigRastreador(supabase);
    
    // ============= MAPEAR DADOS PARA O TEMPLATE =============
    const templateData = mapearDadosParaTemplate(
      {
        ...contrato,
        cliente_nome: clienteNome || contrato.cliente_nome,
        cliente_cpf: clienteCpf || contrato.cliente_cpf,
        cliente_email: clienteEmail || contrato.cliente_email,
        cliente_telefone: clienteTelefone || contrato.cliente_telefone,
      },
      contrato.planos,
      empresaConfig,
      contrato.leads,
      contrato.associados,
      vendedorNome
    );
    templateData.configRastreador = configRastreador;

    // ============= GERAR HTML DO TERMO DE AFILIAÇÃO =============
    let contratoHTML: string;
    let templateUsado: string;
    
    if (usandoTemplateBanco) {
      // Usar template dinâmico do banco
      contratoHTML = await gerarHTMLDoTemplate(supabase, templateDB.conteudo, templateData);
      templateUsado = `${templateDB.codigo} (banco de dados)`;
    } else {
      // Fallback para template hardcoded
      contratoHTML = generateTermoAfiliacao(templateData);
      templateUsado = "Termo de Afiliação (hardcoded fallback)";
    }
    
    // Limpeza final: garantir que nenhuma variável bruta apareça no HTML
    contratoHTML = limparVariaveisNaoSubstituidas(contratoHTML);

    console.log(`[autentique-create] Template usado: ${templateUsado}`);
    console.log(`[autentique-create] HTML gerado: ${contratoHTML.length} bytes`);

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

    // Priorizar campos cliente_* do contrato
    const signerName = clienteNome || contrato.cliente_nome || contrato.leads?.nome || contrato.associados?.nome;
    const signerEmail = clienteEmail || contrato.cliente_email || contrato.leads?.email || contrato.associados?.email;
    const documentName = `Termo de Afiliação ${contrato.numero} - ${signerName || 'Cliente'}`;
    
    console.log("[autentique-create] Dados do signatário:", { signerName, signerEmail });
    
    // Validar que temos dados mínimos do signatário
    if (!signerEmail && !signerName) {
      throw new Error("Dados do signatário não encontrados. Preencha nome e email do cliente no contrato.");
    }
    
    // Preparar operations JSON
    const operations = {
      query: mutation,
      variables: {
        document: {
          name: documentName,
        },
        signers: [
          {
            name: signerName || undefined,
            email: signerEmail,
            action: "SIGN",
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

    console.log("[autentique-create] Enviando para Autentique via multipart/form-data...");
    console.log("[autentique-create] Document name:", documentName);
    console.log("[autentique-create] Signer email:", signerEmail);

    const autentiqueResponse = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${autentiqueApiKey}`,
      },
      body: formData,
    });

    const autentiqueData = await autentiqueResponse.json();
    
    console.log("[autentique-create] Resposta Autentique:", JSON.stringify(autentiqueData, null, 2));

    if (autentiqueData.errors) {
      throw new Error(`Erro Autentique: ${JSON.stringify(autentiqueData.errors)}`);
    }

    const document = autentiqueData.data?.createDocument;
    if (!document) {
      throw new Error("Documento não foi criado no Autentique");
    }

    // Obter link de assinatura
    const signatureLink = document.signatures?.[0]?.link?.short_link;

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
      .eq("id", contratoId);

    if (updateError) {
      console.error("[autentique-create] Erro ao atualizar contrato:", updateError);
    }

    // Registrar no histórico do contrato
    await supabase.from("contratos_historico").insert({
      contrato_id: contratoId,
      evento: "enviado_assinatura",
      descricao: `Termo de Afiliação enviado para assinatura via Autentique`,
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
          body: JSON.stringify({ telefone: telefoneWpp, template_name: 'assinatura_documento', params: [signerName, nomeDoc], button_params: [linkCode] }),
        });
        console.log('[autentique-create] WhatsApp assinatura enviado para', telefoneWpp);
      }
    } catch (whatsErr) {
      console.error('[autentique-create] Erro ao enviar WhatsApp assinatura (não-fatal):', whatsErr);
    }

    // Registrar no histórico do lead
    if (contrato.lead_id) {
      await supabase.from("leads_historico").insert({
        lead_id: contrato.lead_id,
        acao: "contrato_enviado",
        descricao: `Termo de Afiliação ${contrato.numero} (${contrato.planos?.nome}) enviado para assinatura`,
        etapa_anterior: "contrato_enviado",
        etapa_nova: "contrato_enviado",
      });

      // Atualizar etapa do lead
      await supabase
        .from("leads")
        .update({ etapa: "contrato_enviado" })
        .eq("id", contrato.lead_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId: document.id,
        signatureLink,
        templateUsed: templateUsado,
        message: "Termo de Afiliação enviado para assinatura com sucesso",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[autentique-create] Erro:", error);
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
