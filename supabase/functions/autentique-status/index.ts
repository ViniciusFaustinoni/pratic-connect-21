import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    // Autenticação opcional - permite chamadas públicas (verify_jwt = false no config.toml)
    const authHeader = req.headers.get("Authorization");
    let isAuthenticated = false;
    
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        
        const token = authHeader.replace("Bearer ", "");
        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        isAuthenticated = !claimsError && !!claimsData?.claims?.sub;
        
        if (isAuthenticated) {
          console.log("Chamada autenticada - usuário:", claimsData?.claims?.sub);
        }
      } catch (authError) {
        console.log("Token inválido ou ausente, continuando como chamada pública");
      }
    } else {
      console.log("Chamada pública (sem token de autenticação)");
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

    // Filtrar apenas signatários que têm ação de ASSINAR (SIGN)
    // Ignora participantes que são apenas cópias ou testemunhas
    const signersWithSignAction = signatures.filter((s: any) => 
      s.action === 'SIGN' || s.action === 'Assinar'
    );
    
    // Determinar status geral baseado apenas nos signatários reais
    const hasSigners = signersWithSignAction.length > 0;
    const allSignersSigned = hasSigners && signersWithSignAction.every((s: any) => s.status === "signed");
    const anySignerRejected = signersWithSignAction.some((s: any) => s.status === "rejected");
    const anySignerViewed = signersWithSignAction.some((s: any) => s.status === "viewed");
    
    let overallStatus = "pending";
    if (allSignersSigned) overallStatus = "signed";
    else if (anySignerRejected) overallStatus = "rejected";
    else if (anySignerViewed) overallStatus = "in_progress";

    console.log("Status calculado:", {
      totalSignatures: signatures.length,
      signersWithSignAction: signersWithSignAction.length,
      allSignersSigned,
      overallStatus
    });

    // Se documento foi assinado, atualizar o banco de dados (fallback do webhook)
    if (overallStatus === "signed") {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        console.log("Atualizando contrato no banco de dados...");
        
        const { error: updateError } = await supabaseAdmin
          .from("contratos")
          .update({
            status: "assinado",
            autentique_status: "signed",
            data_assinatura: new Date().toISOString()
          })
          .eq("autentique_documento_id", documentId);

        if (updateError) {
          console.error("Erro ao atualizar contrato:", updateError);
        } else {
          console.log("Contrato atualizado com sucesso!");
        }
      } catch (dbError) {
        console.error("Erro ao conectar ao banco:", dbError);
      }
    }

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
