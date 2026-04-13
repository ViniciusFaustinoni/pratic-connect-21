import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const templateName = body.template_name || "aprovacao_fipe_diretoria_v2";
    const forceRecreate = body.force_recreate === true;

    // Buscar template do banco
    const { data: template, error: tmplErr } = await supabase
      .from("whatsapp_meta_templates")
      .select("*")
      .eq("nome", templateName)
      .single();

    if (tmplErr || !template) {
      return new Response(
        JSON.stringify({ error: `Template '${templateName}' não encontrado na tabela` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais Meta
    const { data: metaConfig } = await supabase
      .from("whatsapp_meta_config")
      .select("waba_id, access_token")
      .eq("ativo", true)
      .single();

    const accessToken = metaConfig?.access_token || Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
    const wabaId = metaConfig?.waba_id;

    if (!accessToken || !wabaId) {
      return new Response(
        JSON.stringify({ error: "Credenciais Meta (access_token ou waba_id) não configuradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se force_recreate, deletar o template existente na Meta primeiro
    if (forceRecreate) {
      console.log(`[whatsapp-submit-template] Deletando template '${templateName}' da Meta...`);
      const delRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?name=${templateName}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const delResult = await delRes.json();
      console.log(`[whatsapp-submit-template] Delete result:`, JSON.stringify(delResult));
      // Aguardar um pouco para a Meta processar
      await new Promise(r => setTimeout(r, 2000));
    }

    // Montar corpo do template para a API da Meta
    const varMatches = (template.corpo || "").match(/\{\{\d+\}\}/g) || [];
    const varCount = new Set(varMatches).size;
    const exampleValues = [];
    for (let i = 1; i <= varCount; i++) {
      exampleValues.push(`exemplo_${i}`);
    }

    const components: any[] = [
      {
        type: "BODY",
        text: template.corpo,
        ...(varCount > 0 ? {
          example: {
            body_text: [exampleValues],
          },
        } : {}),
      },
    ];

    // Adicionar botões se existirem
    if (template.botoes && Array.isArray(template.botoes) && template.botoes.length > 0) {
      const buttons = template.botoes.map((b: any) => {
        if (b.type === "QUICK_REPLY" || b.tipo === "resposta_rapida") {
          return { type: "QUICK_REPLY", text: b.text || b.texto };
        }
        if (b.type === "URL" || b.tipo === "url") {
          return { type: "URL", text: b.text || b.texto, url: b.url };
        }
        return b;
      });
      components.push({ type: "BUTTONS", buttons });
    }

    const metaPayload = {
      name: template.nome,
      language: template.idioma || "pt_BR",
      category: (template.categoria || "UTILITY").toUpperCase(),
      components,
    };

    console.log(`[whatsapp-submit-template] Submetendo template '${templateName}' ao WABA ${wabaId}`);
    console.log(`[whatsapp-submit-template] Payload:`, JSON.stringify(metaPayload));

    // Chamar API da Meta
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(`[whatsapp-submit-template] Erro Meta:`, JSON.stringify(result));

      await supabase
        .from("whatsapp_meta_templates")
        .update({
          status: "REJECTED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id);

      return new Response(
        JSON.stringify({
          error: result.error?.message || "Erro ao submeter template",
          meta_error: result.error,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sucesso — atualizar status no banco
    const newStatus = result.status || "PENDING";
    const metaTemplateId = result.id;

    await supabase
      .from("whatsapp_meta_templates")
      .update({
        status: newStatus,
        meta_template_id: metaTemplateId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", template.id);

    console.log(`[whatsapp-submit-template] ✓ Template '${templateName}' submetido. Status: ${newStatus}, ID Meta: ${metaTemplateId}`);

    return new Response(
      JSON.stringify({
        success: true,
        template_name: templateName,
        status: newStatus,
        meta_template_id: metaTemplateId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[whatsapp-submit-template] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
