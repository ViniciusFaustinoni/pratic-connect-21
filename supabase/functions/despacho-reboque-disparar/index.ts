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
    // Validar JWT — aceitar service role key para chamadas internas
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Token de autenticação ausente");

    const token = authHeader.replace("Bearer ", "");
    const isServiceCall = token === serviceKey;

    let userId: string | null = null;
    if (!isServiceCall) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) throw new Error("Não autenticado");
      userId = user.id;
    } else {
      console.log("[despacho-disparar] Chamada interna via service key");
    }

    const { chamado_id } = await req.json();
    if (!chamado_id) throw new Error("chamado_id é obrigatório");

    console.log(`[despacho-disparar] Iniciando despacho para chamado ${chamado_id}`);

    // Buscar chamado com veículo e destino
    const { data: chamado, error: chamadoErr } = await supabase
      .from("chamados_assistencia")
      .select(`
        id, protocolo, tipo_servico, status, observacoes,
        origem_lat, origem_lng, origem_endereco, origem_logradouro, origem_cidade, origem_uf,
        destino_endereco, destino_logradouro, destino_cidade, destino_uf,
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

    // Buscar endereço de origem
    let enderecoOrigem = chamado.origem_logradouro || chamado.origem_endereco || "";
    if (!enderecoOrigem) {
      try {
        const geoRes = await fetch(`${supabaseUrl}/functions/v1/reverse-geocode`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ latitude: veiculoLat, longitude: veiculoLng }),
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.success) enderecoOrigem = geoData.endereco_completo || "";
        }
      } catch (_) { /* continue sem endereço */ }
    }

    // Endereço de destino
    const enderecoDestino = chamado.destino_logradouro || chamado.destino_endereco || "A definir";

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

    // Determinar tipo de serviço do chamado
    const tipoServicoChamado = (chamado.tipo_servico || "reboque").toLowerCase();

    // Buscar prestadores ativos
    const { data: prestadores, error: prestErr } = await supabase
      .from("prestadores_assistencia")
      .select("id, razao_social, nome_fantasia, whatsapp, telefone, tipos_servico, tipos_reboque, disponivel")
      .eq("status", "ativo")
      .eq("disponivel", true);

    if (prestErr) throw new Error("Erro ao buscar prestadores");

    // Filtrar prestadores com whatsapp e que atendem o tipo de serviço do chamado
    const reboquistas = (prestadores || []).filter((p) => {
      const hasWhatsapp = p.whatsapp || p.telefone;
      const atendeTipo = p.tipos_servico?.some((t: string) =>
        t.toLowerCase() === tipoServicoChamado
      );
      return hasWhatsapp && atendeTipo;
    });

    if (reboquistas.length === 0) {
      throw new Error(`Nenhum prestador ativo e disponível encontrado para o tipo '${tipoServicoChamado}'. Verifique o cadastro de prestadores.`);
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
      throw new Error(`Todos os prestadores de '${tipoServicoChamado}' estão ocupados com outros chamados.`);
    }

    // Buscar valores de cada prestador (incluindo valor_sugerido)
    const { data: valores } = await supabase
      .from("prestadores_assistencia_valores")
      .select("prestador_id, valor_saida, valor_km, valor_sugerido, tipo_servico")
      .in("prestador_id", reboquistasDisponiveis.map((r) => r.id))
      .eq("ativo", true);

    const valoresMap = new Map<string, { valor_saida: number; valor_km: number; valor_sugerido: number | null }>();
    for (const v of valores || []) {
      // Priorizar valor do tipo exato do chamado, senão usar o primeiro disponível
      if (v.tipo_servico?.toLowerCase() === tipoServicoChamado || !valoresMap.has(v.prestador_id)) {
        valoresMap.set(v.prestador_id, { valor_saida: v.valor_saida || 0, valor_km: v.valor_km || 0, valor_sugerido: v.valor_sugerido || null });
      }
    }

    const now = new Date();

    // Criar despacho (sem hora_limite fixa - agora é conversacional)
    const { data: despacho, error: despErr } = await supabase
      .from("despacho_reboque")
      .insert({
        chamado_id,
        hora_disparo: now.toISOString(),
        hora_limite: new Date(now.getTime() + 10 * 60 * 1000).toISOString(), // 10min limite
        total_enviados: reboquistasDisponiveis.length,
        ciclo,
      })
      .select()
      .single();

    if (despErr || !despacho) throw new Error("Erro ao criar despacho: " + despErr?.message);

    // Criar convites para cada reboquista (sem token/link)
    const convites = reboquistasDisponiveis.map((prest) => {
      const vals = valoresMap.get(prest.id) || { valor_saida: 0, valor_km: 0, valor_sugerido: null };
      return {
        despacho_id: despacho.id,
        prestador_id: prest.id,
        token_expira_em: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
        valor_saida: vals.valor_saida,
        valor_km: vals.valor_km,
        valor_calculado: vals.valor_sugerido || null,
        etapa_conversacao: "aguardando_interesse",
      };
    });

    const { data: convitesCriados, error: convErr } = await supabase
      .from("despacho_reboque_convites")
      .insert(convites)
      .select("id, prestador_id");

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
      usuario_id: userId,
      observacao: `Despacho WhatsApp enviado (ciclo ${ciclo}). ${reboquistasDisponiveis.length} reboquistas notificados via mensagem direta.${isServiceCall ? ' [auto-despacho]' : ''}`,
    });

    // Enviar WhatsApp para cada reboquista - mensagem com valor sugerido
    const veiculo = chamado.veiculo as any;
    const veiculoDesc = veiculo ? `${veiculo.marca || ""} ${veiculo.modelo || ""} ${veiculo.ano_modelo || ""}`.trim() : "Veículo";
    const placaDisplay = veiculo?.placa || "N/D";
    const tipoServico = chamado.tipo_servico || "Reboque";
    const tipoLabel = tipoServico.charAt(0).toUpperCase() + tipoServico.slice(1);

    let enviados = 0;
    let falhas = 0;

    for (const conv of convitesCriados || []) {
      const prest = reboquistasDisponiveis.find((r) => r.id === conv.prestador_id);
      if (!prest) continue;

      const telefone = prest.whatsapp || prest.telefone;
      if (!telefone) continue;

      const vals = valoresMap.get(prest.id) || { valor_saida: 0, valor_km: 0, valor_sugerido: null };
      const valorSugerido = vals.valor_sugerido;
      const valorDisplay = valorSugerido 
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorSugerido)
        : "A combinar";

      const linhaValor = valorSugerido ? `\n💰 Valor sugerido: ${valorDisplay}` : "";
      const mensagem = `🚨 *NOVO CHAMADO - ${tipoLabel}*

🚗 Veículo: ${veiculoDesc} — ${placaDisplay}
${chamado.observacoes ? `📝 Obs: ${chamado.observacoes}\n` : ""}📍 Origem: ${enderecoOrigem || "A informar"}
📍 Destino: ${enderecoDestino}${linhaValor}

Tem interesse neste serviço? Responda *SIM* ou *NÃO*.`;

      try {
        const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const siteUrl = Deno.env.get("APP_URL") || "https://pratic-connect-21.lovable.app";
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            telefone,
            mensagem,
            template_name: 'despacho_reboque_novo',
            template_params: [veiculoDesc, placaDisplay, enderecoOrigem || 'A informar', horaAtual, siteUrl],
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
