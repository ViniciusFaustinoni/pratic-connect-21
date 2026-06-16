import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getServiceClient, notificarSocios, formatBRL, formatData, dataBRT, addDias,
  labelCategoria, labelPrioridade,
} from "../_shared/solicitacoes-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function linha(s: any): string {
  return `• *${s.solicitante_nome}* · ${labelCategoria(s.categoria)} · ${formatBRL(s.valor)}` +
    (s.prioridade && s.prioridade !== "normal" ? ` · ${labelPrioridade(s.prioridade)}` : "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const hoje = dataBRT();
    const amanha = addDias(hoje, 1);

    // Considera apenas solicitações ainda abertas (aguardando liberação ou liberadas)
    const abertas = ["pendente", "aprovado"];

    // Vencem AMANHÃ (véspera)
    const { data: vespera } = await supabase
      .from("solicitacoes_financeiras")
      .select("*")
      .in("status", abertas)
      .eq("data_vencimento", amanha)
      .eq("lembrete_vespera_enviado", false);

    // Vencem HOJE
    const { data: dia } = await supabase
      .from("solicitacoes_financeiras")
      .select("*")
      .in("status", abertas)
      .eq("data_vencimento", hoje)
      .eq("lembrete_dia_enviado", false);

    let enviosVespera = 0;
    let enviosDia = 0;

    if (vespera && vespera.length > 0) {
      const total = vespera.reduce((a: number, s: any) => a + Number(s.valor || 0), 0);
      const msg =
        `⏰ *Contas que vencem amanhã* (${formatData(amanha)})\n\n` +
        vespera.map(linha).join("\n") +
        `\n\n💰 Total: *${formatBRL(total)}*`;
      const r = await notificarSocios(supabase, msg);
      enviosVespera = r.enviados;
      await supabase.from("solicitacoes_financeiras")
        .update({ lembrete_vespera_enviado: true })
        .in("id", vespera.map((s: any) => s.id));
    }

    if (dia && dia.length > 0) {
      const total = dia.reduce((a: number, s: any) => a + Number(s.valor || 0), 0);
      const msg =
        `🔴 *Contas que vencem HOJE* (${formatData(hoje)})\n\n` +
        dia.map(linha).join("\n") +
        `\n\n💰 Total: *${formatBRL(total)}*`;
      const r = await notificarSocios(supabase, msg);
      enviosDia = r.enviados;
      await supabase.from("solicitacoes_financeiras")
        .update({ lembrete_dia_enviado: true })
        .in("id", dia.map((s: any) => s.id));
    }

    return new Response(
      JSON.stringify({
        success: true,
        vespera: vespera?.length || 0,
        dia: dia?.length || 0,
        enviosVespera, enviosDia,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[cron-solicitacoes-lembrete-vencimento] erro:", e);
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
