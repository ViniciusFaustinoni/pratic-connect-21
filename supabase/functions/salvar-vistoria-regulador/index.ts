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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const formData = await req.formData();
    const acao = formData.get("acao") as string;
    const vistoriaId = formData.get("vistoria_id") as string;

    if (!acao || !vistoriaId) {
      return new Response(
        JSON.stringify({ error: "acao e vistoria_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== AÇÃO: INICIAR ==========
    if (acao === "iniciar") {
      const { error } = await supabase
        .from("vistorias_evento")
        .update({ status: "em_andamento", iniciada_em: new Date().toISOString() })
        .eq("id", vistoriaId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== AÇÃO: SALVAR_MIDIAS ==========
    if (acao === "salvar_midias") {
      const tipo = formData.get("tipo") as string;
      const index = formData.get("index") as string;
      const arquivo = formData.get("arquivo") as File;

      if (!arquivo || !tipo) {
        return new Response(
          JSON.stringify({ error: "arquivo e tipo são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ext = tipo === "video" ? "webm" : "jpg";
      const nomeArquivo = tipo === "video"
        ? `video.${ext}`
        : `foto-${(index || "01").padStart(2, "0")}.${ext}`;
      const caminho = `${vistoriaId}/vistoria-regulador/${nomeArquivo}`;

      const arrayBuffer = await arquivo.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("sinistro-eventos")
        .upload(caminho, arrayBuffer, {
          contentType: arquivo.type || (tipo === "video" ? "video/webm" : "image/jpeg"),
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: signedData } = await supabase.storage
        .from("sinistro-eventos")
        .createSignedUrl(caminho, 60 * 60 * 24 * 365);
      const url = signedData?.signedUrl || caminho;

      const { data: vistoria } = await supabase
        .from("vistorias_evento")
        .select("dados_vistoria")
        .eq("id", vistoriaId)
        .single();

      const dadosAtuais = (vistoria?.dados_vistoria as any) || {};
      if (tipo === "video") {
        dadosAtuais.video_url = url;
      } else {
        const fotos = dadosAtuais.fotos_urls || [];
        const idx = parseInt(index || "1") - 1;
        fotos[idx] = url;
        dadosAtuais.fotos_urls = fotos;
      }

      await supabase
        .from("vistorias_evento")
        .update({ dados_vistoria: dadosAtuais })
        .eq("id", vistoriaId);

      return new Response(JSON.stringify({ success: true, url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== AÇÃO: FINALIZAR ==========
    if (acao === "finalizar") {
      const dadosStr = formData.get("dados") as string;
      if (!dadosStr) {
        return new Response(
          JSON.stringify({ error: "dados são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const dados = JSON.parse(dadosStr);

      const { data: vistoria } = await supabase
        .from("vistorias_evento")
        .select("dados_vistoria, sinistro_id")
        .eq("id", vistoriaId)
        .single();

      if (!vistoria) {
        return new Response(
          JSON.stringify({ error: "Vistoria não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const dadosAtuais = (vistoria.dados_vistoria as any) || {};

      // Merge: keep existing media URLs, add budget/diagnostic data
      const dadosFinais = {
        ...dadosAtuais,
        tipo_dano: dados.tipo_dano,
        descricao_tecnica: dados.descricao_tecnica,
        itens_orcamento: dados.itens_orcamento || [],
        valor_total_orcamento: dados.valor_total_orcamento || 0,
        parecer_tecnico: dados.parecer_tecnico,
        recomendacao: dados.recomendacao,
        observacoes_perda_total: dados.observacoes_perda_total || null,
        etapas_reparo: dados.etapas_reparo || [],
        // New parecer fields
        gravidade: dados.gravidade,
        prazo_estimado: dados.prazo_estimado,
        prazo_observacao: dados.prazo_observacao,
        observacoes_gerais: dados.observacoes_gerais,
        estimativa_total: dados.estimativa_total,
        itens_parecer: dados.itens_parecer || [],
      };

      // Update vistoria
      const { error: updateVistoriaError } = await supabase
        .from("vistorias_evento")
        .update({
          dados_vistoria: dadosFinais,
          status: "concluida",
          concluida_em: new Date().toISOString(),
        })
        .eq("id", vistoriaId);
      if (updateVistoriaError) throw updateVistoriaError;

      // ====== Insert into parecer_tecnico_regulador ======
      const parecerInsert: any = {
        sinistro_id: vistoria.sinistro_id,
        vistoria_id: vistoriaId,
        regulador_id: userId,
        gravidade: dados.gravidade || (dados.tipo_dano === 'total' ? 'possivel_perda_total' : 'moderado'),
        descricao_tecnica: dados.descricao_tecnica || dados.parecer_tecnico || 'Sem descrição',
        prazo_estimado: dados.prazo_estimado || null,
        prazo_observacao: dados.prazo_observacao || null,
        observacoes_gerais: dados.observacoes_gerais || null,
        recomendacao: dados.recomendacao || null,
        estimativa_total: dados.estimativa_total || dados.valor_total_orcamento || 0,
      };

      const { data: parecerData, error: parecerError } = await supabase
        .from("parecer_tecnico_regulador")
        .upsert(parecerInsert, { onConflict: 'sinistro_id' })
        .select()
        .single();

      if (parecerError) {
        console.error("Erro ao salvar parecer técnico:", parecerError);
      }

      // Insert parecer items
      if (parecerData && dados.itens_parecer?.length > 0) {
        // Delete existing items first (for upsert scenario)
        await supabase
          .from("parecer_tecnico_itens")
          .delete()
          .eq("parecer_id", parecerData.id);

        const itensToInsert = dados.itens_parecer.map((item: any) => ({
          parecer_id: parecerData.id,
          tipo: item.tipo === 'mao_de_obra' ? 'servico' : item.tipo,
          descricao: item.descricao,
          origem_sugerida: item.origem_sugerida || null,
          quantidade: item.quantidade || 1,
          valor_estimado: item.valor_estimado || item.valor_unitario || 0,
          prioridade: item.prioridade || 'necessario',
          observacao: item.observacao || null,
        }));

        const { error: itensError } = await supabase
          .from("parecer_tecnico_itens")
          .insert(itensToInsert);
        if (itensError) {
          console.error("Erro ao salvar itens do parecer:", itensError);
        }
      }

      // Insert parecer photos from vistoria media
      if (parecerData && dadosFinais.fotos_urls?.length > 0) {
        const fotosToInsert = dadosFinais.fotos_urls
          .filter((url: string) => url)
          .map((url: string) => ({
            parecer_id: parecerData.id,
            arquivo_url: url,
          }));

        if (fotosToInsert.length > 0) {
          await supabase
            .from("parecer_tecnico_fotos")
            .insert(fotosToInsert);
        }
      }

      // Update sinistro — change to aguardando_orcamento
      const updateSinistro: any = {
        status: "aguardando_orcamento",
        updated_at: new Date().toISOString(),
        regulagem_concluida_em: new Date().toISOString(),
        regulagem_parecer: dados.descricao_tecnica || dados.parecer_tecnico,
        regulagem_tipo_dano: dados.tipo_dano === 'total' || dados.gravidade === 'possivel_perda_total' ? 'perda_total' : 'parcial',
      };

      if (dados.valor_total_orcamento || dados.estimativa_total) {
        updateSinistro.valor_orcamento = dados.estimativa_total || dados.valor_total_orcamento;
      }
      if (dados.tipo_dano) {
        updateSinistro.tipo_dano = dados.tipo_dano;
      }

      const { error: updateSinistroError } = await supabase
        .from("sinistros")
        .update(updateSinistro)
        .eq("id", vistoria.sinistro_id)
        .in("status", ["comunicado", "em_analise", "aguardando_vistoria", "pendente_vistoria_regulador", "documentacao_pendente", "aguardando_regulagem"]);

      if (updateSinistroError) {
        console.error("Erro ao atualizar status do sinistro:", updateSinistroError);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
