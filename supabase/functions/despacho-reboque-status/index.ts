import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const statusValidos = ["chegou_local", "veiculo_carregado", "chegou_destino", "concluido"];

// Mapeamento de status do reboquista → status do chamado
const statusChamadoMap: Record<string, string> = {
  chegou_local: "em_atendimento",
  concluido: "concluido",
};

// Mapeamento de status → mensagem WhatsApp para o associado
const mensagensAssociado: Record<string, (nome: string, destino: string, link: string) => string> = {
  chegou_local: (nome, _destino, link) =>
    `📍 *Reboquista chegou! — Pratic Car*\n\nO reboquista ${nome} chegou ao local do seu veículo.\n\n👉 Acompanhe: ${link}`,
  veiculo_carregado: (nome, destino, link) =>
    `🚛 *Veículo no guincho — Pratic Car*\n\nSeu veículo foi carregado e está sendo levado para:\n📍 ${destino || "o destino informado"}\n\n👉 Acompanhe: ${link}`,
  concluido: (_nome, destino, _link) =>
    `✅ *Veículo entregue — Pratic Car*\n\nSeu veículo foi entregue em:\n📍 ${destino || "o destino informado"}\n\n⏰ Horário: ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}\n\nObrigado por usar a Pratic Car!`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { token, status, latitude, longitude, observacao } = await req.json();

    if (!token || !status) throw new Error("token e status são obrigatórios");
    if (!statusValidos.includes(status)) {
      throw new Error(`Status inválido. Use: ${statusValidos.join(", ")}`);
    }

    // Buscar convite e validar
    const { data: convite } = await supabase
      .from("despacho_reboque_convites")
      .select(`
        prestador_id,
        despacho:despacho_reboque(chamado_id, prestador_atribuido_id, status)
      `)
      .eq("token", token)
      .single();

    if (!convite) throw new Error("Token inválido");

    const despacho = convite.despacho as any;
    if (despacho?.prestador_atribuido_id !== convite.prestador_id) {
      throw new Error("Apenas o prestador atribuído pode atualizar o status");
    }

    const chamadoId = despacho.chamado_id;

    // Inserir log de status
    await supabase.from("despacho_reboque_status_log").insert({
      chamado_id: chamadoId,
      prestador_id: convite.prestador_id,
      status,
      latitude: latitude || null,
      longitude: longitude || null,
      observacao: observacao || null,
    });

    // Atualizar status do chamado se necessário
    const novoStatusChamado = statusChamadoMap[status];
    if (novoStatusChamado) {
      const { data: chamadoAtual } = await supabase
        .from("chamados_assistencia")
        .select("status")
        .eq("id", chamadoId)
        .single();

      if (chamadoAtual && chamadoAtual.status !== novoStatusChamado) {
        await supabase
          .from("chamados_assistencia")
          .update({ status: novoStatusChamado })
          .eq("id", chamadoId);

        await supabase.from("chamados_assistencia_historico").insert({
          chamado_id: chamadoId,
          status_anterior: chamadoAtual.status,
          status_novo: novoStatusChamado,
          observacao: `Status atualizado pelo reboquista: ${status}${observacao ? ` — ${observacao}` : ""}`,
        });
      }

      // Se concluído, atualizar hora_conclusao no atendimento
      if (status === "concluido") {
        await supabase
          .from("chamados_assistencia_atendimentos")
          .update({
            status: "concluido",
            hora_conclusao: new Date().toISOString(),
          })
          .eq("chamado_id", chamadoId)
          .eq("prestador_id", convite.prestador_id);
      }

      if (status === "chegou_local") {
        await supabase
          .from("chamados_assistencia_atendimentos")
          .update({
            status: "no_local",
            hora_chegada: new Date().toISOString(),
          })
          .eq("chamado_id", chamadoId)
          .eq("prestador_id", convite.prestador_id);
      }
    }

    console.log(`[despacho-status] Status '${status}' registrado para chamado ${chamadoId}`);

    // === ENVIAR WHATSAPP AO ASSOCIADO ===
    const mensagemFn = mensagensAssociado[status];
    if (mensagemFn) {
      try {
        // Buscar token de acompanhamento e dados do associado
        const { data: acompToken } = await supabase
          .from("acompanhamento_reboque_tokens")
          .select("token")
          .eq("chamado_id", chamadoId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: chamado } = await supabase
          .from("chamados_assistencia")
          .select("prestador_nome, destino_endereco, destino_logradouro, associado:associados(nome, whatsapp, telefone)")
          .eq("id", chamadoId)
          .single();

        const associado = chamado?.associado as any;
        const telefoneAssociado = associado?.whatsapp || associado?.telefone;

        if (telefoneAssociado && acompToken?.token) {
          const link = `https://pratic-connect-21.lovable.app/acompanhar/reboque/${acompToken.token}`;
          const destino = chamado?.destino_logradouro || chamado?.destino_endereco || "";
          const mensagem = mensagemFn(chamado?.prestador_nome || "Reboquista", destino, link);

          // Mapear template Meta para cada status
          const templateMap: Record<string, { name: string; params: string[] }> = {
            chegou_local: {
              name: "reboque_chegou_local",
              params: [chamado?.prestador_nome || "Reboquista", link],
            },
            veiculo_carregado: {
              name: "reboque_veiculo_carregado",
              params: [destino || "o destino informado", link],
            },
            concluido: {
              name: "reboque_entregue",
              params: [
                destino || "o destino informado",
                new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
              ],
            },
          };

          const templateInfo = templateMap[status];

          await supabase.functions.invoke("whatsapp-send-text", {
            body: {
              telefone: telefoneAssociado.replace(/\D/g, ""),
              mensagem,
              ...(templateInfo && {
                template_name: templateInfo.name,
                template_params: templateInfo.params,
              }),
            },
          });

          console.log(`[despacho-status] WhatsApp '${status}' enviado ao associado`);
        }
      } catch (whatsErr: any) {
        console.error("[despacho-status] Erro ao enviar WhatsApp ao associado:", whatsErr.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[despacho-status] Erro:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
