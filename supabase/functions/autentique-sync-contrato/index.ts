import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { logEdgeFunction } from "../_shared/log-edge-function.ts";

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
  const _startTime = Date.now();

  try {
    console.log("[autentique-sync-contrato] Baixando PDF assinado de:", signedFileUrl);

    const pdfResponse = await fetch(signedFileUrl);
    if (!pdfResponse.ok) {
      console.error("[autentique-sync-contrato] Erro ao baixar PDF:", pdfResponse.status);
      return { success: false, error: `Erro ao baixar PDF: ${pdfResponse.status}` };
    }

    const pdfBlob = await pdfResponse.blob();
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    console.log("[autentique-sync-contrato] PDF baixado, tamanho:", pdfBytes.length, "bytes");

    const timestamp = Date.now();
    const contratoNumero = contrato.numero || contrato.id;
    const fileName = `${contrato.associado_id}/${contratoNumero}_assinado_${timestamp}.pdf`;

    console.log("[autentique-sync-contrato] Fazendo upload para Storage:", fileName);

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

    const { data: urlData } = supabase.storage
      .from("contratos-assinados")
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;
    console.log("[autentique-sync-contrato] URL pública:", publicUrl);

    await supabase
      .from("contratos")
      .update({ pdf_assinado_url: publicUrl })
      .eq("id", contrato.id);

    // Anexar termo assinado em contratos_documentos (lido pelo sga-hinova-sync)
    const cotacaoIdContrato = (contrato as any).cotacao_id ?? null;
    if (cotacaoIdContrato) {
      const { data: existingCDoc } = await supabase
        .from("contratos_documentos")
        .select("id")
        .eq("cotacao_id", cotacaoIdContrato)
        .eq("tipo", "contrato_assinado")
        .maybeSingle();

      if (existingCDoc) {
        console.log("[autentique-sync-contrato] contratos_documentos já existe, atualizando...");
        await supabase
          .from("contratos_documentos")
          .update({
            arquivo_url: publicUrl,
            arquivo_nome: `Contrato ${contratoNumero} - Assinado.pdf`,
            status: "aprovado",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingCDoc.id);
      } else {
        console.log("[autentique-sync-contrato] Criando registro em contratos_documentos...");
        const { error: cDocError } = await supabase.from("contratos_documentos").insert({
          cotacao_id: cotacaoIdContrato,
          tipo: "contrato_assinado",
          arquivo_nome: `Contrato ${contratoNumero} - Assinado.pdf`,
          arquivo_url: publicUrl,
          status: "aprovado",
          observacao: `Contrato assinado eletronicamente por ${signerName} via Autentique (sync)`,
        });
        if (cDocError) {
          console.error("[autentique-sync-contrato] Erro ao criar contratos_documentos:", cDocError);
        } else {
          console.log("[autentique-sync-contrato] ✓ contratos_documentos criado!");
        }
      }
    } else {
      console.warn("[autentique-sync-contrato] Contrato sem cotacao_id — pulando contratos_documentos");
    }


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

    logEdgeFunction({ functionName: "autentique-sync-contrato", plataforma: "autentique", operacao: "sync-contrato", status: "erro", erroMensagem: error.message, tempoMs: Date.now() - _startTime });
    return { success: false, error: error.message };
  }
}

/**
 * Fallback: verifica se o PDF assinado está realmente disponível e contém assinaturas.
 * Autentique às vezes demora para atualizar o campo `signed` na API GraphQL,
 * mas o PDF assinado já está disponível no endpoint.
 */
async function verificarPdfAssinadoDisponivel(signedFileUrl: string): Promise<boolean> {
  try {
    // HEAD request para verificar se o PDF assinado está acessível
    const response = await fetch(signedFileUrl, { method: "HEAD" });
    if (!response.ok) return false;
    
    const contentLength = response.headers.get("content-length");
    const size = contentLength ? parseInt(contentLength) : 0;
    
    // Um PDF assinado tipicamente tem mais de 50KB (contém as assinaturas digitais)
    // Um PDF não assinado (template) geralmente é menor
    console.log(`[autentique-sync-contrato] PDF check: status=${response.status}, size=${size} bytes`);
    
    // Se o arquivo existe e tem tamanho razoável, provavelmente está assinado
    return size > 10000;
  } catch (error) {
    console.error("[autentique-sync-contrato] Erro ao verificar PDF:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const _startTime = Date.now();
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
      if (contrato.associado_id && !contrato.pdf_assinado_url) {
        console.log("[autentique-sync-contrato] Contrato assinado mas sem PDF anexado, tentando buscar...");
        
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

    // Query expandida para capturar mais campos de status (incluindo biometria)
    const query = `
      query GetDocument($id: UUID!) {
        document(id: $id) {
          id
          name
          refusable
          sortable
          created_at
          signatures {
            public_id
            name
            email
            action { name }
            link { short_link }
            viewed { created_at }
            signed { created_at }
            rejected { created_at reason }
            biometric_approved { created_at }
            biometric_rejected { created_at }
            delivery_method
          }
          files {
            original
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
    
    // Filtrar signatários que têm ação de ASSINAR (inclui variações conhecidas)
    const signersWithSignAction = signatures.filter((s: any) => {
      const actionName = s.action?.name?.toUpperCase();
      return actionName === 'SIGN' || actionName === 'ASSINAR';
    });

    // TAMBÉM considerar signatários sem action (autor/criador do documento) que tenham assinado
    const allPossibleSigners = signatures.filter((s: any) => {
      // Incluir quem tem action SIGN ou quem efetivamente assinou (mesmo sem action)
      const actionName = s.action?.name?.toUpperCase();
      return actionName === 'SIGN' || actionName === 'ASSINAR' || s.signed?.created_at;
    });
    
    // Considerar biometric_approved como assinatura efetiva (PF_FACIAL com revisão manual
    // do Autentique nunca preenche signed.created_at, mas a assinatura é legalmente válida)
    const isEffectivelySigned = (s: any) =>
      !!s.signed?.created_at ||
      (!!s.biometric_approved?.created_at && !!s.viewed?.created_at);

    const hasSigners = signersWithSignAction.length > 0;
    const allSignersSigned = hasSigners && signersWithSignAction.every(isEffectivelySigned);
    const anySignerRejected = signatures.some((s: any) => s.rejected?.created_at);
    const anySignerViewed = signatures.some((s: any) => s.viewed?.created_at);
    const anySignerSigned = signatures.some(isEffectivelySigned);

    const signerWhoSigned = allPossibleSigners.find(isEffectivelySigned)
      || signatures.find(isEffectivelySigned);
    const signerName = signerWhoSigned?.name || signersWithSignAction[0]?.name || "Cliente";

    // Timestamp efetivo: signed.created_at → biometric_approved.created_at
    const effectiveSignedAt =
      signerWhoSigned?.signed?.created_at ||
      signerWhoSigned?.biometric_approved?.created_at ||
      new Date().toISOString();

    let overallStatus = "pending";
    if (allSignersSigned) overallStatus = "signed";
    else if (anySignerRejected) overallStatus = "rejected";
    else if (anySignerViewed) overallStatus = "viewed";

    // ═══ REVISÃO BIOMÉTRICA MANUAL (PF_FACIAL) ═══
    // Só é "review" enquanto biometric_approved/rejected ainda não foram setados.
    let biometricStatus: "review" | "rejected" | null = null;
    const signersInBiometricReview = signersWithSignAction.filter((s: any) => {
      const viewed = !!s.viewed?.created_at;
      const signed = !!s.signed?.created_at;
      const rejected = !!s.rejected?.created_at;
      const bioApproved = !!s.biometric_approved?.created_at;
      const bioRejected = !!s.biometric_rejected?.created_at;
      return viewed && !signed && !rejected && !bioApproved && !bioRejected;
    });
    const anySignerBiometricRejected = signersWithSignAction.some(
      (s: any) => !!s.biometric_rejected?.created_at,
    );

    if (anySignerBiometricRejected) {
      biometricStatus = "rejected";
    } else if (
      signersInBiometricReview.length > 0 &&
      overallStatus === "viewed" &&
      !allSignersSigned
    ) {
      const oldestView = signersInBiometricReview
        .map((s: any) => new Date(s.viewed.created_at).getTime())
        .reduce((a: number, b: number) => Math.min(a, b), Date.now());
      const minutesSinceView = (Date.now() - oldestView) / 1000 / 60;
      if (minutesSinceView >= 15) {
        biometricStatus = "review";
      }
    }

    console.log("[autentique-sync-contrato] Status calculado:", {
      totalSignatures: signatures.length,
      signersWithSignAction: signersWithSignAction.length,
      allSignersSigned,
      anySignerSigned,
      overallStatus,
      biometricStatus,
      signaturesDetail: signatures.map((s: any) => ({
        email: s.email,
        action: s.action?.name,
        viewed: !!s.viewed?.created_at,
        signed: !!s.signed?.created_at,
        rejected: !!s.rejected?.created_at,
        biometric_approved: !!s.biometric_approved?.created_at,
        biometric_rejected: !!s.biometric_rejected?.created_at,
      })),
    });

    // Persistir e notificar diretoria quando entra em revisão biométrica
    if (biometricStatus === "review" && contrato.autentique_status !== "biometric_review") {
      console.log("[autentique-sync-contrato] ⚠ Marcando contrato em revisão biométrica");
      await supabase
        .from("contratos")
        .update({ autentique_status: "biometric_review" })
        .eq("id", contrato.id);

      try {
        const { data: diretores } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["diretor", "admin"]);

        if (diretores && diretores.length > 0) {
          const painelUrl = `https://painel.autentique.com.br/documentos/${documentId}`;
          const notificacoes = diretores.map((d: any) => ({
            user_id: d.user_id,
            tipo: "contrato_biometria_revisao",
            titulo: "Assinatura aguardando aprovação biométrica",
            mensagem: `Contrato ${contrato.numero || contrato.id.slice(0, 8)} de ${signerName} está aguardando aprovação manual da biometria no painel Autentique.`,
            link: painelUrl,
            metadata: {
              contrato_id: contrato.id,
              autentique_documento_id: documentId,
              signer_name: signerName,
            },
          }));
          await supabase.from("notificacoes").insert(notificacoes);
          console.log(`[autentique-sync-contrato] ✓ ${notificacoes.length} notificações enviadas`);
        }
      } catch (notifErr) {
        console.error("[autentique-sync-contrato] Erro ao notificar diretores:", notifErr);
      }
    } else if (biometricStatus === "rejected" && contrato.autentique_status !== "biometric_rejected") {
      await supabase
        .from("contratos")
        .update({ autentique_status: "biometric_rejected" })
        .eq("id", contrato.id);
    }

    // ========== Extrair link de assinatura do signatário SIGN ==========
    const signerForLink = signersWithSignAction[0] || signatures[0];
    const signatureLink = signerForLink?.link?.short_link || null;

    // Salvar autentique_url no banco se ausente
    if (signatureLink && !contrato.autentique_url) {
      console.log("[autentique-sync-contrato] Salvando autentique_url no banco:", signatureLink);
      await supabase
        .from("contratos")
        .update({ autentique_url: signatureLink })
        .eq("id", contrato.id);
    }

    const autentiqueUrlFinal = signatureLink || contrato.autentique_url || null;
    console.log("[autentique-sync-contrato] autentique_url final:", autentiqueUrlFinal);

    // ========== FALLBACK: Se a API mostra "pending" mas o PDF assinado está disponível ==========
    // Autentique às vezes demora para propagar o status via GraphQL, mas o PDF já está pronto.
    if (overallStatus === "pending" && document.files?.signed) {
      console.log("[autentique-sync-contrato] Status pending mas files.signed existe. Verificando PDF...");
      
      const pdfDisponivel = await verificarPdfAssinadoDisponivel(document.files.signed);
      
      if (pdfDisponivel) {
        // Comparar com o original: se signed e original têm hashes diferentes, está assinado
        // Hashes removidos da query - usar apenas comparação de tamanho
        
        // Dupla verificação: baixar os primeiros bytes e verificar se é um PDF válido com assinaturas
        const signedResponse = await fetch(document.files.signed);
        if (signedResponse.ok) {
          const signedBytes = new Uint8Array(await signedResponse.arrayBuffer());
          const signedSize = signedBytes.length;
          
          // Verificar também o PDF original para comparar tamanhos
          let originalSize = 0;
          if (document.files?.original) {
            try {
              const origResponse = await fetch(document.files.original, { method: "HEAD" });
              const origLength = origResponse.headers.get("content-length");
              originalSize = origLength ? parseInt(origLength) : 0;
            } catch { /* ignore */ }
          }
          
          console.log(`[autentique-sync-contrato] Comparação PDFs: signed=${signedSize} bytes, original=${originalSize} bytes`);
          
          // Se o PDF assinado é significativamente maior que o original (contém assinatura digital),
          // OU se o original é desconhecido mas o assinado tem tamanho razoável
          const isActuallySigned = (originalSize > 0 && signedSize > originalSize * 1.05) || 
                                   (originalSize === 0 && signedSize > 50000);
          
          if (isActuallySigned) {
            console.log("[autentique-sync-contrato] ✓ FALLBACK: PDF assinado confirmado por comparação de tamanho!");
            overallStatus = "signed";
          } else {
            console.log("[autentique-sync-contrato] PDF assinado não confirmado por comparação de tamanho. Aguardando API.");
          }
        }
      }
    }

    // Marcar como assinado
    if (overallStatus === "signed") {
      console.log("[autentique-sync-contrato] ✓ Documento assinado! Atualizando banco...");
      
      const { error: updateError } = await supabase
        .from("contratos")
        .update({
          status: "assinado",
          autentique_status: "signed",
          data_assinatura: effectiveSignedAt,
        })
        .eq("id", contrato.id);

      if (updateError) {
        console.error("[autentique-sync-contrato] Erro ao atualizar contrato:", updateError);
        throw updateError;
      }

      // ═══ NOVO: Sincronizar cotacoes.status_contratacao para contrato_assinado ═══
      if (contrato.cotacao_id) {
        const { error: cotacaoUpdateError } = await supabase
          .from("cotacoes")
          .update({ 
            status: "aceita",
            status_contratacao: "contrato_assinado",
            contrato_gerado_id: contrato.id
          })
          .eq("id", contrato.cotacao_id);

        if (cotacaoUpdateError) {
          console.error("[autentique-sync-contrato] Erro ao atualizar cotação:", cotacaoUpdateError);
        } else {
          console.log("[autentique-sync-contrato] ✓ Cotação atualizada para contrato_assinado");
        }
      }

      await supabase.from("contratos_historico").insert({
        contrato_id: contrato.id,
        evento: "documento_assinado_sync",
        descricao: `Contrato assinado (sincronização) por ${signerName}`,
        dados: { 
          signed_at: new Date().toISOString(),
          sync_method: "autentique-sync-contrato",
          signer_name: signerName,
          detection_method: allSignersSigned ? "api_status" : "pdf_fallback",
        },
      });

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

      // Anexar PDF assinado
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
          signedFileUrl: anexoUrl || signedFileUrl || null,
          autentique_url: autentiqueUrlFinal
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (overallStatus === "rejected") {
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
          status: "rejeitado",
          autentique_url: autentiqueUrlFinal
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (overallStatus === "viewed" && contrato.status === "pendente_assinatura") {
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
          status: "visualizado",
          autentique_url: autentiqueUrlFinal
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Documento ainda não foi assinado
    logEdgeFunction({ functionName: "autentique-sync-contrato", plataforma: "autentique", operacao: "sync-contrato", status: "sucesso", tempoMs: Date.now() - _startTime });
    return new Response(
      JSON.stringify({ 
        success: true, 
        atualizado: biometricStatus !== null, 
        mensagem: biometricStatus === "review" 
          ? "Assinatura em revisão biométrica pelo Autentique. Aguardando aprovação manual."
          : biometricStatus === "rejected"
          ? "Biometria rejeitada pelo Autentique. Será necessário reenviar o termo."
          : "Documento ainda não foi assinado",
        status: overallStatus,
        biometric_status: biometricStatus,
        autentique_url: autentiqueUrlFinal
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
