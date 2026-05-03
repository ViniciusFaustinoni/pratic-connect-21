// @ts-nocheck
// Cron diário: percorre sinistros com cota pendente e dispara lembrete via WhatsApp a cada 3 dias.
// Marca como expirada após 60 dias da geração.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTERVALO_DIAS = 3;
const LIMITE_DIAS = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const agora = new Date();
  const resumo = { processados: 0, lembretes_enviados: 0, expirados: 0, erros: 0 };

  try {
    const { data: sinistros, error } = await supabase
      .from("sinistros")
      .select("id, protocolo, associado_id, valor_cota_participacao, cota_data_geracao, cota_lembrete_ultimo_em, cota_lembretes_enviados, associado:associados!sinistros_associado_id_fkey(nome, whatsapp, telefone)")
      .eq("aguardando_pagamento_cota", true)
      .eq("cota_paga", false)
      .eq("cota_expirada", false)
      .not("cota_data_geracao", "is", null);

    if (error) throw error;

    for (const s of sinistros || []) {
      resumo.processados++;
      try {
        const dataGeracao = new Date(s.cota_data_geracao as string);
        const diasDecorridos = Math.floor((agora.getTime() - dataGeracao.getTime()) / 86400000);

        // Expiração após 60 dias
        if (diasDecorridos >= LIMITE_DIAS) {
          await supabase
            .from("sinistros")
            .update({
              cota_expirada: true,
              cota_expirada_em: agora.toISOString(),
              aguardando_pagamento_cota: false,
              updated_at: agora.toISOString(),
            })
            .eq("id", s.id);

          await supabase.from("sinistro_historico").insert({
            sinistro_id: s.id,
            status_anterior: null,
            status_novo: null,
            observacao: `Coparticipação expirada — ${LIMITE_DIAS} dias sem pagamento.`,
          });

          // WhatsApp final de expiração
          const tel = (s as any).associado?.whatsapp || (s as any).associado?.telefone;
          const nome = ((s as any).associado?.nome || "Associado").split(" ")[0];
          if (tel) {
            await dispararWhats(supabase, tel, `Olá ${nome}, sua taxa de coparticipação do evento ${s.protocolo} expirou após ${LIMITE_DIAS} dias sem pagamento. Entre em contato com a central para reabertura.`, s.id, "coparticipacao_expirada");
          }
          resumo.expirados++;
          continue;
        }

        // Decidir se envia lembrete
        const ultimoEnvio = s.cota_lembrete_ultimo_em ? new Date(s.cota_lembrete_ultimo_em as string) : null;
        const diasDesdeUltimo = ultimoEnvio
          ? Math.floor((agora.getTime() - ultimoEnvio.getTime()) / 86400000)
          : Infinity;

        if (diasDesdeUltimo >= INTERVALO_DIAS) {
          const tel = (s as any).associado?.whatsapp || (s as any).associado?.telefone;
          const nome = ((s as any).associado?.nome || "Associado").split(" ")[0];
          if (tel) {
            const diasRestantes = LIMITE_DIAS - diasDecorridos;
            const valor = Number(s.valor_cota_participacao || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const msg = `Olá ${nome}! Lembrando que a taxa de coparticipação do evento ${s.protocolo} (${valor}) está aguardando pagamento. Restam ${diasRestantes} dias para confirmação. Acesse o link do evento para pagar.`;
            await dispararWhats(supabase, tel, msg, s.id, "coparticipacao_lembrete");

            await supabase
              .from("sinistros")
              .update({
                cota_lembrete_ultimo_em: agora.toISOString(),
                cota_lembretes_enviados: (s.cota_lembretes_enviados || 0) + 1,
                updated_at: agora.toISOString(),
              })
              .eq("id", s.id);
            resumo.lembretes_enviados++;
          }
        }
      } catch (e) {
        console.error("[cron-lembrete-coparticipacao] erro sinistro", s.id, e);
        resumo.erros++;
      }
    }
  } catch (e) {
    console.error("[cron-lembrete-coparticipacao] erro geral", e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, ...resumo }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function dispararWhats(supabase: any, telefone: string, mensagem: string, sinistroId: string, tipo: string) {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send-text`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        telefone,
        mensagem,
        referencia_tipo: "sinistro",
        referencia_id: sinistroId,
        tipo,
      }),
    });
  } catch (e) {
    console.error("[cron-lembrete-coparticipacao] whatsapp falhou", e);
  }
}
