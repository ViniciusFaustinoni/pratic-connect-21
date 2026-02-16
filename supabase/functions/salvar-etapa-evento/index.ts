import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const formData = await req.formData();
    const token = formData.get("token") as string;
    const etapa = parseInt(formData.get("etapa") as string);
    const dadosRaw = formData.get("dados") as string;
    const dados = dadosRaw ? JSON.parse(dadosRaw) : {};

    if (!token || ![1, 2].includes(etapa)) {
      return new Response(
        JSON.stringify({ error: "Token e etapa (1-3) são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token
    const { data: link, error: linkError } = await supabase
      .from("sinistro_evento_links")
      .select("*")
      .eq("token", token)
      .eq("status", "ativo")
      .gt("expira_em", new Date().toISOString())
      .single();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ error: "Link inválido ou expirado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify previous step is completed (etapa N requires etapa N-1 done)
    if (etapa > 1) {
      const prevField = `etapa${etapa - 1}_completada_em`;
      if (!link[prevField]) {
        return new Response(
          JSON.stringify({ error: `Etapa ${etapa - 1} ainda não foi completada` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Collect files from FormData
    const arquivos: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("arquivo") && value instanceof File) {
        arquivos.push(value);
      }
    }

    // Validate per step
    if (etapa === 1) {
      const fotos = arquivos.filter((f) => f.type.startsWith("image/"));
      const videos = arquivos.filter((f) => f.type.startsWith("video/"));
      if (fotos.length < 5 || videos.length < 1) {
        return new Response(
          JSON.stringify({ error: "Etapa 1 requer no mínimo 5 fotos e 1 vídeo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    if (etapa === 2 && (arquivos.length < 1 || !dados.numero_bo)) {
      return new Response(
        JSON.stringify({ error: "Etapa 2 requer ao menos 1 arquivo e o número do B.O." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload files to storage
    const uploadedUrls: string[] = [];
    for (let i = 0; i < arquivos.length; i++) {
      const file = arquivos[i];
      const ext = file.name.split(".").pop() || "bin";
      const filePath = `${link.id}/etapa${etapa}/${Date.now()}-${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("sinistro-eventos")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error(`Upload error for ${filePath}:`, uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("sinistro-eventos")
        .getPublicUrl(filePath);

      uploadedUrls.push(urlData.publicUrl);
    }

    // Build step data
    const dadosEtapa: Record<string, unknown> = { ...dados, arquivos_urls: uploadedUrls };
    if (etapa === 2) {
      dadosEtapa.validacao_pendente = true;
    }

    // Update link record
    const updatePayload: Record<string, unknown> = {
      [`dados_etapa${etapa}`]: dadosEtapa,
      [`etapa${etapa}_completada_em`]: new Date().toISOString(),
      etapa_atual: etapa,
    };

    if (etapa === 2) {
      updatePayload.status = "completado";
    }

    const { error: updateError } = await supabase
      .from("sinistro_evento_links")
      .update(updatePayload)
      .eq("id", link.id);

    if (updateError) {
      console.error("Update link error:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar dados da etapa" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If step 2, update sinistro status
    if (etapa === 2) {
      await supabase
        .from("sinistros")
        .update({ status: "documentacao_enviada" })
        .eq("id", link.sinistro_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        etapa,
        arquivos_urls: uploadedUrls,
        dados: dadosEtapa,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("salvar-etapa-evento error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
