// Marca mensagens de ENTRADA como lidas no provedor (Evolution / Meta oficial)
// para que o cliente veja ✓✓ azul no aparelho dele.
// - Idempotente: pula message_ids que já têm lida_pelo_operador_em IS NOT NULL.
// - Best-effort: erros por mensagem são logados; nunca lança 500 quando alguma
//   mensagem específica falha (devolve { ok, marcadas, falharam[] }).
// - Auth: exige Bearer JWT válido (sessão do operador).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jidFromTelefone(telefone: string): string {
  const limpo = telefone.replace(/\D/g, "");
  const comDDI = limpo.startsWith("55") ? limpo : `55${limpo}`;
  return `${comDDI}@s.whatsapp.net`;
}

interface Body {
  instancia_id?: string;
  telefone: string;
  message_ids: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Valida o JWT
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: "invalid_jwt" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.telefone || !Array.isArray(body?.message_ids) || body.message_ids.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "telefone e message_ids são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const messageIds = body.message_ids.filter((x) => typeof x === "string" && x.length > 0);
    if (messageIds.length === 0) {
      return new Response(JSON.stringify({ success: true, marcadas: 0, falharam: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca as mensagens-alvo: só entrada, ainda não marcadas
    const { data: msgs, error: msgsErr } = await supabase
      .from("whatsapp_mensagens")
      .select("id, message_id, telefone, instancia_id, direcao, lida_pelo_operador_em, provedor")
      .in("message_id", messageIds)
      .eq("direcao", "entrada");

    if (msgsErr) {
      console.error("[whatsapp-mark-read] erro select:", msgsErr.message);
      return new Response(JSON.stringify({ success: false, error: msgsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pendentes = (msgs ?? []).filter((m) => !m.lida_pelo_operador_em);
    if (pendentes.length === 0) {
      return new Response(JSON.stringify({ success: true, marcadas: 0, falharam: [], skipped: messageIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Descobre instância (pelo body, senão pela primeira mensagem)
    const instanciaId = body.instancia_id || pendentes[0].instancia_id;
    let instancia: any = null;
    if (instanciaId) {
      const { data } = await supabase
        .from("whatsapp_instancias")
        .select("id, instance_name, api_url, provedor")
        .eq("id", instanciaId)
        .maybeSingle();
      instancia = data;
    }

    // Provedor preferido: instancia.provedor → senão Meta config ativa
    let provedor: "evolution" | "meta_oficial" = "evolution";
    if (instancia?.provedor === "meta") provedor = "meta_oficial";
    else if (!instancia) {
      const { data: meta } = await supabase
        .from("whatsapp_meta_config")
        .select("ativo")
        .maybeSingle();
      if (meta?.ativo) provedor = "meta_oficial";
    }

    const remoteJid = jidFromTelefone(body.telefone);
    const marcarLocal: string[] = [];
    const falharam: { message_id: string; reason: string }[] = [];

    if (provedor === "meta_oficial") {
      const { data: metaConfig } = await supabase
        .from("whatsapp_meta_config")
        .select("phone_number_id, access_token")
        .eq("ativo", true)
        .maybeSingle();

      const accessToken = metaConfig?.access_token || Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = metaConfig?.phone_number_id;

      if (!accessToken || !phoneNumberId) {
        console.warn("[whatsapp-mark-read] Meta config ausente — registrando local sem chamar API");
        for (const m of pendentes) marcarLocal.push(m.message_id);
      } else {
        // Meta exige o wamid puro (ex.: "wamid.HBg..."); IDs gravados com
        // prefixo "chatwoot_" precisam ser saneados antes da chamada.
        const sanitizeWamid = (id: string): string => {
          if (!id) return id;
          let s = id;
          if (s.startsWith("chatwoot_")) s = s.slice("chatwoot_".length);
          return s;
        };

        for (const m of pendentes) {
          const wamid = sanitizeWamid(m.message_id);
          if (!wamid.startsWith("wamid.")) {
            console.warn(`[whatsapp-mark-read] meta skip id inválido: ${m.message_id}`);
            falharam.push({ message_id: m.message_id, reason: "meta_invalid_wamid" });
            marcarLocal.push(m.message_id);
            continue;
          }
          try {
            const res = await fetch(
              `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  status: "read",
                  message_id: wamid,
                }),
              },
            );
            const raw = await res.text();
            if (!res.ok) {
              console.warn(`[whatsapp-mark-read] meta falhou ${m.message_id} (wamid=${wamid}): ${res.status} ${raw}`);
              falharam.push({ message_id: m.message_id, reason: `meta_${res.status}` });
              // Mesmo com falha externa, registramos local pra não re-tentar em loop.
              marcarLocal.push(m.message_id);
              continue;
            }
            marcarLocal.push(m.message_id);
          } catch (e: any) {
            console.error(`[whatsapp-mark-read] meta exception ${m.message_id}:`, e?.message);
            falharam.push({ message_id: m.message_id, reason: `meta_exception` });
            marcarLocal.push(m.message_id);
          }
        }
      }
    } else {
      // Evolution
      const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
      const rawApiUrl = Deno.env.get("EVOLUTION_API_URL") || instancia?.api_url;
      const apiUrl = rawApiUrl ? rawApiUrl.replace(/\/+$/, "") : null;
      const instanceName = instancia?.instance_name;

      if (!EVOLUTION_API_KEY || !apiUrl || !instanceName) {
        console.warn("[whatsapp-mark-read] Evolution config ausente — registrando local sem chamar API");
        for (const m of pendentes) marcarLocal.push(m.message_id);
      } else {
        // Evolution aceita batch — manda tudo em uma chamada
        try {
          const res = await fetch(`${apiUrl}/chat/markMessageAsRead/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
            body: JSON.stringify({
              readMessages: pendentes.map((m) => ({
                remoteJid,
                fromMe: false,
                id: m.message_id,
              })),
            }),
          });
          const raw = await res.text();
          if (!res.ok) {
            console.warn(`[whatsapp-mark-read] evolution falhou: ${res.status} ${raw}`);
            for (const m of pendentes) {
              falharam.push({ message_id: m.message_id, reason: `evolution_${res.status}` });
              marcarLocal.push(m.message_id);
            }
          } else {
            for (const m of pendentes) marcarLocal.push(m.message_id);
          }
        } catch (e: any) {
          console.error("[whatsapp-mark-read] evolution exception:", e?.message);
          for (const m of pendentes) {
            falharam.push({ message_id: m.message_id, reason: "evolution_exception" });
            marcarLocal.push(m.message_id);
          }
        }
      }
    }

    if (marcarLocal.length > 0) {
      const { error: upErr } = await supabase
        .from("whatsapp_mensagens")
        .update({ lida_pelo_operador_em: new Date().toISOString() })
        .in("message_id", marcarLocal)
        .eq("direcao", "entrada")
        .is("lida_pelo_operador_em", null);
      if (upErr) console.error("[whatsapp-mark-read] update fail:", upErr.message);
    }

    // Log resumido
    try {
      await supabase.from("whatsapp_logs").insert({
        instancia_id: instanciaId ?? null,
        tipo: "outgoing",
        evento: "mark_read",
        payload: { telefone: remoteJid, count: pendentes.length, provedor },
        resposta: { marcadas: marcarLocal.length, falharam },
      });
    } catch (_) { /* não-bloqueante */ }

    return new Response(
      JSON.stringify({
        success: true,
        marcadas: marcarLocal.length,
        falharam,
        skipped: messageIds.length - pendentes.length,
        provedor,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[whatsapp-mark-read] erro raiz:", e?.message);
    return new Response(JSON.stringify({ success: false, error: e?.message ?? "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
