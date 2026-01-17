import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        // Buscar por email do cliente + status pendente
        const { data: contratoByEmail } = await supabase
          .from("contratos")
          .select("*, leads (*)")
          .eq("cliente_email", signerEmail)
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
      
      // FALLBACK 2: Tentar buscar pelo telefone se email não funcionou
      if (!contrato && signerPhone) {
        const phoneClean = signerPhone.replace(/\D/g, '');
        
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

    if (!contrato) {
      console.log("[autentique-webhook] ❌ Contrato NÃO ENCONTRADO após todos os fallbacks");
      console.log("[autentique-webhook] Documento ID:", documentId);
      console.log("[autentique-webhook] Email tentado:", payload.event?.data?.user?.email);
      console.log("[autentique-webhook] Telefone tentado:", payload.event?.data?.user?.phone);
      return new Response(JSON.stringify({ received: true, message: "Contract not found" }), {
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
