import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ code: 401, message: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ code: 401, message: "Invalid JWT" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) {
      throw new Error("AUTENTIQUE_API_KEY não configurada");
    }

    const { documentId } = await req.json();

    if (!documentId) {
      throw new Error("documentId é obrigatório");
    }

    console.log("Consultando status do documento:", documentId);

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
            created_at
            action { name }
            link { short_link }
            viewed { created_at }
            signed { created_at }
            rejected { created_at reason }
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

    console.log("Resposta Autentique:", JSON.stringify(data, null, 2));

    if (data.errors) {
      throw new Error(`Erro Autentique: ${JSON.stringify(data.errors)}`);
    }

    const document = data.data?.document;
    if (!document) {
      throw new Error("Documento não encontrado");
    }

    // Processar status das assinaturas
    const signatures = document.signatures?.map((sig: any) => ({
      name: sig.name,
      email: sig.email,
      action: sig.action?.name,
      link: sig.link?.short_link,
      viewed: sig.viewed?.created_at || null,
      signed: sig.signed?.created_at || null,
      rejected: sig.rejected ? {
        date: sig.rejected.created_at,
        reason: sig.rejected.reason,
      } : null,
      status: sig.signed?.created_at 
        ? "signed" 
        : sig.rejected?.created_at 
          ? "rejected" 
          : sig.viewed?.created_at 
            ? "viewed" 
            : "pending",
    })) || [];

    // Determinar status geral
    const allSigned = signatures.every((s: any) => s.status === "signed");
    const anyRejected = signatures.some((s: any) => s.status === "rejected");
    
    let overallStatus = "pending";
    if (allSigned) overallStatus = "signed";
    else if (anyRejected) overallStatus = "rejected";
    else if (signatures.some((s: any) => s.status === "viewed")) overallStatus = "in_progress";

    return new Response(
      JSON.stringify({
        success: true,
        document: {
          id: document.id,
          name: document.name,
          createdAt: document.created_at,
          status: overallStatus,
          signedFileUrl: document.files?.signed || null,
          originalFileUrl: document.files?.original || null,
        },
        signatures,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro ao consultar status:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
