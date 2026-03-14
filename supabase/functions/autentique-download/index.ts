import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) {
      throw new Error("AUTENTIQUE_API_KEY não configurada");
    }

    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "documentId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Baixando documento assinado:", documentId);

    const response = await fetch(
      `https://api.autentique.com.br/documentos/${documentId}/assinado.pdf`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${autentiqueApiKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Erro Autentique:", response.status, response.statusText);
      throw new Error(`Erro ao baixar PDF: ${response.status} ${response.statusText}`);
    }

    const pdfBlob = await response.blob();
    console.log("PDF baixado com sucesso, tamanho:", pdfBlob.size);

    return new Response(pdfBlob, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${documentId}_assinado.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Erro em autentique-download:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
