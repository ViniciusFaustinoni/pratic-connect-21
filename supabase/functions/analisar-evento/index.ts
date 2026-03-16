import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfiguracaoNumero } from "../_shared/config-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sinistro_id, acao, observacao, motivo, motivo_padrao } = await req.json();

    if (!sinistro_id || !acao) {
      return new Response(JSON.stringify({ success: false, error: "sinistro_id e acao são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get analyst name
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("user_id", user.id)
      .single();

    const analistaNome = profile?.nome || "Analista";

    if (acao === "reprovar") {
      // 1. Update sinistro status
      await supabase
        .from("sinistros")
        .update({ status: "reprovado", updated_at: new Date().toISOString() })
        .eq("id", sinistro_id);

      // 2. Record history
      await supabase.from("sinistro_historico").insert({
        sinistro_id,
        status_anterior: "aguardando_analise",
        status_novo: "reprovado",
        observacao: `${motivo_padrao ? `[${motivo_padrao}] ` : ""}${motivo || ""}`,
        usuario_id: user.id,
        usuario_nome: analistaNome,
      });

      // 3. Invalidate active links
      await supabase
        .from("sinistro_evento_links")
        .update({ status: "invalidado" })
        .eq("sinistro_id", sinistro_id)
        .eq("status", "ativo");

      // 4. Try to send WhatsApp notification (non-blocking)
      try {
        const { data: sinistro } = await supabase
          .from("sinistros")
          .select("associado:associados!sinistros_associado_id_fkey(nome, whatsapp, telefone)")
          .eq("id", sinistro_id)
          .single();

        const telefone = (sinistro as any)?.associado?.whatsapp || (sinistro as any)?.associado?.telefone;
        if (telefone) {
          await supabase.functions.invoke("whatsapp-send-text", {
            body: {
              phone: telefone,
              message: `⚠️ *PRATIC - Evento Reprovado*\n\nOlá ${(sinistro as any)?.associado?.nome},\n\nSeu evento foi analisado e infelizmente foi reprovado.\n\nMotivo: ${motivo_padrao || ""} - ${motivo || ""}\n\nEm caso de dúvidas, entre em contato conosco.`,
            },
          });
        }
      } catch (e) {
        console.error("[analisar-evento] Erro WhatsApp:", e);
      }

      console.log(`[analisar-evento] Sinistro ${sinistro_id} REPROVADO por ${analistaNome}`);

      return new Response(JSON.stringify({ success: true, status: "reprovado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (acao === "aprovar") {
      // 1. Update sinistro status
      await supabase
        .from("sinistros")
        .update({ status: "aprovado", updated_at: new Date().toISOString() })
        .eq("id", sinistro_id);

      // 2. Record history
      await supabase.from("sinistro_historico").insert({
        sinistro_id,
        status_anterior: "aguardando_analise",
        status_novo: "aprovado",
        observacao: observacao || "Aprovado pelo analista de eventos",
        usuario_id: user.id,
        usuario_nome: analistaNome,
      });

      // 3. Read dynamic deadline
      const prazoLink = await getConfiguracaoNumero(supabase, 'prazo_link_evento_horas', 72);

      // 3b. Invalidate active links
      await supabase
        .from("sinistro_evento_links")
        .update({ status: "invalidado" })
        .eq("sinistro_id", sinistro_id)
        .eq("status", "ativo");

      // 4. Generate new link (dynamic deadline)
      const expiraEm = new Date();
      expiraEm.setHours(expiraEm.getHours() + prazoLink);

      const { data: novoLink, error: linkError } = await supabase
        .from("sinistro_evento_links")
        .insert({
          sinistro_id,
          expira_em: expiraEm.toISOString(),
          status: "ativo",
          etapa_atual: 0,
        })
        .select("id, token, expira_em")
        .single();

      if (linkError) {
        console.error("[analisar-evento] Erro ao gerar link:", linkError);
      }

      // 5. Update sinistro with new link
      if (novoLink) {
        await supabase
          .from("sinistros")
          .update({ link_evento_id: novoLink.id })
          .eq("id", sinistro_id);
      }

      // 6. Autentique será chamado somente APÓS confirmação do pagamento (em processar-termo-evento)

      // 7. Try WhatsApp notification (non-blocking)
      try {
        const { data: sinistro } = await supabase
          .from("sinistros")
          .select("associado:associados!sinistros_associado_id_fkey(nome, whatsapp, telefone)")
          .eq("id", sinistro_id)
          .single();

        const telefone = (sinistro as any)?.associado?.whatsapp || (sinistro as any)?.associado?.telefone;
        if (telefone && novoLink) {
          const appUrl = Deno.env.get("APP_PUBLIC_URL") || "https://pratic-connect-21.lovable.app";
          const linkUrl = `${appUrl}/evento/${novoLink.token}`;
          await supabase.functions.invoke("whatsapp-send-text", {
            body: {
              phone: telefone,
              message: `✅ *PRATIC - Evento Aprovado*\n\nOlá ${(sinistro as any)?.associado?.nome},\n\nSeu evento foi aprovado! 🎉\n\nAcesse o link abaixo para efetuar o pagamento da cota de coparticipação e assinar o Termo de Entrada:\n${linkUrl}\n\n⏰ Este link expira em 72 horas.`,
            },
          });
        }
      } catch (e) {
        console.error("[analisar-evento] Erro WhatsApp:", e);
      }

      console.log(`[analisar-evento] Sinistro ${sinistro_id} APROVADO por ${analistaNome}. Novo link: ${novoLink?.token}`);

      return new Response(
        JSON.stringify({ success: true, status: "aprovado", link_token: novoLink?.token }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: false, error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[analisar-evento] Erro:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
