import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getServiceClient, enviarWhatsApp, notificarSocios, getTelefoneSolicitante,
  formatBRL, formatData, labelSetor, labelCategoria, labelTipo, labelPrioridade, APP_URL,
} from "../_shared/solicitacoes-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { solicitacao_id, evento } = await req.json();
    if (!solicitacao_id || !evento) {
      return json({ success: false, error: "solicitacao_id e evento são obrigatórios" }, 400);
    }

    const supabase = getServiceClient();
    const { data: s, error } = await supabase
      .from("solicitacoes_financeiras")
      .select("*")
      .eq("id", solicitacao_id)
      .single();
    if (error || !s) return json({ success: false, error: "Solicitação não encontrada" }, 404);

    const link = `${APP_URL}/financeiro/solicitacoes`;

    // ============ CRIADA → avisa os sócios ============
    if (evento === "criada") {
      if (s.notificado_criada) return json({ success: true, skipped: "ja_notificado" });

      const msg =
        `🧾 *Nova solicitação financeira*\n\n` +
        `👤 Solicitante: *${s.solicitante_nome}*\n` +
        `🏢 Setor: ${labelSetor(s.setor)}\n` +
        `💼 Conta/Despesa: ${labelCategoria(s.categoria)}\n` +
        `💳 Tipo: ${labelTipo(s.tipo)}\n` +
        `💰 Valor: *${formatBRL(s.valor)}*\n` +
        `📅 Vencimento: *${formatData(s.data_vencimento || s.data_necessidade)}*\n` +
        `🚦 Prioridade: ${labelPrioridade(s.prioridade)}\n` +
        (s.numero_documento ? `🧾 NF/Doc: ${s.numero_documento}\n` : "") +
        `\n📝 ${s.descricao}\n\n` +
        `👉 Libere no painel: ${link}`;

      const r = await notificarSocios(supabase, msg);
      await supabase.from("solicitacoes_financeiras")
        .update({ notificado_criada: true }).eq("id", s.id);
      return json({ success: true, evento, ...r });
    }

    // ============ DECISÃO FINAL → avisa o solicitante ============
    if (evento === "aprovacao_check") {
      if (!["aprovado", "rejeitado"].includes(s.status)) {
        return json({ success: true, skipped: "ainda_em_analise", status: s.status });
      }
      if (s.notificado_decisao) return json({ success: true, skipped: "ja_notificado" });

      const tel = await getTelefoneSolicitante(supabase, s);
      let msg = "";
      if (s.status === "aprovado") {
        msg =
          `✅ *Solicitação aprovada!*\n\n` +
          `Olá, ${s.solicitante_nome}! Sua solicitação de *${labelTipo(s.tipo)}* no valor de ` +
          `*${formatBRL(s.valor)}* foi *liberada pelos sócios* e seguirá para pagamento. 🎉\n\n` +
          `📝 ${s.descricao}`;
      } else {
        msg =
          `❌ *Solicitação não aprovada*\n\n` +
          `Olá, ${s.solicitante_nome}. Sua solicitação de *${labelTipo(s.tipo)}* ` +
          `(${formatBRL(s.valor)}) foi *rejeitada*.\n` +
          (s.motivo_rejeicao ? `Motivo: ${s.motivo_rejeicao}` : "");
      }

      const r = await enviarWhatsApp(tel, msg);
      await supabase.from("solicitacoes_financeiras")
        .update({ notificado_decisao: true }).eq("id", s.id);
      return json({ success: true, evento, status: s.status, envio: r });
    }

    // ============ PAGO → avisa o solicitante ============
    if (evento === "pago") {
      if (s.status !== "pago") return json({ success: true, skipped: "nao_pago", status: s.status });
      if (s.notificado_pago) return json({ success: true, skipped: "ja_notificado" });

      const tel = await getTelefoneSolicitante(supabase, s);
      const msg =
        `💸 *Pagamento efetuado!*\n\n` +
        `Olá, ${s.solicitante_nome}! O pagamento da sua solicitação de *${labelTipo(s.tipo)}* ` +
        `no valor de *${formatBRL(s.valor)}* foi realizado. ✅`;

      const r = await enviarWhatsApp(tel, msg);
      await supabase.from("solicitacoes_financeiras")
        .update({ notificado_pago: true }).eq("id", s.id);
      return json({ success: true, evento, envio: r });
    }

    return json({ success: false, error: `evento desconhecido: ${evento}` }, 400);
  } catch (e: any) {
    console.error("[notificar-solicitacao-financeira] erro:", e);
    return json({ success: false, error: e?.message || String(e) }, 500);
  }

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
