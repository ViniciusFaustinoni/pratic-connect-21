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
    const {
      cotacao_id,
      valor_fipe,
      limite_aplicado,
      tipo_veiculo,
      veiculo_marca,
      veiculo_modelo,
      veiculo_ano,
      veiculo_placa,
      nome_solicitante,
      categoria_placa,
    } = body;

    if (!cotacao_id) {
      return new Response(JSON.stringify({ error: "cotacao_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se regra está ativa
    const { data: configAtiva } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "dupla_aprovacao_fipe_diretoria_ativa")
      .maybeSingle();

    if (configAtiva?.valor !== "true") {
      return new Response(JSON.stringify({ success: true, message: "Regra desativada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar todos os diretores com telefone
    const { data: diretores } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "diretor");

    if (!diretores || diretores.length === 0) {
      console.error("[notificar-diretoria-fipe] Nenhum diretor encontrado");
      return new Response(JSON.stringify({ error: "Nenhum diretor cadastrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = diretores.map((d: any) => d.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nome, telefone, whatsapp")
      .in("id", userIds);

    if (!profiles || profiles.length === 0) {
      console.error("[notificar-diretoria-fipe] Nenhum perfil de diretor encontrado");
      return new Response(JSON.stringify({ error: "Perfis de diretores não encontrados" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marcar cotação como pendente
    await supabase
      .from("cotacoes")
      .update({ fipe_diretoria_aprovado: false })
      .eq("id", cotacao_id);

    // Verificar se template Meta está aprovado
    const { data: templateMeta } = await supabase
      .from("whatsapp_meta_templates")
      .select("nome, status")
      .eq("nome", "aprovacao_fipe_diretoria_v1")
      .maybeSingle();

    const templateAprovado = templateMeta?.status === "APPROVED";

    const fipeFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor_fipe || 0);
    const limiteFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(limite_aplicado || 0);

    let enviados = 0;

    for (const profile of profiles) {
      const telefone = profile.whatsapp || profile.telefone;
      if (!telefone) {
        console.warn(`[notificar-diretoria-fipe] Diretor ${profile.nome} sem telefone`);
        continue;
      }

      const telLimpo = telefone.replace(/\D/g, "");

      // Criar registro de aprovação
      const { error: insertErr } = await supabase
        .from("aprovacoes_fipe_diretoria")
        .insert({
          cotacao_id,
          diretor_id: profile.id,
          telefone: telLimpo,
          status: "pendente",
        });

      if (insertErr) {
        console.warn(`[notificar-diretoria-fipe] Erro ao inserir aprovação para ${profile.nome}:`, insertErr.message);
        continue;
      }

      // Montar parâmetros do template
      const marcaModelo = `${veiculo_marca || ""} ${veiculo_modelo || ""}`.trim();
      const templateParams = [
        marcaModelo || "N/A",
        String(veiculo_ano || "N/A"),
        veiculo_placa || "N/A",
        fipeFormatado,
        limiteFormatado,
        tipo_veiculo || categoria_placa || "N/A",
        nome_solicitante || "N/A",
      ];

      // Mensagem fallback (texto livre) caso template não esteja aprovado
      const mensagemFallback = `🔔 *Autorização FIPE Necessária*\n\n` +
        `Veículo: *${marcaModelo}* ${veiculo_ano || ""}\n` +
        `Placa: *${veiculo_placa || "N/A"}*\n` +
        `Tipo: ${tipo_veiculo || categoria_placa || "N/A"}\n` +
        `Valor FIPE: *${fipeFormatado}*\n` +
        `Limite configurado: ${limiteFormatado}\n` +
        `Associado: *${nome_solicitante || "N/A"}*\n\n` +
        `O valor FIPE está acima do limite. Sua autorização é necessária.\n\n` +
        `Responda *APROVAR* ou *RECUSAR*.`;

      try {
        const sendPayload: any = {
          telefone: telLimpo,
          mensagem: mensagemFallback,
        };

        if (templateAprovado) {
          // Enviar via template Meta estruturado
          sendPayload.template_name = "aprovacao_fipe_diretoria_v1";
          sendPayload.template_params = templateParams;
          console.log(`[notificar-diretoria-fipe] Enviando template Meta para ${profile.nome}`);
        } else {
          // Fallback: texto livre
          sendPayload.allow_text = true;
          console.log(`[notificar-diretoria-fipe] Template não aprovado (${templateMeta?.status}). Enviando texto livre para ${profile.nome}`);
        }

        const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify(sendPayload),
        });

        const result = await res.json();
        if (result.success) {
          enviados++;
          console.log(`[notificar-diretoria-fipe] ✓ Notificação enviada para ${profile.nome}`);
        } else {
          console.error(`[notificar-diretoria-fipe] Erro envio para ${profile.nome}:`, result.error);
        }
      } catch (e) {
        console.error(`[notificar-diretoria-fipe] Erro ao enviar para ${profile.nome}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, diretores_notificados: enviados, template_usado: templateAprovado }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[notificar-diretoria-fipe] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
