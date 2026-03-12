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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // accessToken será resolvido após buscar config

  try {
    const body = await req.json();
    const { acao } = body;

    // Buscar config da Meta
    const { data: config } = await supabase
      .from("whatsapp_meta_config")
      .select("*")
      .limit(1)
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({ success: false, error: "Configuração da Meta não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = config.access_token || Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Access Token da Meta não configurado. Vá em Integrações > WhatsApp e configure o token." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AÇÃO: SINCRONIZAR - Buscar status de todos os templates da Meta
    if (acao === "sincronizar") {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates?limit=100`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "Erro ao buscar templates");
      }

      const metaTemplates = result.data || [];
      let atualizados = 0;
      let novos = 0;

      for (const mt of metaTemplates) {
        // Tentar atualizar existente
        const { data: updated } = await supabase
          .from("whatsapp_meta_templates")
          .update({
            status: mt.status?.toUpperCase() || "PENDING",
            meta_template_id: mt.id,
            motivo_rejeicao: mt.rejected_reason || null,
            aprovado_em: mt.status === "APPROVED" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("nome", mt.name)
          .select("id");

        if (updated && updated.length > 0) {
          atualizados++;
        } else {
          // Template existe na Meta mas não no banco — inserir
          const bodyComp = mt.components?.find((c: any) => c.type === "BODY");
          const headerComp = mt.components?.find((c: any) => c.type === "HEADER");
          const footerComp = mt.components?.find((c: any) => c.type === "FOOTER");
          const buttonsComp = mt.components?.find((c: any) => c.type === "BUTTONS");

          let botoes = null;
          if (buttonsComp?.buttons) {
            botoes = buttonsComp.buttons.map((b: any) => ({
              tipo: b.type?.toLowerCase(),
              texto: b.text || "",
              url: b.url || "",
              telefone: b.phone_number || "",
            }));
          }

          const { error: insertErr } = await supabase
            .from("whatsapp_meta_templates")
            .insert({
              nome: mt.name,
              categoria: mt.category || "UTILITY",
              idioma: mt.language || "pt_BR",
              status: mt.status?.toUpperCase() || "PENDING",
              meta_template_id: mt.id,
              header_tipo: headerComp ? headerComp.format?.toLowerCase() : "none",
              header_texto: headerComp?.text || null,
              corpo: bodyComp?.text || "",
              rodape: footerComp?.text || null,
              botoes: botoes,
              motivo_rejeicao: mt.rejected_reason || null,
              aprovado_em: mt.status === "APPROVED" ? new Date().toISOString() : null,
            });

          if (!insertErr) novos++;
        }
      }

      console.log(`[whatsapp-meta-templates] Sincronizados: ${atualizados} atualizados, ${novos} novos`);

      return new Response(
        JSON.stringify({ success: true, total: metaTemplates.length, atualizados, novos }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AÇÃO: CRIAR/ENVIAR template para a Meta
    if (acao === "enviar") {
      const { template_id } = body;

      const { data: template } = await supabase
        .from("whatsapp_meta_templates")
        .select("*")
        .eq("id", template_id)
        .single();

      if (!template) {
        throw new Error("Template não encontrado");
      }

      // Montar componentes do template para a Meta
      const components: any[] = [];

      // Header
      if (template.header_tipo === "text" && template.header_texto) {
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: template.header_texto,
        });
      } else if (template.header_tipo === "image") {
        components.push({
          type: "HEADER",
          format: "IMAGE",
          example: { header_handle: ["https://placeholder.com/image.jpg"] },
        });
      } else if (template.header_tipo === "document") {
        components.push({
          type: "HEADER",
          format: "DOCUMENT",
          example: { header_handle: ["https://placeholder.com/doc.pdf"] },
        });
      }

      // Body
      const bodyComponent: any = {
        type: "BODY",
        text: template.corpo,
      };

      // Detectar variáveis reais no corpo e filtrar exemplos
      const varsNoCorpo = (template.corpo.match(/\{\{(\d+)\}\}/g) || [])
        .map((m: string) => m.replace(/[{}]/g, ''))
        .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)
        .sort((a: string, b: string) => parseInt(a) - parseInt(b));

      const varExemplos = template.variaveis_exemplo as Record<string, string> | null;
      if (varExemplos && varsNoCorpo.length > 0) {
        const valores = varsNoCorpo.map((k: string) => varExemplos[k] || `exemplo_${k}`);
        bodyComponent.example = { body_text: [valores] };
      }
      components.push(bodyComponent);

      // Footer
      if (template.rodape) {
        components.push({ type: "FOOTER", text: template.rodape });
      }

      // Botões (aceita tanto tipo/texto quanto type/text)
      const botoes = template.botoes as any[] | null;
      if (botoes && botoes.length > 0) {
        const buttons = botoes.map((b: any) => {
          const bTipo = (b.tipo || b.type || '').toLowerCase();
          const bTexto = b.texto || b.text || '';
          const bUrl = b.url || '';
          const bTelefone = b.telefone || b.phone_number || '';
          if (bTipo === "url") {
            const btn: any = { type: "URL", text: bTexto, url: bUrl };
            if (bUrl?.includes("{{")) {
              btn.example = ["https://pratic-connect-21.lovable.app/primeiro-acesso?id=exemplo-id-123"];
            }
            return btn;
          } else if (bTipo === "telefone" || bTipo === "phone_number") {
            return { type: "PHONE_NUMBER", text: bTexto, phone_number: bTelefone };
          } else {
            return { type: "QUICK_REPLY", text: bTexto };
          }
        });
        components.push({ type: "BUTTONS", buttons });
      }

      const metaPayload = {
        name: template.nome,
        language: template.idioma || "pt_BR",
        category: template.categoria,
        components,
      };

      console.log("[whatsapp-meta-templates] Enviando template:", JSON.stringify(metaPayload));

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates`,
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
        console.error("[whatsapp-meta-templates] Erro Meta:", result);
        
        const motivoRejeicao = result.error?.error_user_msg || result.error?.message || "Erro desconhecido";
        
        // Auto-resolver: template já existe na Meta → deletar e recriar
        const jaExiste = motivoRejeicao.toLowerCase().includes("já existe")
          || motivoRejeicao.toLowerCase().includes("already exists")
          || motivoRejeicao.toLowerCase().includes("content for this language already exists")
          || (result.error?.code === 2388023);

        if (jaExiste) {
          console.log(`[whatsapp-meta-templates] Template '${template.nome}' já existe na Meta, deletando e recriando...`);

          // Deletar da Meta
          const delRes = await fetch(
            `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates?name=${template.nome}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
          );
          console.log(`[whatsapp-meta-templates] DELETE status: ${delRes.status}`);

          await new Promise((r) => setTimeout(r, 2000));

          // Reenviar
          const retryResponse = await fetch(
            `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(metaPayload),
            }
          );
          const retryResult = await retryResponse.json();

          if (retryResponse.ok) {
            await supabase
              .from("whatsapp_meta_templates")
              .update({
                status: retryResult.status?.toUpperCase() || "PENDING",
                meta_template_id: retryResult.id,
                enviado_em: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", template_id);

            console.log(`[whatsapp-meta-templates] ✓ Template '${template.nome}' recriado - ID: ${retryResult.id}`);
            return new Response(
              JSON.stringify({ success: true, meta_id: retryResult.id, status: retryResult.status }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.error("[whatsapp-meta-templates] Retry falhou:", retryResult);
            const retryMotivo = retryResult.error?.error_user_msg || retryResult.error?.message || "Erro no retry";
            await supabase
              .from("whatsapp_meta_templates")
              .update({ status: "REJECTED", motivo_rejeicao: retryMotivo, updated_at: new Date().toISOString() })
              .eq("id", template_id);

            return new Response(
              JSON.stringify({ success: false, error: retryMotivo }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        await supabase
          .from("whatsapp_meta_templates")
          .update({
            status: "REJECTED",
            motivo_rejeicao: motivoRejeicao,
            updated_at: new Date().toISOString(),
          })
          .eq("id", template_id);

        return new Response(
          JSON.stringify({ success: false, error: motivoRejeicao }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atualizar status no banco
      await supabase
        .from("whatsapp_meta_templates")
        .update({
          status: result.status?.toUpperCase() || "PENDING",
          meta_template_id: result.id,
          enviado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", template_id);

      console.log(`[whatsapp-meta-templates] ✓ Template '${template.nome}' enviado - ID: ${result.id}`);

      return new Response(
        JSON.stringify({ success: true, meta_id: result.id, status: result.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AÇÃO: ENVIAR TODOS os templates DRAFT para a Meta
    if (acao === "enviar_todos") {
      const { data: drafts } = await supabase
        .from("whatsapp_meta_templates")
        .select("*")
        .in("status", ["DRAFT", "REJECTED"]);

      if (!drafts || drafts.length === 0) {
        return new Response(
          JSON.stringify({ success: true, enviados: 0, erros: 0, mensagem: "Nenhum template em rascunho para enviar" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let enviados = 0;
      let erros = 0;
      const resultados: any[] = [];

      for (const template of drafts) {
        try {
          const components: any[] = [];

          if (template.header_tipo === "text" && template.header_texto) {
            components.push({ type: "HEADER", format: "TEXT", text: template.header_texto });
          } else if (template.header_tipo === "image") {
            components.push({ type: "HEADER", format: "IMAGE", example: { header_handle: ["https://placeholder.com/image.jpg"] } });
          } else if (template.header_tipo === "document") {
            components.push({ type: "HEADER", format: "DOCUMENT", example: { header_handle: ["https://placeholder.com/doc.pdf"] } });
          }

          const bodyComponent: any = { type: "BODY", text: template.corpo };
          const varExemplos = template.variaveis_exemplo as Record<string, string> | null;
          if (varExemplos) {
            const valores = Object.keys(varExemplos)
              .sort((a, b) => parseInt(a) - parseInt(b))
              .map((k) => varExemplos[k]);
            if (valores.length > 0) {
              bodyComponent.example = { body_text: [valores] };
            }
          }
          components.push(bodyComponent);

          if (template.rodape) {
            components.push({ type: "FOOTER", text: template.rodape });
          }

          const botoes = template.botoes as any[] | null;
          if (botoes && botoes.length > 0) {
            const buttons = botoes.map((b: any) => {
              const bTipo = (b.tipo || b.type || '').toLowerCase();
              const bTexto = b.texto || b.text || '';
              const bUrl = b.url || '';
              const bTelefone = b.telefone || b.phone_number || '';
              if (bTipo === "url") {
                const btn: any = { type: "URL", text: bTexto, url: bUrl };
                if (bUrl?.includes("{{")) {
                  btn.example = ["https://pratic-connect-21.lovable.app/primeiro-acesso?id=exemplo-id-123"];
                }
                return btn;
              }
              if (bTipo === "telefone" || bTipo === "phone_number") return { type: "PHONE_NUMBER", text: bTexto, phone_number: bTelefone };
              return { type: "QUICK_REPLY", text: bTexto };
            });
            components.push({ type: "BUTTONS", buttons });
          }

          const metaPayload = {
            name: template.nome,
            language: template.idioma || "pt_BR",
            category: template.categoria,
            components,
          };

          console.log(`[whatsapp-meta-templates] Enviando: ${template.nome}`);

          const response = await fetch(
            `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(metaPayload),
            }
          );

          const result = await response.json();

          if (!response.ok) {
            const motivoErro = result.error?.error_user_msg || result.error?.message || "Erro desconhecido";
            const jaExiste = motivoErro.toLowerCase().includes("já existe")
              || motivoErro.toLowerCase().includes("already exists")
              || motivoErro.toLowerCase().includes("content for this language already exists")
              || (result.error?.code === 2388023);

            if (jaExiste) {
              console.log(`[whatsapp-meta-templates] '${template.nome}' já existe, deletando e recriando...`);
              await fetch(
                `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates?name=${template.nome}`,
                { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
              );
              await new Promise((r) => setTimeout(r, 2000));

              const retryRes = await fetch(
                `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates`,
                { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(metaPayload) }
              );
              const retryResult = await retryRes.json();

              if (retryRes.ok) {
                await supabase.from("whatsapp_meta_templates").update({
                  status: retryResult.status?.toUpperCase() || "PENDING",
                  meta_template_id: retryResult.id,
                  enviado_em: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }).eq("id", template.id);
                enviados++;
                resultados.push({ nome: template.nome, sucesso: true, meta_id: retryResult.id });
                console.log(`[whatsapp-meta-templates] ✓ '${template.nome}' recriado - ID: ${retryResult.id}`);
              } else {
                console.error(`[whatsapp-meta-templates] Retry falhou '${template.nome}':`, retryResult);
                await supabase.from("whatsapp_meta_templates").update({
                  status: "REJECTED",
                  motivo_rejeicao: retryResult.error?.error_user_msg || retryResult.error?.message || "Erro no retry",
                  updated_at: new Date().toISOString(),
                }).eq("id", template.id);
                erros++;
                resultados.push({ nome: template.nome, sucesso: false, erro: retryResult.error?.message });
              }
            } else {
              console.error(`[whatsapp-meta-templates] Erro ao enviar '${template.nome}':`, result);
              await supabase.from("whatsapp_meta_templates").update({
                status: "REJECTED",
                motivo_rejeicao: motivoErro,
                updated_at: new Date().toISOString(),
              }).eq("id", template.id);
              erros++;
              resultados.push({ nome: template.nome, sucesso: false, erro: motivoErro });
            }
          } else {
            await supabase.from("whatsapp_meta_templates").update({
              status: result.status?.toUpperCase() || "PENDING",
              meta_template_id: result.id,
              enviado_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", template.id);
            enviados++;
            resultados.push({ nome: template.nome, sucesso: true, meta_id: result.id });
            console.log(`[whatsapp-meta-templates] ✓ '${template.nome}' enviado - ID: ${result.id}`);
          }

          // Esperar 1s entre envios para respeitar rate limit da Meta
          await new Promise((r) => setTimeout(r, 1000));
        } catch (err: any) {
          console.error(`[whatsapp-meta-templates] Exceção ao enviar '${template.nome}':`, err);
          erros++;
          resultados.push({ nome: template.nome, sucesso: false, erro: err.message });
        }
      }

      console.log(`[whatsapp-meta-templates] Envio em massa: ${enviados} enviados, ${erros} erros`);

      return new Response(
        JSON.stringify({ success: true, enviados, erros, resultados }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AÇÃO: EXCLUIR template da Meta
    if (acao === "excluir") {
      const { template_id, nome } = body;

      // Excluir da Meta (se tiver meta_template_id)
      const { data: template } = await supabase
        .from("whatsapp_meta_templates")
        .select("meta_template_id, nome")
        .eq("id", template_id)
        .single();

      if (template?.meta_template_id) {
        const templateName = nome || template.nome;
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates?name=${templateName}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) {
          const result = await response.json();
          console.warn("[whatsapp-meta-templates] Aviso ao excluir da Meta:", result);
        }
      }

      // Excluir do banco
      await supabase.from("whatsapp_meta_templates").delete().eq("id", template_id);

      console.log(`[whatsapp-meta-templates] ✓ Template excluído`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação não reconhecida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[whatsapp-meta-templates] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
