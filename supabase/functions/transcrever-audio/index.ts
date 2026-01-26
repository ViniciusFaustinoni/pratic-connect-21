import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[transcrever-audio] Recebendo requisição...");
    
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      console.error("[transcrever-audio] Arquivo de áudio não fornecido");
      return new Response(
        JSON.stringify({ error: "Arquivo de áudio não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[transcrever-audio] Arquivo recebido: ${audioFile.name}, tamanho: ${audioFile.size} bytes`);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[transcrever-audio] OPENAI_API_KEY não configurada");
      throw new Error("OPENAI_API_KEY não configurada");
    }

    // Enviar para Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append("file", audioFile, "audio.webm");
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", "pt"); // Português

    console.log("[transcrever-audio] Enviando para OpenAI Whisper...");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[transcrever-audio] Erro do Whisper:", errorText);
      throw new Error("Erro ao transcrever áudio");
    }

    const result = await response.json();
    console.log(`[transcrever-audio] Transcrição concluída: "${result.text?.substring(0, 50)}..."`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        text: result.text 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao transcrever áudio";
    console.error("[transcrever-audio] Erro:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
