import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";

// Interface atualizada para refletir o payload REAL do Autentique
interface AutentiqueWebhookPayload {
  id: string;
  object: string;
  name: string;
  format: string;
  url: string;
  event: {
    id: string;
    object: string;
    organization: number;
    type: string; // "signature.accepted", "signature.updated", "signature.viewed", "signature.rejected"
    data: {
      public_id: string;
      object: string;
      user: {
        name: string | null;
        company: string | null;
        email: string;
        phone: string | null;
        cpf: string | null;
        cnpj: string | null;
        birthday: string | null;
      };
      document: string; // ID do documento no Autentique
      events: Array<{
        type: string;
        document: string;
        user: {
          uuid: string;
          name: string;
          email: string;
          cpf: string | null;
        };
        geolocation?: {
          country: string;
          city: string;
          state: string;
        };
        created_at: string;
      }>;
      mail: {
        sent: string | null;
        opened: string | null;
        delivered: string | null;
      };
      action: string;
      viewed: string | null;
      signed: string | null;
      rejected: string | null;
      reason: string | null;
      created_at: string;
    };
    created_at: string;
  };
}

/**
 * Função para baixar o PDF assinado do Autentique e anexar nos documentos do associado
 */
async function anexarContratoAssinado(
  supabase: any,
  contrato: any,
  documentId: string,
  signerName: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) {
      console.log("[autentique-webhook] AUTENTIQUE_API_KEY não configurada, pulando anexo do PDF");
      return { success: false, error: "API key não configurada" };
    }

    console.log("[autentique-webhook] Buscando URL do PDF assinado no Autentique...");

    // Consultar Autentique para obter URL do PDF assinado
    const query = `
      query GetDocument($id: UUID!) {
        document(id: $id) {
          id
          name
          files {
            signed
            original
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
    console.log("[autentique-webhook] Resposta Autentique files:", JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error("[autentique-webhook] Erro ao buscar documento:", data.errors);
      return { success: false, error: JSON.stringify(data.errors) };
    }

    const signedFileUrl = data.data?.document?.files?.signed;
    if (!signedFileUrl) {
      console.log("[autentique-webhook] PDF assinado ainda não disponível");
      return { success: false, error: "PDF assinado não disponível" };
    }

    console.log("[autentique-webhook] URL do PDF assinado:", signedFileUrl);

    // Baixar o PDF
    const pdfResponse = await fetch(signedFileUrl);
    if (!pdfResponse.ok) {
      console.error("[autentique-webhook] Erro ao baixar PDF:", pdfResponse.status);
      return { success: false, error: `Erro ao baixar PDF: ${pdfResponse.status}` };
    }

    const pdfBlob = await pdfResponse.blob();
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    console.log("[autentique-webhook] PDF baixado, tamanho:", pdfBytes.length, "bytes");

    // Gerar nome do arquivo
    const timestamp = Date.now();
    const contratoNumero = contrato.numero || contrato.id;
    const fileName = `${contrato.associado_id}/${contratoNumero}_assinado_${timestamp}.pdf`;

    console.log("[autentique-webhook] Fazendo upload para Storage:", fileName);

    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("contratos-assinados")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("[autentique-webhook] Erro no upload:", uploadError);
      return { success: false, error: uploadError.message };
    }

    console.log("[autentique-webhook] ✓ Upload concluído:", uploadData.path);

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from("contratos-assinados")
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;
    console.log("[autentique-webhook] URL pública:", publicUrl);

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
      console.log("[autentique-webhook] Documento já existe, atualizando...");
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
      console.log("[autentique-webhook] Criando registro de documento...");
      const { error: docError } = await supabase.from("documentos").insert({
        associado_id: contrato.associado_id,
        contrato_id: contrato.id,
        tipo: "contrato_assinado",
        nome_arquivo: `Contrato ${contratoNumero} - Assinado.pdf`,
        arquivo_url: publicUrl,
        status: "aprovado", // Já está aprovado pela assinatura digital
        observacao: `Contrato assinado eletronicamente por ${signerName} via Autentique`,
      });

      if (docError) {
        console.error("[autentique-webhook] Erro ao criar documento:", docError);
        // Não falha a operação principal, apenas loga
      } else {
        console.log("[autentique-webhook] ✓ Documento criado com sucesso!");
      }
    }

    // Registrar no histórico do associado
    if (contrato.associado_id) {
      await supabase.from("associados_historico").insert({
        associado_id: contrato.associado_id,
        tipo: "documento_anexado",
        descricao: `Contrato ${contratoNumero} assinado anexado automaticamente`,
        contrato_id: contrato.id,
        metadata: {
          arquivo_url: publicUrl,
          assinado_por: signerName,
          via: "autentique",
        },
      });
    }

    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error("[autentique-webhook] Erro ao anexar contrato:", error.message);
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

    const payload: AutentiqueWebhookPayload = await req.json();
    
    console.log("[autentique-webhook] ========== WEBHOOK RECEBIDO ==========");
    console.log("[autentique-webhook] Timestamp:", new Date().toISOString());
    console.log("[autentique-webhook] Payload completo:", JSON.stringify(payload, null, 2));

    // NOVA ESTRUTURA: Extrair o ID do documento de payload.event.data.document
    const documentId = payload.event?.data?.document;
    const eventType = payload.event?.type;
    
    console.log("[autentique-webhook] Document ID extraído:", documentId);
    console.log("[autentique-webhook] Tipo de evento:", eventType);
    
    if (!documentId) {
      console.error("[autentique-webhook] ERRO: Document ID não encontrado no payload");
      return new Response(JSON.stringify({ received: true, error: "Document ID not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[autentique-webhook] Processando evento: ${eventType} para documento: ${documentId}`);

    // Buscar contrato pelo documento_id do Autentique
    let contrato: any = null;
    
    const { data: contratoByDocId, error: contratoError } = await supabase
      .from("contratos")
      .select("*, leads (*)")
      .eq("autentique_documento_id", documentId)
      .maybeSingle();

    if (contratoError) {
      console.error("[autentique-webhook] ERRO ao buscar contrato:", contratoError);
      return new Response(JSON.stringify({ received: true, error: "Database error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    contrato = contratoByDocId;

    // FALLBACK: Se não encontrou pelo documento_id, tentar buscar por email do signatário
    if (!contrato) {
      const signerEmail = payload.event?.data?.user?.email;
      const signerPhone = payload.event?.data?.user?.phone;
      
      console.log("[autentique-webhook] Contrato não encontrado por documento_id, tentando fallback por email...");
      console.log("[autentique-webhook] Email do signatário:", signerEmail);
      console.log("[autentique-webhook] Telefone do signatário:", signerPhone);
      
      if (signerEmail) {
        // FALLBACK 1: Buscar por email do cliente com ILIKE (case-insensitive)
        const { data: contratoByEmail } = await supabase
          .from("contratos")
          .select("*, leads (*)")
          .ilike("cliente_email", signerEmail)
          .in("status", ["pendente_assinatura", "enviado", "visualizado"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (contratoByEmail) {
          console.log("[autentique-webhook] ✓ Contrato encontrado por email:", contratoByEmail.numero);
          console.log("[autentique-webhook] Atualizando autentique_documento_id para:", documentId);
          
          // Atualizar o autentique_documento_id para o ID correto
          await supabase
            .from("contratos")
            .update({ autentique_documento_id: documentId })
            .eq("id", contratoByEmail.id);
          
          contrato = contratoByEmail;
        }
      }
      
      // FALLBACK 2: Buscar pelo email do lead associado
      if (!contrato && signerEmail) {
        console.log("[autentique-webhook] Tentando fallback por email do lead...");
        
        const { data: contratoByLeadEmail } = await supabase
          .from("contratos")
          .select("*, leads!inner (*)")
          .ilike("leads.email", signerEmail)
          .in("status", ["pendente_assinatura", "enviado", "visualizado"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (contratoByLeadEmail) {
          console.log("[autentique-webhook] ✓ Contrato encontrado por email do lead:", contratoByLeadEmail.numero);
          console.log("[autentique-webhook] Atualizando autentique_documento_id para:", documentId);
          
          await supabase
            .from("contratos")
            .update({ autentique_documento_id: documentId })
            .eq("id", contratoByLeadEmail.id);
          
          contrato = contratoByLeadEmail;
        }
      }
      
      // FALLBACK 3: Tentar buscar pelo telefone se email não funcionou
      if (!contrato && signerPhone) {
        const phoneClean = signerPhone.replace(/\D/g, '');
        console.log("[autentique-webhook] Tentando fallback por telefone:", phoneClean);
        
        const { data: contratoByPhone } = await supabase
          .from("contratos")
          .select("*, leads (*)")
          .or(`cliente_telefone.ilike.%${phoneClean}%,cliente_whatsapp.ilike.%${phoneClean}%`)
          .in("status", ["pendente_assinatura", "enviado", "visualizado"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (contratoByPhone) {
          console.log("[autentique-webhook] ✓ Contrato encontrado por telefone:", contratoByPhone.numero);
          console.log("[autentique-webhook] Atualizando autentique_documento_id para:", documentId);
          
          await supabase
            .from("contratos")
            .update({ autentique_documento_id: documentId })
            .eq("id", contratoByPhone.id);
          
          contrato = contratoByPhone;
        }
      }
    }

    // ========== FALLBACK: Buscar em sinistros ==========
    if (!contrato) {
      console.log("[autentique-webhook] Contrato não encontrado, tentando buscar em sinistros...");
      
      const { data: sinistroDoc, error: sinistroError } = await supabase
        .from("sinistros")
        .select(`
          *,
          associado:associados(id, nome, cpf, telefone, whatsapp, email)
        `)
        .eq("autentique_documento_id", documentId)
        .maybeSingle();

      if (!sinistroError && sinistroDoc) {
        console.log(`[autentique-webhook] ✓ Sinistro encontrado: ${sinistroDoc.protocolo}`);
        
        const signerData = payload.event?.data?.user;
        const signerName = signerData?.name || sinistroDoc.associado?.nome || "Associado";

        if (eventType === "signature.accepted" || (eventType === "signature.updated" && payload.event?.data?.signed)) {
          console.log(`[autentique-webhook] 🎉 Termo de evento ${sinistroDoc.protocolo} ASSINADO por ${signerName}`);

          // Atualizar sinistro
          await supabase
            .from("sinistros")
            .update({
              termo_anuencia_assinado: true,
              termo_anuencia_assinado_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", sinistroDoc.id);

          // Registrar histórico
          await supabase.from("sinistro_historico").insert({
            sinistro_id: sinistroDoc.id,
            status_anterior: sinistroDoc.status,
            status_novo: sinistroDoc.status,
            observacao: `Termo de Entrada de Evento assinado eletronicamente por ${signerName} via Autentique`,
          });

          // Tentar baixar PDF assinado e salvar
          try {
            const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
            if (autentiqueApiKey) {
              const pdfQuery = `query { document(id: "${documentId}") { files { signed } } }`;
              const pdfResp = await fetch(AUTENTIQUE_API_URL, {
                method: "POST",
                headers: { "Authorization": `Bearer ${autentiqueApiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ query: pdfQuery }),
              });
              const pdfData = await pdfResp.json();
              const signedUrl = pdfData.data?.document?.files?.signed;
              
              if (signedUrl) {
                const pdfResponse = await fetch(signedUrl);
                if (pdfResponse.ok) {
                  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
                  const fileName = `sinistros/${sinistroDoc.id}/termo-evento-assinado-${Date.now()}.pdf`;
                  
                  await supabase.storage.from("contratos-assinados").upload(fileName, pdfBytes, {
                    contentType: "application/pdf",
                    upsert: false,
                  });

                  const { data: urlData } = supabase.storage.from("contratos-assinados").getPublicUrl(fileName);

                  await supabase
                    .from("sinistros")
                    .update({ termo_anuencia_url: urlData.publicUrl })
                    .eq("id", sinistroDoc.id);

                  console.log("[autentique-webhook] ✓ PDF assinado do termo de evento salvo");
                }
              }
            }
          } catch (pdfErr: any) {
            console.error("[autentique-webhook] Erro ao baixar PDF do termo:", pdfErr.message);
          }

          // Notificar responsável
          if (sinistroDoc.analista_id) {
            await supabase.from("notificacoes").insert({
              user_id: sinistroDoc.analista_id,
              titulo: "Termo de Evento Assinado! ✅",
              mensagem: `O termo do evento ${sinistroDoc.protocolo} foi assinado por ${signerName}.`,
              tipo: "success",
              link: `/eventos/sinistros/${sinistroDoc.id}`,
            });
          }
        } else if (eventType === "signature.viewed") {
          console.log(`[autentique-webhook] Termo de evento ${sinistroDoc.protocolo} visualizado`);
        }

        return new Response(
          JSON.stringify({ received: true, processed: eventType, type: "sinistro", documentId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ========== FALLBACK 3: Buscar em ordens_servico ==========
      console.log("[autentique-webhook] Sinistro não encontrado, tentando buscar em ordens_servico...");

      const { data: osDoc, error: osError } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          associado:associados(id, nome, cpf, telefone, whatsapp, email)
        `)
        .eq("autentique_documento_id", documentId)
        .maybeSingle();

      if (!osError && osDoc) {
        console.log(`[autentique-webhook] ✓ Ordem de Serviço encontrada: ${osDoc.numero}`);

        const signerData = payload.event?.data?.user;
        const signerName = signerData?.name || osDoc.associado?.nome || "Associado";

        if (eventType === "signature.accepted" || (eventType === "signature.updated" && payload.event?.data?.signed)) {
          console.log(`[autentique-webhook] 🎉 Termo de Saída de Veículo OS ${osDoc.numero} ASSINADO por ${signerName}`);

          await supabase
            .from("ordens_servico")
            .update({
              termo_saida_assinado: true,
              termo_saida_assinado_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", osDoc.id);

          // Registrar histórico
          await supabase.from("ordens_servico_historico").insert({
            ordem_servico_id: osDoc.id,
            status_novo: osDoc.status,
            observacao: `Termo de Saída de Veículo assinado eletronicamente por ${signerName} via Autentique`,
          });

          // Tentar baixar PDF assinado
          try {
            const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
            if (autentiqueApiKey) {
              const pdfQuery = `query { document(id: "${documentId}") { files { signed } } }`;
              const pdfResp = await fetch(AUTENTIQUE_API_URL, {
                method: "POST",
                headers: { "Authorization": `Bearer ${autentiqueApiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ query: pdfQuery }),
              });
              const pdfData = await pdfResp.json();
              const signedUrl = pdfData.data?.document?.files?.signed;

              if (signedUrl) {
                const pdfResponse = await fetch(signedUrl);
                if (pdfResponse.ok) {
                  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
                  const fileName = `ordens-servico/${osDoc.id}/termo-saida-assinado-${Date.now()}.pdf`;

                  await supabase.storage.from("contratos-assinados").upload(fileName, pdfBytes, {
                    contentType: "application/pdf",
                    upsert: false,
                  });

                  const { data: urlData } = supabase.storage.from("contratos-assinados").getPublicUrl(fileName);

                  await supabase
                    .from("ordens_servico")
                    .update({ termo_saida_url: urlData.publicUrl })
                    .eq("id", osDoc.id);

                  console.log("[autentique-webhook] ✓ PDF assinado do termo de saída salvo");
                }
              }
            }
          } catch (pdfErr: any) {
            console.error("[autentique-webhook] Erro ao baixar PDF do termo de saída:", pdfErr.message);
          }
        } else if (eventType === "signature.viewed") {
          console.log(`[autentique-webhook] Termo de saída OS ${osDoc.numero} visualizado`);
        }

        return new Response(
          JSON.stringify({ received: true, processed: eventType, type: "ordem_servico", documentId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ========== FALLBACK 4: Buscar em contratos (cancelamento) ==========
      console.log("[autentique-webhook] OS não encontrada, tentando buscar termo de cancelamento...");

      const { data: cancelamentoContrato } = await supabase
        .from("contratos")
        .select("*, associado:associados(id, nome, cpf)")
        .eq("autentique_cancelamento_id", documentId)
        .maybeSingle();

      if (cancelamentoContrato) {
        console.log(`[autentique-webhook] ✓ Termo de cancelamento encontrado: contrato ${cancelamentoContrato.numero}`);
        const signerData = payload.event?.data?.user;
        const signerName = signerData?.name || cancelamentoContrato.associado?.nome || "Associado";

        if (eventType === "signature.accepted" || (eventType === "signature.updated" && payload.event?.data?.signed)) {
          console.log(`[autentique-webhook] 🎉 Termo de Cancelamento ASSINADO por ${signerName}`);

          await supabase.from("contratos_historico").insert({
            contrato_id: cancelamentoContrato.id,
            evento: "cancelamento_assinado",
            descricao: `Termo de Cancelamento assinado por ${signerName} via Autentique`,
            dados: { signer_name: signerName },
          });

          if (cancelamentoContrato.associado?.id) {
            await supabase.from("associados_historico").insert({
              associado_id: cancelamentoContrato.associado.id,
              tipo: "documento_assinado",
              descricao: `Termo de Cancelamento assinado eletronicamente por ${signerName}`,
              metadata: { autentique_id: documentId, via: "autentique" },
            });
          }
        }

        return new Response(
          JSON.stringify({ received: true, processed: eventType, type: "cancelamento", documentId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[autentique-webhook] ❌ Documento NÃO ENCONTRADO em contratos, sinistros, ordens_servico nem cancelamentos");
      return new Response(JSON.stringify({ received: true, message: "Document not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[autentique-webhook] ✓ Contrato encontrado:", contrato.numero, "- ID:", contrato.id);
    console.log("[autentique-webhook] Status atual do contrato:", contrato.status);

    // Extrair dados do signatário da NOVA estrutura
    const signerData = payload.event?.data?.user;
    const signerName = signerData?.name || "Cliente";
    const signerEmail = signerData?.email || "";

    // Processar eventos - NOVOS tipos de evento do Autentique
    switch (eventType) {
      case "signature.accepted": {
        // Documento foi ASSINADO
        console.log(`[autentique-webhook] 🎉 Documento ${documentId} foi ASSINADO por ${signerName} (${signerEmail})`);
        console.log("[autentique-webhook] Atualizando contrato para status 'assinado'...");
        
        await supabase
          .from("contratos")
          .update({ 
            status: "assinado",
            data_assinatura: new Date().toISOString(),
            autentique_status: "signed",
          })
          .eq("id", contrato.id);

        console.log("[autentique-webhook] ✓ Contrato atualizado para 'assinado'");

        // Registrar histórico do contrato
        await supabase.from("contratos_historico").insert({
          contrato_id: contrato.id,
          evento: "documento_assinado",
          descricao: `Contrato assinado eletronicamente por ${signerName} via Autentique`,
          dados: { 
            signed_at: payload.event?.data?.signed || new Date().toISOString(),
            signer_name: signerName,
            signer_email: signerEmail,
          },
        });

        if (contrato.lead_id) {
          await supabase.from("leads_historico").insert({
            lead_id: contrato.lead_id,
            acao: "contrato_assinado",
            descricao: `Contrato ${contrato.numero} assinado eletronicamente por ${signerName}`,
            etapa_anterior: "contrato_enviado",
            etapa_nova: "contrato_assinado",
          });

          await supabase
            .from("leads")
            .update({ etapa: "contrato_assinado" })
            .eq("id", contrato.lead_id);
          
          console.log(`Lead ${contrato.lead_id} atualizado para etapa 'contrato_assinado'`);
        }

        // Criar notificação para o vendedor
        const vendedorId = contrato.vendedor_id || contrato.leads?.vendedor_id;
        if (vendedorId) {
          await supabase.from("notificacoes").insert({
            user_id: vendedorId,
            titulo: "Contrato Assinado! 🎉",
            mensagem: `O contrato ${contrato.numero} foi assinado por ${signerName}.`,
            tipo: "success",
            link: `/vendas/contratos`,
          });
        }

        // ========== NOVO: Anexar PDF assinado nos documentos do associado ==========
        if (contrato.associado_id) {
          console.log("[autentique-webhook] Iniciando anexação do contrato assinado...");
          const anexoResult = await anexarContratoAssinado(supabase, contrato, documentId, signerName);
          if (anexoResult.success) {
            console.log("[autentique-webhook] ✓ Contrato anexado com sucesso:", anexoResult.url);
          } else {
            console.log("[autentique-webhook] ⚠ Falha ao anexar contrato:", anexoResult.error);
          }
        } else {
          console.log("[autentique-webhook] ⚠ Contrato sem associado_id, pulando anexação");
        }
        break;
      }

      case "signature.viewed": {
        // Cliente visualizou o documento
        console.log(`Documento ${documentId} foi VISUALIZADO por ${signerName}`);
        
        // Só atualiza para 'visualizado' se ainda estiver pendente
        if (contrato.status === "pendente_assinatura" || contrato.status === "enviado") {
          await supabase
            .from("contratos")
            .update({ 
              status: "visualizado",
              data_visualizacao: new Date().toISOString(),
              autentique_status: "viewed",
            })
            .eq("id", contrato.id);
        } else {
          await supabase
            .from("contratos")
            .update({ 
              data_visualizacao: new Date().toISOString(),
              autentique_status: "viewed",
            })
            .eq("id", contrato.id);
        }

        await supabase.from("contratos_historico").insert({
          contrato_id: contrato.id,
          evento: "documento_visualizado",
          descricao: `${signerName} visualizou o documento`,
          dados: { 
            viewed_at: payload.event?.data?.viewed || new Date().toISOString(), 
            viewer: signerName,
            viewer_email: signerEmail,
          },
        });
        break;
      }

      case "signature.updated": {
        // Atualização parcial - pode ser visualização, abertura de email, etc.
        const wasViewed = payload.event?.data?.viewed;
        const wasSigned = payload.event?.data?.signed;
        
        console.log(`Documento ${documentId} foi ATUALIZADO. Visualizado: ${!!wasViewed}, Assinado: ${!!wasSigned}`);
        
        if (wasSigned) {
          // Se foi assinado, tratar como signature.accepted
          console.log(`Documento ${documentId} foi ASSINADO (via update)`);
          
          await supabase
            .from("contratos")
            .update({ 
              status: "assinado",
              data_assinatura: new Date().toISOString(),
              autentique_status: "signed",
            })
            .eq("id", contrato.id);

          await supabase.from("contratos_historico").insert({
            contrato_id: contrato.id,
            evento: "documento_assinado",
            descricao: `Contrato assinado eletronicamente por ${signerName} via Autentique`,
            dados: { signed_at: wasSigned, signer_name: signerName },
          });

          if (contrato.lead_id) {
            await supabase
              .from("leads")
              .update({ etapa: "contrato_assinado" })
              .eq("id", contrato.lead_id);
          }

          const vendedorId = contrato.vendedor_id || contrato.leads?.vendedor_id;
          if (vendedorId) {
            await supabase.from("notificacoes").insert({
              user_id: vendedorId,
              titulo: "Contrato Assinado! 🎉",
              mensagem: `O contrato ${contrato.numero} foi assinado por ${signerName}.`,
              tipo: "success",
              link: `/vendas/contratos`,
            });
          }

          // ========== NOVO: Anexar PDF assinado nos documentos do associado ==========
          if (contrato.associado_id) {
            console.log("[autentique-webhook] Iniciando anexação do contrato assinado (via update)...");
            const anexoResult = await anexarContratoAssinado(supabase, contrato, documentId, signerName);
            if (anexoResult.success) {
              console.log("[autentique-webhook] ✓ Contrato anexado com sucesso:", anexoResult.url);
            } else {
              console.log("[autentique-webhook] ⚠ Falha ao anexar contrato:", anexoResult.error);
            }
          }
        } else if (wasViewed) {
          // Apenas visualizado
          if (contrato.status === "pendente_assinatura" || contrato.status === "enviado") {
            await supabase
              .from("contratos")
              .update({ 
                status: "visualizado",
                data_visualizacao: new Date().toISOString(),
                autentique_status: "viewed",
              })
              .eq("id", contrato.id);
          }
        }
        break;
      }

      case "signature.rejected": {
        // Signatário rejeitou
        const reason = payload.event?.data?.reason || "Não informado";
        console.log(`Documento ${documentId} foi REJEITADO. Motivo: ${reason}`);
        
        await supabase
          .from("contratos")
          .update({ 
            status: "rejeitado",
            autentique_status: "rejected",
          })
          .eq("id", contrato.id);

        await supabase.from("contratos_historico").insert({
          contrato_id: contrato.id,
          evento: "assinatura_rejeitada",
          descricao: `${signerName} rejeitou o contrato: ${reason}`,
          dados: { signer: signerName, reason: reason },
        });
        
        if (contrato.lead_id) {
          await supabase.from("leads_historico").insert({
            lead_id: contrato.lead_id,
            acao: "contrato_rejeitado",
            descricao: `Contrato ${contrato.numero} rejeitado: ${reason}`,
          });
        }

        // Notificar vendedor
        const vendedorId = contrato.vendedor_id || contrato.leads?.vendedor_id;
        if (vendedorId) {
          await supabase.from("notificacoes").insert({
            user_id: vendedorId,
            titulo: "Contrato Rejeitado",
            mensagem: `O contrato ${contrato.numero} foi rejeitado. Motivo: ${reason}`,
            tipo: "warning",
            link: `/vendas/contratos`,
          });
        }
        break;
      }

      default:
        console.log("Evento não tratado:", eventType);
    }

    console.log("[autentique-webhook] ========== WEBHOOK PROCESSADO COM SUCESSO ==========");
    console.log("[autentique-webhook] Evento:", eventType, "| Documento:", documentId);
    
    return new Response(
      JSON.stringify({ received: true, processed: eventType, documentId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[autentique-webhook] ========== ERRO NO WEBHOOK ==========");
    console.error("[autentique-webhook] Erro:", error.message);
    console.error("[autentique-webhook] Stack:", error.stack);
    return new Response(
      JSON.stringify({ received: true, error: error.message }),
      {
        status: 200, // Retorna 200 para evitar retries do Autentique
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});