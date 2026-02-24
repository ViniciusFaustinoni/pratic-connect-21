import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|avi|mkv)$/i;

function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.test(url);
}

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

    const isSubstituirVideo = etapa === 1 && dados.substituir_video === true;

    if (!token || ![1, 2].includes(etapa)) {
      return new Response(
        JSON.stringify({ error: "Token e etapa (1-2) são obrigatórios" }),
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
      // For video substitution, also allow completed links
      if (isSubstituirVideo) {
        const { data: linkCompleted, error: linkCompletedError } = await supabase
          .from("sinistro_evento_links")
          .select("*")
          .eq("token", token)
          .in("status", ["ativo", "completado"])
          .single();

        if (linkCompletedError || !linkCompleted) {
          return new Response(
            JSON.stringify({ error: "Link inválido ou expirado" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Use this link instead and proceed to video substitution logic below
        return await handleVideoSubstitution(supabase, formData, linkCompleted, corsHeaders);
      }

      return new Response(
        JSON.stringify({ error: "Link inválido ou expirado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For video substitution on an active link that already has etapa1 completed
    if (isSubstituirVideo && link.etapa1_completada_em) {
      return await handleVideoSubstitution(supabase, formData, link, corsHeaders);
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

    // Build step data - preserve video history for etapa 1
    const dadosEtapa: Record<string, unknown> = { ...dados, arquivos_urls: uploadedUrls };

    if (etapa === 1) {
      // Check if there are existing videos in old data to preserve
      const oldDados = link.dados_etapa1 as Record<string, unknown> | null;
      if (oldDados?.arquivos_urls) {
        const oldUrls = oldDados.arquivos_urls as string[];
        const oldVideoUrls = oldUrls.filter(u => isVideoUrl(u));
        if (oldVideoUrls.length > 0) {
          const existingHistory = (oldDados.historico_videos as any[]) || [];
          const now = new Date().toISOString();
          const newHistory = oldVideoUrls.map(url => ({
            url,
            enviado_em: (oldDados as any).etapa1_enviado_em || link.etapa1_completada_em || now,
            substituido_em: now,
          }));
          dadosEtapa.historico_videos = [...existingHistory, ...newHistory];
        } else {
          // Preserve existing history even if no old videos
          dadosEtapa.historico_videos = (oldDados.historico_videos as any[]) || [];
        }
      }
    }

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

    // If step 2, update sinistro status and address
    if (etapa === 2) {
      const sinistroUpdate: Record<string, unknown> = { status: "documentacao_enviada" };

      if (dados.endereco_rua) {
        const endNumero = dados.endereco_numero ? `, ${dados.endereco_numero}` : "";
        sinistroUpdate.local_ocorrencia = `${dados.endereco_rua}${endNumero}`;
      }
      if (dados.endereco_cidade) sinistroUpdate.cidade_ocorrencia = dados.endereco_cidade;
      if (dados.endereco_uf) sinistroUpdate.estado_ocorrencia = dados.endereco_uf;

      await supabase
        .from("sinistros")
        .update(sinistroUpdate)
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

// Handle video substitution for completed etapa 1
async function handleVideoSubstitution(
  supabase: any,
  formData: FormData,
  link: any,
  corsHeaders: Record<string, string>
) {
  // Collect only video files
  const videoFiles: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("arquivo") && value instanceof File && value.type.startsWith("video/")) {
      videoFiles.push(value);
    }
  }

  if (videoFiles.length < 1) {
    return new Response(
      JSON.stringify({ error: "Nenhum vídeo enviado para substituição" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Upload new video(s)
  const newVideoUrls: string[] = [];
  for (let i = 0; i < videoFiles.length; i++) {
    const file = videoFiles[i];
    const ext = file.name.split(".").pop() || "mp4";
    const filePath = `${link.id}/etapa1/${Date.now()}-sub-${i}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("sinistro-eventos")
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error(`Upload error for video substitution ${filePath}:`, uploadError);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from("sinistro-eventos")
      .getPublicUrl(filePath);

    newVideoUrls.push(urlData.publicUrl);
  }

  if (newVideoUrls.length === 0) {
    return new Response(
      JSON.stringify({ error: "Falha ao fazer upload do vídeo" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get existing etapa1 data
  const oldDados = (link.dados_etapa1 as Record<string, unknown>) || {};
  const oldUrls = (oldDados.arquivos_urls as string[]) || [];
  const existingHistory = (oldDados.historico_videos as any[]) || [];

  // Separate old photos and old videos
  const oldPhotoUrls = oldUrls.filter(u => !isVideoUrl(u));
  const oldVideoUrls = oldUrls.filter(u => isVideoUrl(u));

  // Move old videos to history
  const now = new Date().toISOString();
  const newHistoryEntries = oldVideoUrls.map(url => ({
    url,
    enviado_em: link.etapa1_completada_em || now,
    substituido_em: now,
  }));

  // Build updated dados_etapa1
  const updatedDados = {
    ...oldDados,
    arquivos_urls: [...oldPhotoUrls, ...newVideoUrls],
    historico_videos: [...existingHistory, ...newHistoryEntries],
  };

  // Update link - do NOT change etapa1_completada_em
  const { error: updateError } = await supabase
    .from("sinistro_evento_links")
    .update({ dados_etapa1: updatedDados })
    .eq("id", link.id);

  if (updateError) {
    console.error("Update link error (video substitution):", updateError);
    return new Response(
      JSON.stringify({ error: "Erro ao salvar substituição do vídeo" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      etapa: 1,
      substituicao_video: true,
      arquivos_urls: updatedDados.arquivos_urls,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
