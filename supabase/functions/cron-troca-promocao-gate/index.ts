/**
 * cron-troca-promocao-gate
 *
 * Rede de segurança: a cada execução, varre solicitações
 * `solicitacoes_troca_titularidade.status='efetivacao_pendente'` que estão
 * paradas há mais de 2 minutos e invoca `troca-promover-com-sondagem` para
 * cada uma. Cobre cenários em que o callback do retry caiu / não foi
 * invocado e a troca ficaria travada em "efetivação pendente" para sempre.
 *
 * Não substitui os crons reativos (cron-softruck-troca-retry, cron-sga-retry)
 * — apenas garante que o gate é avaliado periodicamente com sondagem real.
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: pendentes, error } = await supabase
    .from("solicitacoes_troca_titularidade")
    .select("id, updated_at")
    .eq("status", "efetivacao_pendente")
    .lte("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(25);

  if (error) {
    console.error("[cron-troca-promocao-gate] erro busca:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!pendentes || pendentes.length === 0) {
    return new Response(JSON.stringify({ success: true, processados: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let promovidas = 0;
  let aindaPendentes = 0;
  let falhas = 0;

  for (const sol of pendentes) {
    try {
      const { data } = await supabase.functions.invoke(
        "troca-promover-com-sondagem",
        { body: { solicitacao_id: sol.id } },
      );
      if ((data as any)?.gate?.promovida === true) {
        promovidas++;
      } else {
        aindaPendentes++;
      }
    } catch (e) {
      console.warn(
        `[cron-troca-promocao-gate] sol=${sol.id} falhou:`,
        (e as Error)?.message,
      );
      falhas++;
    }
  }

  console.log(
    `[cron-troca-promocao-gate] processados=${pendentes.length} promovidas=${promovidas} pendentes=${aindaPendentes} falhas=${falhas}`,
  );

  return new Response(
    JSON.stringify({
      success: true,
      processados: pendentes.length,
      promovidas,
      pendentes: aindaPendentes,
      falhas,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
