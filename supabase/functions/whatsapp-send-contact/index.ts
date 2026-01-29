import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactPayload {
  telefone: string;
  contato: {
    fullName: string;
    wuid?: string;
    phoneNumber: string;
    organization?: string;
    email?: string;
  };
  instancia_id?: string;
  referencia_tipo?: string;
  referencia_id?: string;
}

// Formatar wuid (WhatsApp User ID): apenas números, prefixo 55
function formatarWuid(telefone: string): string {
  let limpo = telefone.replace(/\D/g, '');
  if (!limpo.startsWith('55')) {
    limpo = '55' + limpo;
  }
  return limpo;
}

// Formatar phoneNumber para exibição
function formatarPhoneNumber(telefone: string): string {
  const limpo = telefone.replace(/\D/g, '');
  
  // Se já tem 55, remover para formatação
  const semPrefixo = limpo.startsWith('55') ? limpo.slice(2) : limpo;
  
  if (semPrefixo.length === 11) {
    return `+55 ${semPrefixo.slice(0, 2)} ${semPrefixo.slice(2, 7)}-${semPrefixo.slice(7)}`;
  } else if (semPrefixo.length === 10) {
    return `+55 ${semPrefixo.slice(0, 2)} ${semPrefixo.slice(2, 6)}-${semPrefixo.slice(6)}`;
  }
  
  return telefone;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: ContactPayload = await req.json();
    console.log("[whatsapp-send-contact] Payload recebido:", JSON.stringify(payload, null, 2));

    // Validar payload
    if (!payload.telefone) {
      return new Response(
        JSON.stringify({ success: false, error: "Telefone do destinatário é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload.contato?.fullName || !payload.contato?.phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Nome e telefone do contato são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar tamanhos
    if (payload.contato.fullName.length > 200) {
      return new Response(
        JSON.stringify({ success: false, error: "Nome do contato muito longo (máximo 200 caracteres)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar instância ativa
    let instancia;
    
    if (payload.instancia_id) {
      const { data } = await supabase
        .from("whatsapp_instancias")
        .select("*")
        .eq("id", payload.instancia_id)
        .eq("ativa", true)
        .single();
      instancia = data;
    } else {
      const { data } = await supabase
        .from("whatsapp_instancias")
        .select("*")
        .eq("ativa", true)
        .eq("principal", true)
        .maybeSingle();
      
      if (!data) {
        const { data: qualquerInstancia } = await supabase
          .from("whatsapp_instancias")
          .select("*")
          .eq("ativa", true)
          .limit(1)
          .maybeSingle();
        instancia = qualquerInstancia;
      } else {
        instancia = data;
      }
    }

    if (!instancia) {
      console.error("[whatsapp-send-contact] Nenhuma instância ativa encontrada");
      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma instância WhatsApp ativa encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[whatsapp-send-contact] Usando instância: ${instancia.instance_name}`);

    // Verificar status da conexão
    try {
      const statusResponse = await fetch(
        `${instancia.api_url}/instance/connectionState/${instancia.instance_name}`,
        {
          method: "GET",
          headers: { "apikey": EVOLUTION_API_KEY || "" },
        }
      );
      const statusData = await statusResponse.json();
      
      if (statusData?.state !== "open" && statusData?.instance?.state !== "open") {
        console.error("[whatsapp-send-contact] Instância não conectada:", statusData);
        return new Response(
          JSON.stringify({ success: false, error: "WhatsApp não está conectado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (statusErr) {
      console.warn("[whatsapp-send-contact] Erro ao verificar status:", statusErr);
      // Continua tentando enviar mesmo se falhou verificação
    }

    // Formatar telefone destinatário
    const telefoneDestinatario = formatarWuid(payload.telefone);

    // Formatar dados do contato
    const wuid = payload.contato.wuid || formatarWuid(payload.contato.phoneNumber);
    const phoneNumber = formatarPhoneNumber(payload.contato.phoneNumber);

    // Montar payload para Evolution API
    const contactBody = {
      number: telefoneDestinatario,
      contact: [
        {
          fullName: payload.contato.fullName,
          wuid: wuid,
          phoneNumber: phoneNumber,
          organization: payload.contato.organization || "",
          email: payload.contato.email || "",
          url: "",
        }
      ],
    };

    console.log(`[whatsapp-send-contact] Enviando contato para ${telefoneDestinatario}:`, contactBody);

    // Chamar Evolution API
    const response = await fetch(
      `${instancia.api_url}/message/sendContact/${instancia.instance_name}`,
      {
        method: "POST",
        headers: {
          "apikey": EVOLUTION_API_KEY || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contactBody),
      }
    );

    const result = await response.json();
    console.log("[whatsapp-send-contact] Resposta Evolution API:", result);

    if (result.key?.id || result.message?.contactMessage) {
      // Sucesso - registrar mensagem no banco
      const messageId = result.key?.id || `contact_${Date.now()}`;
      
      await supabase.from("whatsapp_mensagens").insert({
        instancia_id: instancia.id,
        telefone: telefoneDestinatario,
        tipo: "contact",
        mensagem: `📇 Contato: ${payload.contato.fullName} (${phoneNumber})`,
        status: "enviada",
        message_id: messageId,
        referencia_tipo: payload.referencia_tipo || null,
        referencia_id: payload.referencia_id || null,
        direcao: "saida",
        sent_at: new Date().toISOString(),
      });

      // Registrar log
      await supabase.from("whatsapp_logs").insert({
        instancia_id: instancia.id,
        tipo: "send_contact",
        evento: "contact_sent",
        payload: contactBody,
        resposta: result,
      });

      console.log(`[whatsapp-send-contact] ✅ Contato enviado com sucesso: ${messageId}`);

      return new Response(
        JSON.stringify({
          success: true,
          mensagem_id: messageId,
          message: "Contato enviado com sucesso",
          contato: {
            nome: payload.contato.fullName,
            telefone: phoneNumber,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error("[whatsapp-send-contact] ❌ Erro na resposta:", result);
      
      // Registrar log de erro
      await supabase.from("whatsapp_logs").insert({
        instancia_id: instancia.id,
        tipo: "send_contact",
        evento: "contact_error",
        payload: contactBody,
        resposta: result,
        erro: result.error || "Resposta inválida da API",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || "Erro ao enviar contato",
          details: result,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[whatsapp-send-contact] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
