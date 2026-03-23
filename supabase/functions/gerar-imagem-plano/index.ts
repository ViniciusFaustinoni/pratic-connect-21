import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { plano_id, nome, descricao } = await req.json();
    if (!plano_id || !nome) {
      return new Response(JSON.stringify({ error: "plano_id e nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Create a professional, modern, visually striking banner image for a vehicle protection plan called "${nome}". ${descricao ? `The plan is described as: ${descricao}.` : ""} The image should convey trust, security, and premium quality. Use a dark blue and gold color scheme with a sleek car silhouette. No text in the image. High quality, 16:9 aspect ratio, suitable for a landing page card.`;

    console.log("Generating image for plan:", nome);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const statusCode = aiResponse.status;
      const body = await aiResponse.text();
      console.error("AI Gateway error:", statusCode, body);

      if (statusCode === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (statusCode === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no painel Lovable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erro na geração de imagem (${statusCode})`);
    }

    const aiData = await aiResponse.json();
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      console.error("No image in AI response:", JSON.stringify(aiData).substring(0, 500));
      throw new Error("A IA não retornou uma imagem. Tente novamente.");
    }

    // Extract base64 data
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) throw new Error("Formato de imagem inválido");

    const ext = base64Match[1]; // png, jpeg, etc.
    const base64 = base64Match[2];

    // Convert base64 to Uint8Array
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Storage
    const timestamp = Date.now();
    const filePath = `planos/${plano_id}/${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(filePath, bytes, {
        contentType: `image/${ext}`,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Erro ao salvar imagem: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documentos")
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // Update plan
    const { error: updateError } = await supabase
      .from("planos")
      .update({ imagem_landing_url: publicUrl })
      .eq("id", plano_id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`Erro ao atualizar plano: ${updateError.message}`);
    }

    console.log("Image generated and saved:", publicUrl);

    return new Response(JSON.stringify({ url: publicUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("gerar-imagem-plano error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
