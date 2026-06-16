import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getServiceClient, notificarSocios, formatBRL, formatData, dataBRT,
  labelCategoria,
} from "../_shared/solicitacoes-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const hoje = dataBRT();

    const { data: todas } = await supabase
      .from("solicitacoes_financeiras")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);

    const rows = todas || [];
    const soma = (arr: any[]) => arr.reduce((a, s) => a + Number(s.valor || 0), 0);

    const novasHoje = rows.filter((s) => dataBRT(s.created_at) === hoje);
    const pagasHoje = rows.filter((s) => s.status === "pago" && s.pago_em && dataBRT(s.pago_em) === hoje);
    const pendentes = rows.filter((s) => s.status === "pendente");
    const liberadas = rows.filter((s) => s.status === "aprovado");

    const listaNovas = novasHoje.slice(0, 8).map((s) =>
      `• *${s.solicitante_nome}* · ${labelCategoria(s.categoria)} · ${formatBRL(s.valor)} · venc ${formatData(s.data_vencimento || s.data_necessidade)}`,
    ).join("\n");

    const msg =
      `📊 *Resumo financeiro do dia* — ${formatData(hoje)}\n\n` +
      `🆕 Novas solicitações: *${novasHoje.length}* (${formatBRL(soma(novasHoje))})\n` +
      `💸 Pagas hoje: *${pagasHoje.length}* (${formatBRL(soma(pagasHoje))})\n` +
      `⏳ Aguardando liberação: *${pendentes.length}* (${formatBRL(soma(pendentes))})\n` +
      `✅ Liberadas a pagar: *${liberadas.length}* (${formatBRL(soma(liberadas))})\n` +
      (listaNovas ? `\n*Novas de hoje:*\n${listaNovas}` : "") +
      (novasHoje.length > 8 ? `\n…e mais ${novasHoje.length - 8}` : "");

    const r = await notificarSocios(supabase, msg);

    return new Response(
      JSON.stringify({
        success: true,
        novas: novasHoje.length, pagas: pagasHoje.length,
        pendentes: pendentes.length, liberadas: liberadas.length,
        ...r,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[cron-solicitacoes-resumo-diario] erro:", e);
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
