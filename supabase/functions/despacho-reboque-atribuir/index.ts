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
    const { despacho_id } = await req.json();
    if (!despacho_id) throw new Error("despacho_id é obrigatório");

    console.log(`[despacho-atribuir] Iniciando atribuição para despacho ${despacho_id}`);

    // Buscar despacho
    const { data: despacho, error: despErr } = await supabase
      .from("despacho_reboque")
      .select("*")
      .eq("id", despacho_id)
      .single();

    if (despErr || !despacho) throw new Error("Despacho não encontrado");

    // Se já foi atribuído/cancelado, ignorar
    if (despacho.status !== "aguardando") {
      console.log(`[despacho-atribuir] Despacho já processado (status: ${despacho.status})`);
      return new Response(
        JSON.stringify({ success: true, status: despacho.status, message: "Despacho já processado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar aceites ordenados por valor (menor primeiro), desempate por data_aceite
    const { data: todosAceites } = await supabase
      .from("despacho_reboque_convites")
      .select(`
        *,
        prestador:prestadores_assistencia(id, razao_social, nome_fantasia, telefone, whatsapp)
      `)
      .eq("despacho_id", despacho_id)
      .eq("status", "aceito")
      .order("valor_calculado", { ascending: true })
      .order("data_aceite", { ascending: true });

    // Filtrar aceites que respeitam o valor_sugerido do prestador
    const aceites = (todosAceites || []).filter((a) => {
      // Se não tem valor_sugerido configurado, aceitar qualquer valor
      if (!a.valor_sugerido && a.valor_sugerido !== 0) return true;
      // Se valor_calculado <= valor_sugerido, aceitar
      return (a.valor_calculado || 0) <= a.valor_sugerido;
    });

    const aceitesRejeitados = (todosAceites || []).length - aceites.length;
    if (aceitesRejeitados > 0) {
      console.log(`[despacho-atribuir] ${aceitesRejeitados} aceites rejeitados por ultrapassar valor_sugerido`);
    }

    if (!aceites || aceites.length === 0) {
      // Ninguém aceitou (ou todos ultrapassam valor_sugerido)
      const motivo = (todosAceites || []).length > 0
        ? `Nenhum aceite dentro do valor sugerido (${todosAceites!.length} aceites recebidos, todos acima do valor configurado).`
        : `Nenhum reboquista aceitou o chamado em 10 minutos (ciclo ${despacho.ciclo}).`;
      console.log(`[despacho-atribuir] ${motivo}`);

      await supabase
        .from("despacho_reboque")
        .update({ status: "expirado" })
        .eq("id", despacho_id);

      // Registrar no histórico do chamado
      await supabase.from("chamados_assistencia_historico").insert({
        chamado_id: despacho.chamado_id,
        status_anterior: "aguardando_aceites",
        status_novo: "aguardando_aceites",
        observacao: `⚠️ ${motivo} Intervenção manual necessária.`,
      });

      // Marcar convites sem resposta como expirados
      await supabase
        .from("despacho_reboque_convites")
        .update({ status: "expirado" })
        .eq("despacho_id", despacho_id)
        .eq("status", "enviado");

      await supabase
        .from("despacho_reboque_convites")
        .update({ status: "expirado" })
        .eq("despacho_id", despacho_id)
        .eq("status", "visualizado");

      return new Response(
        JSON.stringify({ success: true, status: "expirado", aceites: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atribuir ao mais barato (primeiro da lista já ordenada)
    const vencedor = aceites[0];
    const prestador = vencedor.prestador as any;

    console.log(`[despacho-atribuir] Atribuindo a ${prestador?.razao_social || prestador?.nome_fantasia} — R$${vencedor.valor_calculado} — ${vencedor.distancia_km}km`);

    // Atualizar despacho
    await supabase
      .from("despacho_reboque")
      .update({
        status: "atribuido",
        prestador_atribuido_id: vencedor.prestador_id,
        valor_atribuido: vencedor.valor_calculado,
        distancia_atribuida_km: vencedor.distancia_km,
      })
      .eq("id", despacho_id);

    // Marcar demais aceites como não atribuídos
    for (const aceite of aceites.slice(1)) {
      await supabase
        .from("despacho_reboque_convites")
        .update({ status: "nao_atribuido" })
        .eq("id", aceite.id);
    }

    // Marcar convites sem resposta como expirados
    await supabase
      .from("despacho_reboque_convites")
      .update({ status: "expirado" })
      .eq("despacho_id", despacho_id)
      .in("status", ["enviado", "visualizado"]);

    const prestadorNome = prestador?.razao_social || prestador?.nome_fantasia || null;
    const prestadorTelefone = prestador?.whatsapp || prestador?.telefone || null;

    // Atualizar chamado
    await supabase
      .from("chamados_assistencia")
      .update({
        status: "prestador_a_caminho",
        prestador_id: vencedor.prestador_id,
        prestador_nome: prestadorNome,
        prestador_telefone: prestadorTelefone,
      })
      .eq("id", despacho.chamado_id);

    // Criar atendimento
    await supabase.from("chamados_assistencia_atendimentos").insert({
      chamado_id: despacho.chamado_id,
      prestador_id: vencedor.prestador_id,
      status: "aceito",
      hora_acionamento: despacho.hora_disparo,
      hora_aceite: vencedor.data_aceite,
      valor_servico: vencedor.valor_calculado,
      km_origem_destino: vencedor.distancia_km,
    });

    // Registrar status inicial
    await supabase.from("despacho_reboque_status_log").insert({
      chamado_id: despacho.chamado_id,
      prestador_id: vencedor.prestador_id,
      status: "a_caminho",
      latitude: vencedor.latitude_prestador,
      longitude: vencedor.longitude_prestador,
    });

    // Histórico do chamado
    const maiorValor = aceites[aceites.length - 1].valor_calculado;
    await supabase.from("chamados_assistencia_historico").insert({
      chamado_id: despacho.chamado_id,
      status_anterior: "aguardando_aceites",
      status_novo: "prestador_a_caminho",
      observacao: `Reboque atribuído automaticamente a ${prestadorNome} — R$ ${vencedor.valor_calculado} — ${vencedor.distancia_km} km (${aceites.length} aceites recebidos, atribuído ao menor valor${aceites.length > 1 ? ` de R$ ${maiorValor} mais caro` : ""})`,
    });

    // === GERAR TOKEN DE ACOMPANHAMENTO PARA O ASSOCIADO ===
    try {
      // Buscar associado do chamado
      const { data: chamado } = await supabase
        .from("chamados_assistencia")
        .select("id, associado_id, associado:associados(id, nome, whatsapp, telefone), veiculo:veiculos(marca, modelo, placa)")
        .eq("id", despacho.chamado_id)
        .single();

      if (chamado?.associado_id) {
        const acompToken = crypto.randomUUID();
        const expiraEm = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h

        await supabase.from("acompanhamento_reboque_tokens").insert({
          chamado_id: despacho.chamado_id,
          associado_id: chamado.associado_id,
          token: acompToken,
          expira_em: expiraEm,
        });

        // Enviar WhatsApp ao associado
        const associado = chamado.associado as any;
        const veiculo = chamado.veiculo as any;
        const telefoneAssociado = associado?.whatsapp || associado?.telefone;

        if (telefoneAssociado) {
          const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || `https://iyxdgmukrrdkffraptsx.supabase.co`;
          // Use the app domain for the link
          const linkAcompanhamento = `https://pratic-connect-21.lovable.app/acompanhar/reboque/${acompToken}`;

          const distanciaKm = vencedor.distancia_km ? `${vencedor.distancia_km} km` : "calculando";
          const tempoEstimado = vencedor.distancia_km
            ? `~${Math.round(vencedor.distancia_km * 3)} min`
            : "calculando";

          const mensagem = `🚛 *Reboque a caminho — Pratic Car*

Seu reboque foi acionado e está a caminho!

🔧 Prestador: ${prestadorNome}
📍 Distância: ${distanciaKm}
⏰ Estimativa: ${tempoEstimado}

👉 Acompanhe em tempo real:
${linkAcompanhamento}

📞 Ligar para o reboquista: ${prestadorTelefone || ""}

Este link é válido por 2 horas.`;

          await supabase.functions.invoke("whatsapp-send-text", {
            body: {
              telefone: telefoneAssociado.replace(/\D/g, ""),
              mensagem,
              template_name: "reboque_a_caminho",
              template_params: [prestadorNome, distanciaKm, tempoEstimado, linkAcompanhamento, prestadorTelefone || ""],
            },
          });

          console.log(`[despacho-atribuir] WhatsApp de acompanhamento enviado ao associado ${associado?.nome}`);
        }

        // === ENVIAR DADOS DO ASSOCIADO AO PRESTADOR ===
        if (prestadorTelefone) {
          const nomeAssociado = associado?.nome || "Associado";
          const telAssociado = associado?.whatsapp || associado?.telefone || "Não informado";

          // Buscar endereço de origem do chamado
          const { data: chamadoOrigem } = await supabase
            .from("chamados_assistencia")
            .select("origem_endereco, origem_logradouro, origem_cidade, origem_uf, destino_endereco, destino_logradouro, destino_cidade, destino_uf")
            .eq("id", despacho.chamado_id)
            .single();

          const endOrigem = chamadoOrigem?.origem_logradouro || chamadoOrigem?.origem_endereco || "A informar";
          const endDestino = chamadoOrigem?.destino_logradouro || chamadoOrigem?.destino_endereco || "A definir";

          const msgPrestador = `✅ *CHAMADO ATRIBUÍDO A VOCÊ*

👤 Associado: ${nomeAssociado}
📞 Telefone: ${telAssociado}

📍 Origem: ${endOrigem}
📍 Destino: ${endDestino}

🚗 Veículo: ${veiculo ? `${veiculo.marca || ""} ${veiculo.modelo || ""} — ${veiculo.placa || ""}`.trim() : "N/D"}

Por favor, dirija-se ao local e entre em contato com o associado.`;

          await supabase.functions.invoke("whatsapp-send-text", {
            body: {
              telefone: prestadorTelefone.replace(/\D/g, ""),
              mensagem: msgPrestador,
            },
          });

          console.log(`[despacho-atribuir] WhatsApp com dados do associado enviado ao prestador ${prestadorNome}`);
        }
      }
    } catch (whatsErr: any) {
      console.error("[despacho-atribuir] Erro ao enviar WhatsApp:", whatsErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "atribuido",
        prestador_id: vencedor.prestador_id,
        prestador_nome: prestadorNome,
        valor: vencedor.valor_calculado,
        distancia_km: vencedor.distancia_km,
        total_aceites: aceites.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[despacho-atribuir] Erro:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
