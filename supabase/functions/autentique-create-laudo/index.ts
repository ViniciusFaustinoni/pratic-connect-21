// ============================================
// EDGE FUNCTION: autentique-create-laudo
// Cria documento Autentique para assinatura do Laudo de Instalação
// ============================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) {
      throw new Error("AUTENTIQUE_API_KEY não configurada");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { servicoId, laudoPdfUrl } = body;

    if (!servicoId) throw new Error("servicoId é obrigatório");
    if (!laudoPdfUrl) throw new Error("laudoPdfUrl é obrigatório");

    console.log("[autentique-create-laudo] Criando documento para serviço:", servicoId);

    // Buscar serviço com associado
    const { data: servico, error: servicoError } = await supabase
      .from("servicos")
      .select(`
        *,
        associado:associados!servicos_associado_id_fkey(id, nome, email, telefone, whatsapp, cpf),
        veiculo:veiculos!servicos_veiculo_id_fkey(id, placa, marca, modelo)
      `)
      .eq("id", servicoId)
      .single();

    if (servicoError || !servico) {
      throw new Error(`Serviço não encontrado: ${servicoError?.message}`);
    }

    // Verificar duplicidade
    if (servico.laudo_autentique_id) {
      console.log(`[autentique-create-laudo] Serviço já possui documento Autentique: ${servico.laudo_autentique_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          documentId: servico.laudo_autentique_id,
          signatureLink: servico.laudo_autentique_url,
          message: "Documento existente retornado",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const associado = servico.associado;
    if (!associado) {
      throw new Error("Associado não encontrado para o serviço");
    }

    const veiculoDesc = servico.veiculo
      ? `${servico.veiculo.marca} ${servico.veiculo.modelo} - ${servico.veiculo.placa}`
      : "Veículo";

    const nomeDocumento = `Laudo de Instalação - ${veiculoDesc}`;

    // Baixar o PDF do laudo
    console.log("[autentique-create-laudo] Baixando PDF do laudo:", laudoPdfUrl);
    const pdfResponse = await fetch(laudoPdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Erro ao baixar PDF do laudo: ${pdfResponse.status}`);
    }
    const pdfBlob = await pdfResponse.blob();
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    // Converter para base64
    let binary = "";
    for (let i = 0; i < pdfBytes.byteLength; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const pdfBase64 = btoa(binary);

    console.log("[autentique-create-laudo] PDF baixado, tamanho:", pdfBytes.length, "bytes");

    // Criar documento no Autentique via multipart/form-data
    const mutation = `
      mutation CreateDocumentMutation(
        $document: DocumentInput!,
        $signers: [SignerInput!]!,
        $file: Upload!
      ) {
        createDocument(
          sandbox: false,
          document: $document,
          signers: $signers,
          file: $file
        ) {
          id
          name
          signatures {
            public_id
            name
            email
            action { name }
            link { short_link }
          }
        }
      }
    `;

    const variables = {
      document: {
        name: nomeDocumento,
      },
      signers: [
        {
          email: associado.email,
          action: "SIGN",
          name: associado.nome,
          phone: (associado.whatsapp || associado.telefone || "").replace(/\D/g, ""),
          cpf: (associado.cpf || "").replace(/\D/g, ""),
        },
      ],
      file: null,
    };

    // Multipart form upload
    const formData = new FormData();
    formData.append(
      "operations",
      JSON.stringify({ query: mutation, variables })
    );
    formData.append("map", JSON.stringify({ "0": ["variables.file"] }));
    formData.append(
      "0",
      new Blob([pdfBytes], { type: "application/pdf" }),
      `laudo-instalacao-${servico.id}.pdf`
    );

    const autentiqueResponse = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${autentiqueApiKey}`,
      },
      body: formData,
    });

    const autentiqueData = await autentiqueResponse.json();
    console.log("[autentique-create-laudo] Resposta Autentique:", JSON.stringify(autentiqueData, null, 2));

    if (autentiqueData.errors) {
      throw new Error(`Erro Autentique: ${JSON.stringify(autentiqueData.errors)}`);
    }

    const doc = autentiqueData.data?.createDocument;
    if (!doc?.id) {
      throw new Error("Falha ao criar documento no Autentique");
    }

    // Encontrar link de assinatura do signatário SIGN
    const signatures = doc.signatures || [];
    const signerSignature = signatures.find((s: any) => s.action?.name === "SIGN") || signatures[0];
    let signatureLink = signerSignature?.link?.short_link || null;

    // Fallback: gerar link
    if (!signatureLink && signerSignature?.public_id) {
      try {
        const createLinkMutation = `mutation { createLinkToSignature(public_id: "${signerSignature.public_id}") { short_link } }`;
        const linkResp = await fetch(AUTENTIQUE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${autentiqueApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: createLinkMutation }),
        });
        const linkResult = await linkResp.json();
        signatureLink = linkResult?.data?.createLinkToSignature?.short_link || null;
      } catch (linkErr) {
        console.warn("[autentique-create-laudo] Falha ao gerar link:", linkErr);
      }
    }

    console.log("[autentique-create-laudo] Documento criado:", doc.id, "Link:", signatureLink);

    // Salvar no serviço
    const { error: updateError } = await supabase
      .from("servicos")
      .update({
        laudo_autentique_id: doc.id,
        laudo_autentique_url: signatureLink,
        laudo_pdf_url: laudoPdfUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", servicoId);

    if (updateError) {
      console.error("[autentique-create-laudo] Erro ao atualizar serviço:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId: doc.id,
        signatureLink,
        message: "Laudo enviado para assinatura via Autentique",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[autentique-create-laudo] ERRO:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
