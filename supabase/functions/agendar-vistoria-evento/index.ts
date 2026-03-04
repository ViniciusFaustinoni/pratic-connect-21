import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Slots de 30 em 30 min, das 08:00 às 17:00
const SLOTS = Array.from({ length: 19 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

/**
 * Geocodifica um endereço usando Nominatim (OpenStreetMap)
 */
async function geocodificarEndereco(rua?: string, numero?: string, bairro?: string, cidade?: string): Promise<{ latitude: number | null; longitude: number | null }> {
  try {
    const partes = [rua, numero, bairro, cidade, "Brasil"].filter(Boolean);
    const enderecoCompleto = partes.join(", ");

    if (!enderecoCompleto || enderecoCompleto === "Brasil") {
      return { latitude: null, longitude: null };
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoCompleto)}&countrycodes=br&limit=1`;
    console.log(`[agendar-vistoria-evento] Geocodificando: ${enderecoCompleto}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "PraticConnect/1.0",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });

    if (!response.ok) {
      console.error(`[agendar-vistoria-evento] Nominatim status: ${response.status}`);
      return { latitude: null, longitude: null };
    }

    const data = await response.json();
    if (data.length > 0) {
      console.log(`[agendar-vistoria-evento] Geocode OK: ${data[0].lat}, ${data[0].lon}`);
      return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
    }

    // Fallback: tentar só bairro + cidade
    if (bairro && cidade) {
      const fallback = `${bairro}, ${cidade}, Brasil`;
      const r2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallback)}&countrycodes=br&limit=1`, {
        headers: { "User-Agent": "PraticConnect/1.0" },
      });
      const d2 = await r2.json();
      if (d2.length > 0) {
        return { latitude: parseFloat(d2[0].lat), longitude: parseFloat(d2[0].lon) };
      }
    }

    return { latitude: null, longitude: null };
  } catch (err) {
    console.error("[agendar-vistoria-evento] Erro geocode:", err);
    return { latitude: null, longitude: null };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, token, data_agendada, horario_agendado, endereco, permite_encaixe } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ACTION: horarios - retorna slots disponíveis para uma data
    if (action === "horarios") {
      if (!data_agendada) {
        return new Response(
          JSON.stringify({ error: "data_agendada é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: ocupados } = await supabase
        .from("vistorias_evento")
        .select("horario_agendado")
        .eq("data_agendada", data_agendada)
        .neq("status", "cancelada");

      const horariosOcupados = new Set(
        (ocupados || []).map((v: any) => v.horario_agendado?.substring(0, 5))
      );

      const disponíveis = SLOTS.map((slot) => ({
        horario: slot,
        disponivel: !horariosOcupados.has(slot),
      }));

      return new Response(
        JSON.stringify({ slots: disponíveis }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: agendar (default)
    if (!token || !data_agendada || !horario_agendado) {
      return new Response(
        JSON.stringify({ error: "token, data_agendada e horario_agendado são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar token
    const { data: link, error: linkError } = await supabase
      .from("sinistro_evento_links")
      .select("*")
      .eq("token", token)
      .single();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ error: "Link não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar expiração
    if (link.status !== "ativo" && link.status !== "completado") {
      return new Response(
        JSON.stringify({ error: "Link não está mais ativo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(link.expira_em) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Link expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar que etapa 3 foi completada
    if (link.etapa_atual < 2) {
      return new Response(
        JSON.stringify({ error: "As etapas 1 e 2 devem ser completadas antes do agendamento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se já agendou
    if (link.etapa4_completada_em) {
      return new Response(
        JSON.stringify({ error: "Agendamento já realizado para este link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar disponibilidade do horário
    const { data: conflito } = await supabase
      .from("vistorias_evento")
      .select("id")
      .eq("data_agendada", data_agendada)
      .eq("horario_agendado", horario_agendado + ":00")
      .neq("status", "cancelada")
      .maybeSingle();

    if (conflito) {
      return new Response(
        JSON.stringify({ error: "Este horário já está ocupado. Escolha outro." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Geocodificar endereço
    const coords = await geocodificarEndereco(
      endereco?.rua,
      endereco?.numero,
      endereco?.bairro,
      endereco?.cidade
    );

    // Criar vistoria
    const { data: vistoria, error: vistoriaError } = await supabase
      .from("vistorias_evento")
      .insert({
        sinistro_id: link.sinistro_id,
        link_id: link.id,
        data_agendada,
        horario_agendado: horario_agendado + ":00",
        endereco_rua: endereco?.rua || null,
        endereco_numero: endereco?.numero || null,
        endereco_bairro: endereco?.bairro || null,
        endereco_cidade: endereco?.cidade || null,
        endereco_complemento: endereco?.complemento || null,
        permite_encaixe: permite_encaixe === true,
        endereco_latitude: coords.latitude,
        endereco_longitude: coords.longitude,
        status: "agendada",
      })
      .select()
      .single();

    if (vistoriaError) {
      console.error("[agendar-vistoria-evento] Erro ao criar:", vistoriaError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar agendamento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar link com etapa4_completada_em
    await supabase
      .from("sinistro_evento_links")
      .update({ etapa4_completada_em: new Date().toISOString() })
      .eq("id", link.id);

    // Atualizar status do sinistro para pendente de vistoria
    await supabase
      .from("sinistros")
      .update({ status: "pendente_vistoria_regulador" })
      .eq("id", link.sinistro_id);

    // Notificar reguladores sobre nova vistoria agendada
    try {
      const { data: sinistroData } = await supabase
        .from("sinistros")
        .select("protocolo, associado:associados(nome), veiculo:veiculos(placa)")
        .eq("id", link.sinistro_id)
        .single();

      const { data: reguladores } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "regulador");

      if (reguladores?.length) {
        const assocNome = (sinistroData as any)?.associado?.nome || "Associado";
        const veicPlaca = (sinistroData as any)?.veiculo?.placa || "—";
        const enderecoStr = [endereco?.rua, endereco?.numero, endereco?.bairro, endereco?.cidade]
          .filter(Boolean)
          .join(", ");

        const notificacoes = reguladores.map((r: any) => ({
          user_id: r.user_id,
          titulo: "Nova Vistoria de Evento Agendada",
          mensagem: `${assocNome} - ${veicPlaca} - ${data_agendada} às ${horario_agendado} - ${enderecoStr}`,
          tipo: "vistoria_evento",
          lida: false,
        }));
        await supabase.from("notificacoes").insert(notificacoes);
      }
    } catch (notifErr) {
      console.error("[agendar-vistoria-evento] Erro ao notificar reguladores:", notifErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        vistoria: {
          id: vistoria.id,
          data_agendada: vistoria.data_agendada,
          horario_agendado: vistoria.horario_agendado,
          endereco_rua: vistoria.endereco_rua,
          endereco_numero: vistoria.endereco_numero,
          endereco_bairro: vistoria.endereco_bairro,
          endereco_cidade: vistoria.endereco_cidade,
          status: vistoria.status,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[agendar-vistoria-evento] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
