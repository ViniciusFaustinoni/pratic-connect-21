import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar todos os prazos pendentes
    const { data: prazos, error } = await supabase
      .from("processos_prazos")
      .select("id, descricao, data_fim, responsavel_id, processo_id, alerta_enviado_7d, alerta_enviado_3d, alerta_enviado_1d, alerta_enviado_hoje, lembrete_ativo")
      .in("status", ["pendente", "em_andamento"]);

    if (error) throw error;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let notificacoes = 0;

    for (const prazo of prazos || []) {
      const dataFim = new Date(prazo.data_fim);
      dataFim.setHours(0, 0, 0, 0);
      const diffMs = dataFim.getTime() - hoje.getTime();
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Buscar destinatários
      const destinatarios: string[] = [];
      if (prazo.responsavel_id) destinatarios.push(prazo.responsavel_id);

      // Buscar diretores/admins para alertas críticos
      let incluirAdmins = false;
      let incluirDiretor = false;

      if (diasRestantes <= 3) incluirDiretor = true;
      if (diasRestantes <= 1) incluirAdmins = true;

      if (incluirDiretor || incluirAdmins) {
        const roles = incluirAdmins ? ["diretor", "admin"] : ["diretor"];
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .in("role", roles);
        if (admins) {
          admins.forEach((a) => {
            if (!destinatarios.includes(a.id)) destinatarios.push(a.id);
          });
        }
      }

      if (destinatarios.length === 0) continue;

      const updates: Record<string, boolean> = {};
      let shouldNotify = false;
      let titulo = "";
      let mensagem = `Prazo: ${prazo.descricao}`;
      let tipo = "info";

      if (diasRestantes === 7 && !prazo.alerta_enviado_7d) {
        updates.alerta_enviado_7d = true;
        shouldNotify = true;
        titulo = "⏰ Prazo vence em 7 dias";
      } else if (diasRestantes === 3 && !prazo.alerta_enviado_3d) {
        updates.alerta_enviado_3d = true;
        shouldNotify = true;
        titulo = "⚠️ Prazo vence em 3 dias";
        tipo = "warning";
      } else if (diasRestantes === 1 && !prazo.alerta_enviado_1d) {
        updates.alerta_enviado_1d = true;
        shouldNotify = true;
        titulo = "🔴 Prazo vence AMANHÃ";
        tipo = "urgente";
      } else if (diasRestantes === 0 && !prazo.alerta_enviado_hoje) {
        updates.alerta_enviado_hoje = true;
        shouldNotify = true;
        titulo = "🚨 PRAZO VENCE HOJE";
        tipo = "urgente";
      } else if (diasRestantes < 0) {
        // Vencido — notificar diariamente
        shouldNotify = true;
        titulo = `🚨 PRAZO VENCIDO HÁ ${Math.abs(diasRestantes)} DIAS`;
        tipo = "urgente";
      }

      if (shouldNotify) {
        // Criar notificação no sistema para cada destinatário
        for (const userId of destinatarios) {
          await supabase.from("notificacoes").insert({
            user_id: userId,
            titulo,
            mensagem,
            tipo,
            lida: false,
            link: prazo.processo_id ? `/juridico/processos/${prazo.processo_id}` : "/juridico/prazos",
          });
        }

        // Atualizar flags
        if (Object.keys(updates).length > 0) {
          await supabase
            .from("processos_prazos")
            .update(updates)
            .eq("id", prazo.id);
        }

        notificacoes++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, prazos_verificados: prazos?.length || 0, notificacoes_enviadas: notificacoes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro ao verificar prazos:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
