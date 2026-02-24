import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Validar JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Token de autenticação ausente");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Não autenticado");

    const { chamado_id } = await req.json();
    if (!chamado_id) throw new Error("chamado_id é obrigatório");

    console.log(`[despacho-disparar] Iniciando despacho para chamado ${chamado_id}`);

    // Buscar chamado com veículo
    const { data: chamado, error: chamadoErr } = await supabase
      .from("chamados_assistencia")
      .select(`
        id, protocolo, tipo_servico, status,
        origem_lat, origem_lng, origem_endereco, origem_logradouro, origem_cidade, origem_uf,
        rastreador_lat, rastreador_lng,
        veiculo_id,
        veiculo:veiculos(id, placa, marca, modelo, ano_modelo, cor),
        associado:associados(id, nome, telefone)
      `)
      .eq("id", chamado_id)
      .single();

    if (chamadoErr || !chamado) throw new Error("Chamado não encontrado");

    // Determinar localização do veículo
    const veiculoLat = chamado.rastreador_lat || chamado.origem_lat;
    const veiculoLng = chamado.rastreador_lng || chamado.origem_lng;

    if (!veiculoLat || !veiculoLng) {
      throw new Error("Localização do veículo indisponível. Informe o endereço manualmente.");
    }

    // Buscar endereço do veículo via reverse geocode
    let enderecoVeiculo = chamado.origem_logradouro || chamado.origem_endereco || "";
    if (!enderecoVeiculo) {
      try {
        const geoRes = await fetch(`${supabaseUrl}/functions/v1/reverse-geocode`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ latitude: veiculoLat, longitude: veiculoLng }),
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.success) enderecoVeiculo = geoData.endereco_completo || "";
        }
      } catch (_) { /* continue sem endereço */ }
    }

    // Verificar se já existe despacho ativo
    const { data: despachoExistente } = await supabase
      .from("despacho_reboque")
      .select("id, ciclo")
      .eq("chamado_id", chamado_id)
      .eq("status", "aguardando")
      .maybeSingle();

    if (despachoExistente) {
      throw new Error("Já existe um despacho ativo para este chamado. Aguarde o término ou cancele.");
    }

    // Calcular próximo ciclo
    const { data: ultimoDespacho } = await supabase
      .from("despacho_reboque")
      .select("ciclo")
      .eq("chamado_id", chamado_id)
      .order("ciclo", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ciclo = (ultimoDespacho?.ciclo || 0) + 1;

    // Buscar prestadores de reboque ativos
    const { data: prestadores, error: prestErr } = await supabase
      .from("prestadores_assistencia")
      .select("id, razao_social, nome_fantasia, whatsapp, telefone, tipos_servico, tipos_reboque, disponivel")
      .eq("status", "ativo")
      .eq("disponivel", true);

    if (prestErr) throw new Error("Erro ao buscar prestadores");

    // Filtrar reboquistas com whatsapp e que atendem reboque
    const reboquistas = (prestadores || []).filter((p) => {
      const hasWhatsapp = p.whatsapp || p.telefone;
      const atendeReboque = p.tipos_servico?.some((t: string) =>
        ["reboque", "guincho"].includes(t.toLowerCase())
      );
      return hasWhatsapp && atendeReboque;
    });

    if (reboquistas.length === 0) {
      throw new Error("Nenhum reboquista ativo e disponível encontrado. Verifique o cadastro de prestadores.");
    }

    // Verificar quais reboquistas já têm chamado ativo
    const prestadorIds = reboquistas.map((r) => r.id);
    const { data: chamadosAtivos } = await supabase
      .from("chamados_assistencia")
      .select("prestador_id")
      .in("prestador_id", prestadorIds)
      .in("status", ["prestador_a_caminho", "em_atendimento", "prestador_despachado"]);

    const idsOcupados = new Set((chamadosAtivos || []).map((c) => c.prestador_id));
    const reboquistasDisponiveis = reboquistas.filter((r) => !idsOcupados.has(r.id));

    if (reboquistasDisponiveis.length === 0) {
      throw new Error("Todos os reboquistas estão ocupados com outros chamados.");
    }

    // Buscar valores de cada prestador
    const { data: valores } = await supabase
      .from("prestadores_assistencia_valores")
      .select("prestador_id, valor_saida, valor_km, tipo_servico")
      .in("prestador_id", reboquistasDisponiveis.map((r) => r.id))
      .eq("ativo", true);

    const valoresMap = new Map<string, { valor_saida: number; valor_km: number }>();
    for (const v of valores || []) {
      if (v.tipo_servico === "reboque" || v.tipo_servico === "guincho" || !valoresMap.has(v.prestador_id)) {
        valoresMap.set(v.prestador_id, { valor_saida: v.valor_saida || 0, valor_km: v.valor_km || 0 });
      }
    }

    const now = new Date();
    const horaLimite = new Date(now.getTime() + 10 * 60 * 1000);

    // Criar despacho
    const { data: despacho, error: despErr } = await supabase
      .from("despacho_reboque")
      .insert({
        chamado_id,
        hora_disparo: now.toISOString(),
        hora_limite: horaLimite.toISOString(),
        total_enviados: reboquistasDisponiveis.length,
        ciclo,
      })
      .select()
      .single();

    if (despErr || !despacho) throw new Error("Erro ao criar despacho: " + despErr?.message);

    // Gerar URL base para links públicos
    // Usar o domínio publicado ou preview
    const appUrl = Deno.env.get("APP_PUBLIC_URL") || "https://pratic-connect-21.lovable.app";

    // Criar convites para cada reboquista
    const convites = reboquistasDisponiveis.map((prest) => {
      const vals = valoresMap.get(prest.id) || { valor_saida: 0, valor_km: 0 };
      return {
        despacho_id: despacho.id,
        prestador_id: prest.id,
        token_expira_em: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        valor_saida: vals.valor_saida,
        valor_km: vals.valor_km,
      };
    });

    const { data: convitesCriados, error: convErr } = await supabase
      .from("despacho_reboque_convites")
      .insert(convites)
      .select("id, token, prestador_id");

    if (convErr) throw new Error("Erro ao criar convites: " + convErr.message);

    // Atualizar status do chamado
    await supabase
      .from("chamados_assistencia")
      .update({ status: "aguardando_aceites" })
      .eq("id", chamado_id);

    // Registrar no histórico
    await supabase.from("chamados_assistencia_historico").insert({
      chamado_id,
      status_anterior: chamado.status,
      status_novo: "aguardando_aceites",
      usuario_id: user.id,
      observacao: `Despacho automático iniciado (ciclo ${ciclo}). ${reboquistasDisponiveis.length} reboquistas notificados. Timer: 10 minutos.`,
    });

    // Enviar WhatsApp para cada reboquista
    const veiculo = chamado.veiculo as any;
    const veiculoDesc = veiculo ? `${veiculo.marca || ""} ${veiculo.modelo || ""} ${veiculo.ano_modelo || ""}`.trim() : "Veículo";
    const placaDisplay = veiculo?.placa || "N/D";

    let enviados = 0;
    let falhas = 0;

    for (const conv of convitesCriados || []) {
      const prest = reboquistasDisponiveis.find((r) => r.id === conv.prestador_id);
      if (!prest) continue;

      const telefone = prest.whatsapp || prest.telefone;
      if (!telefone) continue;

      const link = `${appUrl}/assistencia/chamado/${conv.token}`;

      const mensagem = `🚛 *NOVO CHAMADO DE REBOQUE — PraticCar*

📍 Veículo: ${veiculoDesc} — ${placaDisplay}
📍 Local: ${enderecoVeiculo || "Ver no link"}
🕐 Aberto: ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}

👉 Toque para ver detalhes e aceitar:
${link}

⏰ Você tem 10 minutos para responder.`;

      try {
        const dataHora = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            telefone,
            mensagem,
            template_name: "despacho_reboque_novo",
            template_params: [veiculoDesc, placaDisplay, enderecoVeiculo || "Ver no link", dataHora, link],
          }),
        });

        const sendResult = await sendRes.json();
        if (sendResult.success) {
          await supabase
            .from("despacho_reboque_convites")
            .update({ whatsapp_enviado: true })
            .eq("id", conv.id);
          enviados++;
        } else {
          falhas++;
          console.error(`[despacho-disparar] Falha WhatsApp para ${prest.razao_social}: ${sendResult.error}`);
        }
      } catch (e) {
        falhas++;
        console.error(`[despacho-disparar] Erro envio WhatsApp:`, e);
      }

      // Delay entre envios (anti-bloqueio)
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`[despacho-disparar] Despacho ${despacho.id} criado. Enviados: ${enviados}, Falhas: ${falhas}`);

    return new Response(
      JSON.stringify({
        success: true,
        despacho_id: despacho.id,
        total_enviados: reboquistasDisponiveis.length,
        whatsapp_enviados: enviados,
        whatsapp_falhas: falhas,
        hora_limite: horaLimite.toISOString(),
        ciclo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[despacho-disparar] Erro:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
