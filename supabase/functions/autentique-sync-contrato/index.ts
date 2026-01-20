import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";

/**
 * Função para baixar o PDF assinado do Autentique e anexar nos documentos do associado
 */
async function anexarContratoAssinado(
  supabase: any,
  contrato: any,
  signedFileUrl: string,
  signerName: string = "Cliente"
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    console.log("[autentique-sync-contrato] Baixando PDF assinado de:", signedFileUrl);

    // Baixar o PDF
    const pdfResponse = await fetch(signedFileUrl);
    if (!pdfResponse.ok) {
      console.error("[autentique-sync-contrato] Erro ao baixar PDF:", pdfResponse.status);
      return { success: false, error: `Erro ao baixar PDF: ${pdfResponse.status}` };
    }

    const pdfBlob = await pdfResponse.blob();
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    console.log("[autentique-sync-contrato] PDF baixado, tamanho:", pdfBytes.length, "bytes");

    // Gerar nome do arquivo
    const timestamp = Date.now();
    const contratoNumero = contrato.numero || contrato.id;
    const fileName = `${contrato.associado_id}/${contratoNumero}_assinado_${timestamp}.pdf`;

    console.log("[autentique-sync-contrato] Fazendo upload para Storage:", fileName);

    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("contratos-assinados")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("[autentique-sync-contrato] Erro no upload:", uploadError);
      return { success: false, error: uploadError.message };
    }

    console.log("[autentique-sync-contrato] ✓ Upload concluído:", uploadData.path);

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from("contratos-assinados")
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;
    console.log("[autentique-sync-contrato] URL pública:", publicUrl);

    // Atualizar contrato com URL do PDF assinado
    await supabase
      .from("contratos")
      .update({ pdf_assinado_url: publicUrl })
      .eq("id", contrato.id);

    // Verificar se já existe documento anexado para este contrato
    const { data: existingDoc } = await supabase
      .from("documentos")
      .select("id")
      .eq("associado_id", contrato.associado_id)
      .eq("tipo", "contrato_assinado")
      .eq("contrato_id", contrato.id)
      .maybeSingle();

    if (existingDoc) {
      console.log("[autentique-sync-contrato] Documento já existe, atualizando...");
      await supabase
        .from("documentos")
        .update({
          arquivo_url: publicUrl,
          nome_arquivo: `Contrato ${contratoNumero} - Assinado.pdf`,
          status: "aprovado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingDoc.id);
    } else {
      // Criar registro na tabela documentos
      console.log("[autentique-sync-contrato] Criando registro de documento...");
      const { error: docError } = await supabase.from("documentos").insert({
        associado_id: contrato.associado_id,
        contrato_id: contrato.id,
        tipo: "contrato_assinado",
        nome_arquivo: `Contrato ${contratoNumero} - Assinado.pdf`,
        arquivo_url: publicUrl,
        status: "aprovado", // Já está aprovado pela assinatura digital
        observacao: `Contrato assinado eletronicamente por ${signerName} via Autentique (sync)`,
      });

      if (docError) {
        console.error("[autentique-sync-contrato] Erro ao criar documento:", docError);
        // Não falha a operação principal, apenas loga
      } else {
        console.log("[autentique-sync-contrato] ✓ Documento criado com sucesso!");
      }
    }

    // Registrar no histórico do associado
    if (contrato.associado_id) {
      await supabase.from("associados_historico").insert({
        associado_id: contrato.associado_id,
        tipo: "documento_anexado",
        descricao: `Contrato ${contratoNumero} assinado anexado automaticamente (sync)`,
        contrato_id: contrato.id,
        metadata: {
          arquivo_url: publicUrl,
          assinado_por: signerName,
          via: "autentique-sync",
        },
      });
    }

    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error("[autentique-sync-contrato] Erro ao anexar contrato:", error.message);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) {
      throw new Error("AUTENTIQUE_API_KEY não configurada");
    }

    const { contratoId, contratoToken } = await req.json();

    if (!contratoId && !contratoToken) {
      throw new Error("contratoId ou contratoToken é obrigatório");
    }

    console.log("[autentique-sync-contrato] Sincronizando contrato:", { contratoId, contratoToken });

    // Buscar contrato
    let contrato: any = null;
    
    if (contratoId) {
      const { data, error } = await supabase
        .from("contratos")
        .select("*")
        .eq("id", contratoId)
        .maybeSingle();
      
      if (error) throw error;
      contrato = data;
    } else if (contratoToken) {
      const { data, error } = await supabase
        .from("contratos")
        .select("*")
        .eq("link_token", contratoToken)
        .maybeSingle();
      
      if (error) throw error;
      contrato = data;
    }

    if (!contrato) {
      throw new Error("Contrato não encontrado");
    }

    console.log("[autentique-sync-contrato] Contrato encontrado:", contrato.numero, "Status atual:", contrato.status);

    // Se já está assinado, verificar se precisa anexar o documento
    if (contrato.status === "assinado" || contrato.status === "ativo") {
      // Verificar se já tem documento anexado
      if (contrato.associado_id && !contrato.pdf_assinado_url) {
        console.log("[autentique-sync-contrato] Contrato assinado mas sem PDF anexado, tentando buscar...");
        
        // Consultar Autentique para obter URL do PDF
        const documentId = contrato.autentique_documento_id;
        if (documentId) {
          const query = `
            query GetDocument($id: UUID!) {
              document(id: $id) {
                files { signed }
              }
            }
          `;

          const response = await fetch(AUTENTIQUE_API_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${autentiqueApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query, variables: { id: documentId } }),
          });

          const data = await response.json();
          const signedFileUrl = data.data?.document?.files?.signed;

          if (signedFileUrl) {
            const anexoResult = await anexarContratoAssinado(supabase, contrato, signedFileUrl);
            if (anexoResult.success) {
              return new Response(
                JSON.stringify({ 
                  success: true, 
                  atualizado: true, 
                  mensagem: "PDF assinado anexado com sucesso!",
                  status: contrato.status,
                  signedFileUrl: anexoResult.url
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      }

      console.log("[autentique-sync-contrato] Contrato já está assinado/ativo");
      return new Response(
        JSON.stringify({ 
          success: true, 
          atualizado: false, 
          mensagem: "Contrato já está assinado",
          status: contrato.status 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se tem autentique_documento_id
    if (!contrato.autentique_documento_id) {
      console.log("[autentique-sync-contrato] Contrato não tem autentique_documento_id");
      return new Response(
        JSON.stringify({ 
          success: false, 
          atualizado: false, 
          mensagem: "Contrato não foi enviado para assinatura ainda" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Consultar status no Autentique
    const documentId = contrato.autentique_documento_id;
    console.log("[autentique-sync-contrato] Consultando Autentique para documento:", documentId);

    const query = `
      query GetDocument($id: UUID!) {
        document(id: $id) {
          id
          name
          signatures {
            public_id
            name
            email
            action { name }
            viewed { created_at }
            signed { created_at }
            rejected { created_at reason }
          }
          files {
            signed
          }
        }
      }
    `;

    const response = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${autentiqueApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { id: documentId },
      }),
    });

    const data = await response.json();

    console.log("[autentique-sync-contrato] Resposta Autentique:", JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error("[autentique-sync-contrato] Erro Autentique:", data.errors);
      throw new Error(`Erro Autentique: ${JSON.stringify(data.errors)}`);
    }

    const document = data.data?.document;
    if (!document) {
      throw new Error("Documento não encontrado no Autentique");
    }

    // Processar status das assinaturas
    const signatures = document.signatures || [];
    
    // Filtrar apenas signatários que têm ação de ASSINAR
    const signersWithSignAction = signatures.filter((s: any) => 
      s.action?.name === 'SIGN' || s.action?.name === 'Assinar'
    );
    
    // Verificar se todos assinaram
    const hasSigners = signersWithSignAction.length > 0;
    const allSignersSigned = hasSigners && signersWithSignAction.every((s: any) => s.signed?.created_at);
    const anySignerRejected = signersWithSignAction.some((s: any) => s.rejected?.created_at);
    const anySignerViewed = signersWithSignAction.some((s: any) => s.viewed?.created_at);
    
    // Encontrar quem assinou
    const signerWhoSigned = signersWithSignAction.find((s: any) => s.signed?.created_at);
    const signerName = signerWhoSigned?.name || "Cliente";

    let overallStatus = "pending";
    if (allSignersSigned) overallStatus = "signed";
    else if (anySignerRejected) overallStatus = "rejected";
    else if (anySignerViewed) overallStatus = "viewed";

    console.log("[autentique-sync-contrato] Status calculado:", {
      totalSignatures: signatures.length,
      signersWithSignAction: signersWithSignAction.length,
      allSignersSigned,
      overallStatus
    });

    // Se está assinado, atualizar o banco
    if (overallStatus === "signed") {
      console.log("[autentique-sync-contrato] ✓ Documento assinado! Atualizando banco...");
      
      const { error: updateError } = await supabase
        .from("contratos")
        .update({
          status: "assinado",
          autentique_status: "signed",
          data_assinatura: new Date().toISOString()
        })
        .eq("id", contrato.id);

      if (updateError) {
        console.error("[autentique-sync-contrato] Erro ao atualizar contrato:", updateError);
        throw updateError;
      }

      // Registrar histórico
      await supabase.from("contratos_historico").insert({
        contrato_id: contrato.id,
        evento: "documento_assinado_sync",
        descricao: `Contrato assinado (sincronização manual) por ${signerName}`,
        dados: { 
          signed_at: new Date().toISOString(),
          sync_method: "autentique-sync-contrato",
          signer_name: signerName
        },
      });

      // Atualizar lead se existir
      if (contrato.lead_id) {
        await supabase
          .from("leads")
          .update({ etapa: "contrato_assinado" })
          .eq("id", contrato.lead_id);
        
        await supabase.from("leads_historico").insert({
          lead_id: contrato.lead_id,
          acao: "contrato_assinado",
          descricao: `Contrato ${contrato.numero} assinado por ${signerName} (sincronização)`,
          etapa_anterior: "contrato_enviado",
          etapa_nova: "contrato_assinado",
        });
      }

      console.log("[autentique-sync-contrato] ✓ Contrato atualizado com sucesso!");

      // ========== NOVO: Anexar PDF assinado nos documentos do associado ==========
      let anexoUrl: string | null = null;
      const signedFileUrl = document.files?.signed;
      
      if (signedFileUrl && contrato.associado_id) {
        console.log("[autentique-sync-contrato] Iniciando anexação do contrato assinado...");
        const anexoResult = await anexarContratoAssinado(supabase, contrato, signedFileUrl, signerName);
        if (anexoResult.success) {
          console.log("[autentique-sync-contrato] ✓ Contrato anexado com sucesso:", anexoResult.url);
          anexoUrl = anexoResult.url || null;
        } else {
          console.log("[autentique-sync-contrato] ⚠ Falha ao anexar contrato:", anexoResult.error);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          atualizado: true, 
          mensagem: "Assinatura confirmada e contrato atualizado!",
          status: "assinado",
          signedFileUrl: anexoUrl || signedFileUrl || null
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (overallStatus === "rejected") {
      // Atualizar para rejeitado
      await supabase
        .from("contratos")
        .update({
          status: "rejeitado",
          autentique_status: "rejected"
        })
        .eq("id", contrato.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          atualizado: true, 
          mensagem: "Documento foi rejeitado",
          status: "rejeitado"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (overallStatus === "viewed" && contrato.status === "pendente_assinatura") {
      // Atualizar para visualizado
      await supabase
        .from("contratos")
        .update({
          status: "visualizado",
          autentique_status: "viewed"
        })
        .eq("id", contrato.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          atualizado: true, 
          mensagem: "Documento foi visualizado",
          status: "visualizado"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Documento ainda não foi assinado
    return new Response(
      JSON.stringify({ 
        success: true, 
        atualizado: false, 
        mensagem: "Documento ainda não foi assinado",
        status: overallStatus
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[autentique-sync-contrato] Erro:", error.message);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});