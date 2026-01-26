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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user token for auth
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub;

    // Get associado
    const { data: associado, error: assocError } = await supabase
      .from("associados")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (assocError || !associado) {
      return new Response(JSON.stringify({ error: "Associado não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const tipo = formData.get("tipo") as string; // 'bo' | 'foto'

    if (!file) {
      return new Response(JSON.stringify({ error: "Arquivo não fornecido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: "Tipo de arquivo não permitido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file size (10MB for BO, 5MB for photos)
    const maxSize = tipo === "bo" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ 
        error: `Arquivo muito grande. Máximo ${maxSize / (1024 * 1024)}MB` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client for storage operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate unique path
    const fileId = crypto.randomUUID();
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${fileId}.${ext}`;
    const storagePath = `chat-temp/${associado.id}/${fileName}`;

    console.log(`[upload-arquivo-chat] Uploading ${tipo}: ${storagePath}`);

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("sinistros")
      .upload(storagePath, uint8Array, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[upload-arquivo-chat] Erro no upload:", uploadError);
      return new Response(JSON.stringify({ error: "Falha ao fazer upload do arquivo" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get signed URL (valid for 24 hours)
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from("sinistros")
      .createSignedUrl(storagePath, 24 * 60 * 60); // 24 hours

    if (signedError) {
      console.error("[upload-arquivo-chat] Erro ao gerar URL:", signedError);
      // Still return success with path, URL can be generated later
      return new Response(
        JSON.stringify({
          success: true,
          path: storagePath,
          url: null,
          fileName: file.name,
          tipo,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[upload-arquivo-chat] Upload concluído: ${storagePath}`);

    return new Response(
      JSON.stringify({
        success: true,
        path: storagePath,
        url: signedData.signedUrl,
        fileName: file.name,
        tipo,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[upload-arquivo-chat] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
