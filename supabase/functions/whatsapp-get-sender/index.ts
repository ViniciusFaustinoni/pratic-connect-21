import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar instância Evolution principal
    const { data: instancia, error } = await supabase
      .from("whatsapp_instancias")
      .select("instance_name, api_url")
      .eq("ativa", true)
      .limit(1)
      .maybeSingle();

    if (error || !instancia) {
      throw new Error("Instância não encontrada");
    }

    const apiKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") || instancia.api_url;

    if (!apiKey || !evolutionUrl) {
      throw new Error("EVOLUTION_API_KEY ou EVOLUTION_API_URL não configuradas");
    }

    // Buscar info da instância na Evolution API para obter o ownerJid (número conectado)
    const response = await fetch(
      `${evolutionUrl}/instance/fetchInstances?instanceName=${instancia.instance_name}`,
      {
        method: "GET",
        headers: { apikey: apiKey },
      }
    );

    if (!response.ok) {
      throw new Error(`Erro Evolution API: ${response.status}`);
    }

    const data = await response.json();

    // Extrair ownerJid (formato: 5511953221644@s.whatsapp.net)
    let sender = "";
    if (Array.isArray(data) && data.length > 0) {
      sender = data[0]?.instance?.ownerJid || data[0]?.ownerJid || "";
    } else if (data?.instance?.ownerJid) {
      sender = data.instance.ownerJid;
    }

    // Limpar para só o número
    sender = sender.replace("@s.whatsapp.net", "").replace(/\D/g, "");

    console.log(`[whatsapp-get-sender] Sender encontrado: ${sender}`);

    return new Response(
      JSON.stringify({ success: true, sender }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[whatsapp-get-sender] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, sender: "" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
