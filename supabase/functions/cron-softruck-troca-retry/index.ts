/**
 * cron-softruck-troca-retry
 *
 * Drena a fila `sga_sync_queue` para etapas Softruck da troca de titularidade:
 *   - troca_titularidade:softruck_reaponte_usuario
 *   - troca_titularidade:softruck_recriar_vinculo
 *
 * Para cada item, resolve a solicitação correspondente (veiculo+novo associado)
 * e invoca efetivar-troca-titularidade no modo `retry_softruck`, que reusa o
 * helper canônico com fallback de vehicleId.
 *
 * O `cron-sga-retry` cuida das etapas Hinova; este aqui cuida só das Softruck
 * (que o cron-sga-retry não conhecia — gap documentado nos comentários da
 * edge `efetivar-troca-titularidade`).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE);

  console.log("[cron-softruck-troca-retry] iniciando");

  // Reabre travados em 'processando' há mais de 10min
  const staleAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabase
    .from("sga_sync_queue")
    .update({
      status: "pendente",
      proximo_reenvio_em: new Date().toISOString(),
      erro_ultimo: "Reaberto: processamento travado > 10min",
    })
    .eq("origem", "troca_titularidade")
    .eq("status", "processando")
    .lt("ultima_tentativa_em", staleAt)
    .like("etapa_parou", "troca_titularidade:softruck%");

  // Busca pendentes
  const { data: pendentes, error } = await supabase
    .from("sga_sync_queue")
    .select("id, veiculo_id, associado_id, tentativas, etapa_parou, erro_ultimo")
    .eq("origem", "troca_titularidade")
    .eq("status", "pendente")
    .lt("tentativas", 10)
    .like("etapa_parou", "troca_titularidade:softruck%")
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error("[cron-softruck-troca-retry] erro ao buscar fila:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pendentes || pendentes.length === 0) {
    console.log("[cron-softruck-troca-retry] nada a processar");
    return new Response(JSON.stringify({ success: true, processados: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let ok = 0;
  let fail = 0;

  for (const item of pendentes) {
    if (!item.veiculo_id || !item.associado_id) {
      await supabase
        .from("sga_sync_queue")
        .update({ status: "falha_permanente", erro_ultimo: "veiculo_id/associado_id ausente" })
        .eq("id", item.id);
      fail++;
      continue;
    }

    // Resolver solicitacao_id pela parelha (veiculo, novo titular)
    const { data: sol } = await supabase
      .from("solicitacoes_troca_titularidade")
      .select("id, status")
      .eq("veiculo_id", item.veiculo_id)
      .eq("novo_associado_id", item.associado_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sol) {
      await supabase
        .from("sga_sync_queue")
        .update({ status: "falha_permanente", erro_ultimo: "solicitacao_id não encontrado" })
        .eq("id", item.id);
      fail++;
      continue;
    }

    // Pré-check: se o estado na Softruck já é o correto, fecha sem chamar retry.
    try {
      const { data: rastr } = await supabase
        .from("rastreadores")
        .select("plataforma_veiculo_id, imei")
        .eq("veiculo_id", item.veiculo_id)
        .eq("status", "instalado")
        .maybeSingle();
      const { data: vRow } = await supabase
        .from("veiculos")
        .select("softruck_vehicle_id, placa")
        .eq("id", item.veiculo_id)
        .maybeSingle();
      const { data: assoc } = await supabase
        .from("associados")
        .select("cpf, email")
        .eq("id", item.associado_id)
        .maybeSingle();
      const vehicleId =
        (vRow as any)?.softruck_vehicle_id || (rastr as any)?.plataforma_veiculo_id || null;
      const cpf = ((assoc as any)?.cpf || "").replace(/\D/g, "");
      const email = (assoc as any)?.email || "";

      if (vehicleId && (cpf || email)) {
        const userResp = await supabase.functions.invoke("softruck-api", {
          body: { operation: "buscar-usuario", data: cpf ? { cpf } : { email } },
        });
        const userData = (userResp as any)?.data ?? userResp;
        const userArr = Array.isArray(userData?.data) ? userData.data : Array.isArray(userData) ? userData : [];
        const novoUserId = String(userArr[0]?.id || userArr[0]?.user?.id || "");

        if (novoUserId) {
          const listResp = await supabase.functions.invoke("softruck-api", {
            body: { operation: "listar-usuarios-veiculo", data: { vehicleId } },
          });
          const listData = (listResp as any)?.data ?? listResp;
          const items = Array.isArray(listData?.data) ? listData.data : Array.isArray(listData) ? listData : [];
          const userIds = items.map((it: any) => String(it?.user?.id ?? it?.attributes?.user_id ?? ""));
          const novoPresente = userIds.includes(novoUserId);
          const apenasNovo = userIds.length > 0 && userIds.every((u: string) => u === novoUserId);

          if (novoPresente && apenasNovo) {
            console.log(`[cron-softruck-troca-retry] item ${item.id}: estado Softruck já correto — fechando`);
            await supabase
              .from("sga_sync_queue")
              .update({
                status: "concluido",
                erro_ultimo: "[cron pré-check] estado Softruck já correto",
                ultima_tentativa_em: new Date().toISOString(),
              })
              .eq("id", item.id);
            ok++;
            continue;
          }
        }
      }
    } catch (preErr) {
      console.warn(`[cron-softruck-troca-retry] pré-check item ${item.id} falhou (segue para retry):`, (preErr as Error)?.message);
    }

    await supabase
      .from("sga_sync_queue")
      .update({ status: "processando", ultima_tentativa_em: new Date().toISOString() })
      .eq("id", item.id);

    try {
      const { data: resp, error: invokeErr } = await supabase.functions.invoke(
        "efetivar-troca-titularidade",
        { body: { solicitacao_id: sol.id, retry_softruck: true } },
      );

      if (invokeErr) throw invokeErr;

      if (resp?.success) {
        // efetivar-troca-titularidade já marcou as linhas como 'concluido'
        // — só garantia adicional aqui caso resp tenha vindo só da chamada atual.
        await supabase
          .from("sga_sync_queue")
          .update({ status: "concluido", erro_ultimo: null, ultima_tentativa_em: new Date().toISOString() })
          .eq("id", item.id);

        // Promoção canônica: passa pelo wrapper que SONDA Softruck antes
        // de marcar `plataforma_rastreador_status='sincronizado'`. Critério
        // estrito: novo presente E antigo ausente.
        try {
          await supabase.functions.invoke("troca-promover-com-sondagem", {
            body: { solicitacao_id: sol.id },
          });
        } catch (promErr) {
          console.warn(`[cron-softruck-troca-retry] promover troca ${sol.id} falhou:`, (promErr as Error)?.message);
        }
        ok++;
      } else {
        const tentativas = (item.tentativas ?? 0) + 1;
        const proximo = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const exauriu = tentativas >= 10;
        await supabase
          .from("sga_sync_queue")
          .update({
            status: exauriu ? "falha_permanente" : "pendente",
            tentativas,
            ultima_tentativa_em: new Date().toISOString(),
            proximo_reenvio_em: proximo,
            erro_ultimo: resp?.msg || resp?.error || "retry retornou success=false",
          })
          .eq("id", item.id);
        // Marca a ponta plataforma como falha_permanente para a UI sinalizar
        // ao operador que precisa de ação manual (regra das 3 pontas).
        if (exauriu) {
          try {
            await supabase
              .from("solicitacoes_troca_titularidade")
              .update({
                plataforma_rastreador_status: "falha_permanente",
                plataforma_rastreador_erro: resp?.msg || resp?.error || "retries esgotados",
              })
              .eq("id", sol.id);
          } catch (_e) { /* não-bloqueante */ }
        }
        fail++;
      }
    } catch (e) {
      const tentativas = (item.tentativas ?? 0) + 1;
      const proximo = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase
        .from("sga_sync_queue")
        .update({
          status: tentativas >= 10 ? "falha_permanente" : "pendente",
          tentativas,
          ultima_tentativa_em: new Date().toISOString(),
          proximo_reenvio_em: proximo,
          erro_ultimo: (e as Error)?.message ?? String(e),
        })
        .eq("id", item.id);
      fail++;
    }
  }

  console.log(`[cron-softruck-troca-retry] concluído: ok=${ok} fail=${fail}`);

  return new Response(
    JSON.stringify({ success: true, processados: pendentes.length, ok, fail }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
