import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Roda de hora em hora. Marca como 'liberada' toda cotação rascunho/enviada
 * cuja reserva da placa expirou. Marca como 'expirada' toda cotação morta há
 * mais de N dias (prazo_arquivar_cotacao_morta_dias).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const agora = new Date().toISOString();

  // 1) Liberar placas expiradas
  const { data: expiradas, error: errSel } = await admin
    .from("cotacoes")
    .select("id, veiculo_placa, vendedor_id")
    .in("status", ["rascunho", "enviada"])
    .lt("placa_reservada_ate", agora)
    .limit(500);

  let liberadas = 0;
  if (!errSel && expiradas?.length) {
    const ids = expiradas.map((c) => c.id);
    const { error: errUpd } = await admin
      .from("cotacoes")
      .update({
        status: "liberada",
        motivo_cancelamento: "[auto] Reserva da placa expirou",
        categoria_cancelamento: "placa_liberada_automaticamente",
      })
      .in("id", ids);
    if (!errUpd) liberadas = ids.length;
  }

  // 2) Arquivar cotações mortas há > N dias
  const { data: prazoCfg } = await admin
    .from("configuracoes")
    .select("valor")
    .eq("chave", "prazo_arquivar_cotacao_morta_dias")
    .maybeSingle();
  const prazoDias = Number(prazoCfg?.valor ?? 30) || 30;
  const limite = new Date(Date.now() - prazoDias * 24 * 60 * 60 * 1000).toISOString();

  const { data: mortas } = await admin
    .from("cotacoes")
    .select("id")
    .in("status", ["rascunho", "enviada", "liberada"])
    .lt("updated_at", limite)
    .limit(500);

  let arquivadas = 0;
  if (mortas?.length) {
    const ids = mortas.map((c) => c.id);
    const { error: errExp } = await admin
      .from("cotacoes")
      .update({
        status: "expirada",
        motivo_cancelamento: `[auto] Sem movimento por mais de ${prazoDias} dias`,
        categoria_cancelamento: "cotacao_inativa",
      })
      .in("id", ids);
    if (!errExp) arquivadas = ids.length;
  }

  return new Response(
    JSON.stringify({ ok: true, liberadas, arquivadas, ts: agora }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
