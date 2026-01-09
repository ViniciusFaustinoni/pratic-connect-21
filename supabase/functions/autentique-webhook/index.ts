import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutentiqueWebhookPayload {
  event: string;
  document: {
    id: string;
    name: string;
    signed: boolean;
  };
  signature?: {
    public_id: string;
    name: string;
    email: string;
    signed_at?: string;
    rejected_at?: string;
    rejection_reason?: string;
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
    
    console.log("Webhook Autentique recebido:", JSON.stringify(payload, null, 2));

    const documentId = payload.document?.id;
    if (!documentId) {
      console.error("Document ID não encontrado no payload");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar contrato pelo documento_id do Autentique
    const { data: contrato, error: contratoError } = await supabase
      .from("contratos")
      .select("*, leads (*)")
      .eq("autentique_documento_id", documentId)
      .single();

    if (contratoError || !contrato) {
      console.log("Contrato não encontrado para documento:", documentId);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Contrato encontrado:", contrato.numero);

    // Processar eventos
    switch (payload.event) {
      case "document.signed":
        // Documento completamente assinado
        console.log("Documento assinado completamente");
        
        await supabase
          .from("contratos")
          .update({ 
            status: "assinado",
            data_assinatura: new Date().toISOString(),
            autentique_status: "signed",
          })
          .eq("id", contrato.id);

        // Registrar histórico do contrato
        await supabase.from("contratos_historico").insert({
          contrato_id: contrato.id,
          evento: "documento_assinado",
          descricao: `Contrato assinado eletronicamente via Autentique`,
          dados: { signed_at: new Date().toISOString() },
        });

        if (contrato.lead_id) {
          await supabase.from("leads_historico").insert({
            lead_id: contrato.lead_id,
            acao: "contrato_assinado",
            descricao: `Contrato ${contrato.numero} assinado eletronicamente`,
            etapa_anterior: "contrato_enviado",
            etapa_nova: "contrato_assinado",
          });

          await supabase
            .from("leads")
            .update({ etapa: "contrato_assinado" })
            .eq("id", contrato.lead_id);
        }

        // Criar notificação para o vendedor
        if (contrato.vendedor_id) {
          await supabase.from("notificacoes").insert({
            user_id: contrato.vendedor_id,
            titulo: "Contrato Assinado! 🎉",
            mensagem: `O contrato ${contrato.numero} foi assinado por ${contrato.leads?.nome || "cliente"}.`,
            tipo: "success",
            link: `/vendas/contratos`,
          });
        }
        break;

      case "signer.link_opened":
        // Cliente visualizou o documento
        console.log("Cliente visualizou documento");
        
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
          descricao: `${payload.signature?.name || "Cliente"} visualizou o documento`,
          dados: { viewed_at: new Date().toISOString(), viewer: payload.signature?.name },
        });
        break;

      case "signer.signed":
        // Um signatário assinou (útil para múltiplos signatários)
        console.log("Signatário assinou:", payload.signature?.name);
        
        await supabase.from("contratos_historico").insert({
          contrato_id: contrato.id,
          evento: "assinatura_parcial",
          descricao: `${payload.signature?.name} assinou o contrato`,
          dados: { signer: payload.signature?.name, signed_at: payload.signature?.signed_at },
        });
        
        if (contrato.lead_id) {
          await supabase.from("leads_historico").insert({
            lead_id: contrato.lead_id,
            acao: "assinatura_parcial",
            descricao: `${payload.signature?.name} assinou o contrato ${contrato.numero}`,
          });
        }
        break;

      case "signer.rejected":
        // Signatário rejeitou
        console.log("Signatário rejeitou:", payload.signature?.rejection_reason);
        
        await supabase.from("contratos_historico").insert({
          contrato_id: contrato.id,
          evento: "assinatura_rejeitada",
          descricao: `${payload.signature?.name} rejeitou o contrato: ${payload.signature?.rejection_reason || "Sem motivo"}`,
          dados: { signer: payload.signature?.name, reason: payload.signature?.rejection_reason },
        });
        
        if (contrato.lead_id) {
          await supabase.from("leads_historico").insert({
            lead_id: contrato.lead_id,
            acao: "contrato_rejeitado",
            descricao: `Contrato ${contrato.numero} rejeitado: ${payload.signature?.rejection_reason || "Sem motivo informado"}`,
          });
        }

        // Notificar vendedor
        if (contrato.vendedor_id) {
          await supabase.from("notificacoes").insert({
            user_id: contrato.vendedor_id,
            titulo: "Contrato Rejeitado",
            mensagem: `O contrato ${contrato.numero} foi rejeitado. Motivo: ${payload.signature?.rejection_reason || "Não informado"}`,
            tipo: "warning",
            link: `/vendas/contratos`,
          });
        }
        break;

      case "document.deadline":
        // Prazo expirado
        console.log("Prazo do documento expirado");
        
        await supabase
          .from("contratos")
          .update({ 
            status: "expirado",
            autentique_status: "expired",
          })
          .eq("id", contrato.id);

        await supabase.from("contratos_historico").insert({
          contrato_id: contrato.id,
          evento: "prazo_expirado",
          descricao: "Prazo para assinatura expirou",
        });
        
        if (contrato.vendedor_id) {
          await supabase.from("notificacoes").insert({
            user_id: contrato.vendedor_id,
            titulo: "Prazo de Assinatura Expirado",
            mensagem: `O prazo para assinatura do contrato ${contrato.numero} expirou.`,
            tipo: "warning",
            link: `/vendas/contratos`,
          });
        }
        break;

      default:
        console.log("Evento não tratado:", payload.event);
    }

    return new Response(
      JSON.stringify({ received: true, processed: payload.event }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro no webhook Autentique:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
