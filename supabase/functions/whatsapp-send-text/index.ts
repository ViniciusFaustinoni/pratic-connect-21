import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone, mensagem, instancia_id, delay_ms } = await req.json();

    if (!telefone || !mensagem) {
      return new Response(
        JSON.stringify({ success: false, error: "telefone e mensagem são obrigatórios" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar instância - INCLUIR status para verificação
    let query = supabase.from("whatsapp_instancias").select("id, api_url, instance_name, status");
    
    if (instancia_id) {
      query = query.eq("id", instancia_id);
    } else {
      query = query.eq("principal", true);
    }

    const { data: instancia, error: instError } = await query.single();

    if (instError || !instancia) {
      return new Response(
        JSON.stringify({ success: false, error: "Instância não encontrada" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // VERIFICAR SE WHATSAPP ESTÁ CONECTADO ANTES DE ENVIAR
    if (!instancia.status || instancia.status !== 'open') {
      console.log(`[whatsapp-send-text] WhatsApp desconectado. Status: ${instancia.status}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "WhatsApp não está conectado. Acesse as configurações para reconectar.",
          status: instancia.status
        }),
        { status: 503, headers: corsHeaders }
      );
    }

    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    if (!EVOLUTION_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "EVOLUTION_API_KEY não configurada" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // PRIORIZAR URL do secret sobre a URL do banco
    const apiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
    if (!apiUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "URL da Evolution API não configurada" }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`[whatsapp-send-text] Usando API URL: ${apiUrl}`);

    // Formatar telefone: remover caracteres especiais E garantir prefixo 55
    let telefoneFormatado = telefone.replace(/\D/g, "");
    
    // Garantir que tenha DDI do Brasil (55)
    if (!telefoneFormatado.startsWith("55")) {
      telefoneFormatado = "55" + telefoneFormatado;
    }
    
    // Validar tamanho mínimo: 55 + DDD (2) + número (8 ou 9) = 12 ou 13 dígitos
    if (telefoneFormatado.length < 12) {
      console.error(`[whatsapp-send-text] Telefone inválido: ${telefoneFormatado}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Número de telefone inválido. Verifique o DDD e número." 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Delay configurável para envios em lote (anti-bloqueio)
    const delayGlobal = parseInt(Deno.env.get('WHATSAPP_SEND_DELAY_MS') || '0');
    const delayFinal = delay_ms || delayGlobal;
    
    if (delayFinal > 0) {
      console.log(`[whatsapp-send-text] Aplicando delay de ${delayFinal}ms`);
      await new Promise(resolve => setTimeout(resolve, delayFinal));
    }

    console.log(`[whatsapp-send-text] Enviando para ${telefoneFormatado} via ${instancia.instance_name}`);

    // Enviar mensagem via Evolution API
    const response = await fetch(`${apiUrl}/message/sendText/${instancia.instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: telefoneFormatado,
        text: mensagem,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[whatsapp-send-text] Erro Evolution:", result);
      
      // Registrar mensagem com erro
      await supabase.from("whatsapp_mensagens").insert({
        instancia_id: instancia.id,
        telefone: telefoneFormatado,
        tipo: "text",
        mensagem,
        direcao: "saida",
        status: "erro",
        erro_mensagem: result.message || result.error || "Erro desconhecido",
      });
      
      return new Response(
        JSON.stringify({ success: false, error: result.message || "Erro ao enviar" }),
        { status: response.status, headers: corsHeaders }
      );
    }

    // Registrar mensagem enviada
    await supabase.from("whatsapp_mensagens").insert({
      instancia_id: instancia.id,
      telefone: telefoneFormatado,
      tipo: "text",
      mensagem,
      direcao: "saida",
      status: "enviada",
      message_id: result.key?.id,
    });

    console.log(`[whatsapp-send-text] ✓ Mensagem enviada para ${telefoneFormatado} - ID: ${result.key?.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: result.key?.id,
        telefone: telefoneFormatado,
      }),
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[whatsapp-send-text] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
