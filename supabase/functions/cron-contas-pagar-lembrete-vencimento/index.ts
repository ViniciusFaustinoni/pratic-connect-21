import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getServiceClient, notificarSocios, formatBRL, formatData, dataBRT, addDias, labelCategoria,
} from "../_shared/solicitacoes-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function linha(c: any): string {
  return `• *${c.fornecedor_nome}* · ${labelCategoria(c.categoria)} · ${formatBRL(c.valor)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const hoje = dataBRT();
    const amanha = addDias(hoje, 1);

    const { data: vespera } = await supabase
      .from("contas_pagar")
      .select("id, fornecedor_nome, categoria, valor, data_vencimento")
      .not("status", "in", "(pago,cancelado)")
      .eq("data_vencimento", amanha)
      .eq("lembrete_vespera_enviado", false);

    const { data: dia } = await supabase
      .from("contas_pagar")
      .select("id, fornecedor_nome, categoria, valor, data_vencimento")
      .not("status", "in", "(pago,cancelado)")
      .eq("data_vencimento", hoje)
      .eq("lembrete_dia_enviado", false);

    let enviosVespera = 0;
    let enviosDia = 0;

    if (vespera && vespera.length > 0) {
      const total = vespera.reduce((a: number, c: any) => a + Number(c.valor || 0), 0);
      const msg =
        `⏰ *Contas a pagar — vencem amanhã* (${formatData(amanha)})\n\n` +
        vespera.map(linha).join("\n") +
        `\n\n💰 Total: *${formatBRL(total)}*`;
      const r = await notificarSocios(supabase, msg);
      enviosVespera = r.enviados;
      await supabase.from("contas_pagar")
        .update({ lembrete_vespera_enviado: true })
        .in("id", vespera.map((c: any) => c.id));
    }

    if (dia && dia.length > 0) {
      const total = dia.reduce((a: number, c: any) => a + Number(c.valor || 0), 0);
      const msg =
        `🔴 *Contas a pagar — vencem HOJE* (${formatData(hoje)})\n\n` +
        dia.map(linha).join("\n") +
        `\n\n💰 Total: *${formatBRL(total)}*`;
      const r = await notificarSocios(supabase, msg);
      enviosDia = r.enviados;
      await supabase.from("contas_pagar")
        .update({ lembrete_dia_enviado: true })
        .in("id", dia.map((c: any) => c.id));
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
    console.error("[cron-contas-pagar-lembrete-vencimento] erro:", e);
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
