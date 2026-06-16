import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient, notificarSocios, formatBRL } from "../_shared/solicitacoes-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { distribuicao_id } = await req.json();
    if (!distribuicao_id) return json({ success: false, error: "distribuicao_id obrigatório" }, 400);

    const supabase = getServiceClient();
    const { data: d, error } = await supabase
      .from("distribuicoes_lucro").select("*").eq("id", distribuicao_id).single();
    if (error || !d) return json({ success: false, error: "Distribuição não encontrada" }, 404);

    const temIR = Number(d.aliquota_ir || 0) > 0;
    const irPorSocio = Number(d.valor_por_socio) * (Number(d.aliquota_ir) / 100);
    const liquido = Number(d.valor_por_socio) - irPorSocio;

    const msg =
      `📊 *Custos e receitas — ${MESES[d.mes]}.${d.ano}*\n\n` +
      `Receita - ${formatBRL(d.receita_total)}\n` +
      `Despesa - ${formatBRL(d.despesa_total)}\n\n` +
      `*LUCRO - ${formatBRL(d.lucro)}*\n` +
      `${Number(d.percentual_caixa)}% Caixa ${formatBRL(d.valor_caixa)}\n` +
      `*DL sócios ${formatBRL(d.valor_por_socio)}*` +
      (temIR ? ` (líquido de IR: ${formatBRL(liquido)})` : "") + `\n\n` +
      `${formatBRL(d.dl_minimo)} DL mínimo mensal\n` +
      `${formatBRL(d.pro_labore)} Pró-labore\n\n` +
      `_A diferença do valor total é paga todo dia 20._`;

    const r = await notificarSocios(supabase, msg);
    return json({ success: true, ...r });
  } catch (e: any) {
    console.error("[notificar-distribuicao-lucro] erro:", e);
    return json({ success: false, error: e?.message || String(e) }, 500);
  }

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
