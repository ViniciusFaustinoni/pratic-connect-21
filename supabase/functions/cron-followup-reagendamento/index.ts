import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Intervals in hours for each follow-up
const FOLLOWUP_INTERVALS = [1, 2, 3];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find services needing follow-up:
    // - reagendamento link was sent
    // - status is still nao_compareceu or imprevisto_pendente
    // - followup count < 3
    // - not yet reagendado (data_agendada hasn't been updated after imprevisto)
    const { data: servicos, error: queryErr } = await supabase
      .from("servicos")
      .select("id, reagendamento_enviado_em, reagendamento_followup_count, reagendamento_token, associado_id, tipo")
      .not("reagendamento_enviado_em", "is", null)
      .in("status", ["nao_compareceu", "imprevisto_pendente"])
      .lt("reagendamento_followup_count", 3);

    if (queryErr) {
      console.error("[cron-followup-reagendamento] Query error:", queryErr);
      throw queryErr;
    }

    if (!servicos || servicos.length === 0) {
      console.log("[cron-followup-reagendamento] Nenhum serviço pendente de follow-up");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    let processed = 0;

    for (const servico of servicos) {
      const enviado = new Date(servico.reagendamento_enviado_em).getTime();
      const count = servico.reagendamento_followup_count || 0;
      const requiredInterval = FOLLOWUP_INTERVALS[count]; // 1h, 2h, or 3h
      const hoursElapsed = (now - enviado) / (1000 * 60 * 60);

      if (hoursElapsed < requiredInterval) continue;

      console.log(`[cron-followup-reagendamento] Enviando follow-up #${count + 1} para servico ${servico.id}`);

      // Get associado info
      const { data: associado } = await supabase
        .from("associados")
        .select("nome, telefone, whatsapp")
        .eq("id", servico.associado_id)
        .single();

      if (!associado) {
        console.warn(`[cron-followup-reagendamento] Associado não encontrado para servico ${servico.id}`);
        continue;
      }

      const telefone = (associado.whatsapp || associado.telefone || "").replace(/\D/g, "");
      if (!telefone) {
        console.warn(`[cron-followup-reagendamento] Sem telefone para servico ${servico.id}`);
        continue;
      }

      const appUrl = Deno.env.get("APP_URL") || "https://pratic-connect-21.lovable.app";
      const linkReagendamento = `${appUrl}/reagendar/${servico.reagendamento_token}`;
      const primeiroNome = associado.nome?.split(" ")[0] || "Associado";

      const TIPO_LABELS: Record<string, string> = {
        vistoria_entrada: "vistoria",
        vistoria_saida: "vistoria",
        vistoria_sinistro: "vistoria",
        vistoria_periodica: "vistoria",
        instalacao: "instalação do rastreador",
        vistoria_manutencao: "manutenção do rastreador",
        vistoria_retirada: "retirada do rastreador",
      };
      const tipoLabel = TIPO_LABELS[servico.tipo] || "serviço";

      const mensagem = `Olá ${primeiroNome}, notamos que você ainda não reagendou seu(sua) ${tipoLabel}. ` +
        `Acesse o link abaixo para escolher um novo dia e horário:\n\n` +
        `${linkReagendamento}\n\n` +
        `Equipe PRATIC 🚗`;

      // Send via whatsapp-send-text using same Meta template
      const { error: sendErr } = await supabase.functions.invoke("whatsapp-send-text", {
        body: {
          telefone: telefone.startsWith("55") ? telefone : `55${telefone}`,
          mensagem,
          template_name: "reagendamento_servico",
          template_params: [primeiroNome, tipoLabel],
          template_button_params: [servico.reagendamento_token],
          referencia_tipo: "followup_reagendamento",
          referencia_id: servico.id,
        },
      });

      if (sendErr) {
        console.warn(`[cron-followup-reagendamento] Erro ao enviar WhatsApp para servico ${servico.id}:`, sendErr);
        continue;
      }

      // Update counter
      const { error: updateErr } = await supabase
        .from("servicos")
        .update({
          reagendamento_followup_count: count + 1,
          reagendamento_ultimo_followup_em: new Date().toISOString(),
        })
        .eq("id", servico.id);

      if (updateErr) {
        console.error(`[cron-followup-reagendamento] Erro ao atualizar contador servico ${servico.id}:`, updateErr);
      } else {
        processed++;
        console.log(`[cron-followup-reagendamento] Follow-up #${count + 1} enviado para servico ${servico.id}`);
      }
    }

    console.log(`[cron-followup-reagendamento] Processados: ${processed}/${servicos.length}`);
    return new Response(JSON.stringify({ processed, total: servicos.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[cron-followup-reagendamento] Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
