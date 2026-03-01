import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMITE_VAGAS_POR_PERIODO = 10;

async function geocodificarEndereco(endereco: {
  logradouro: string;
  numero?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep?: string;
}): Promise<{ latitude: number | null; longitude: number | null }> {
  try {
    const partes = [
      endereco.logradouro,
      endereco.numero,
      endereco.bairro,
      endereco.cidade,
      endereco.uf,
      "Brasil",
    ].filter(Boolean);

    const query = partes.join(", ");
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=1`;

    console.log(`[reagendar] Geocodificando: ${query}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "PraticConnect/1.0",
        "Accept-Language": "pt-BR",
      },
    });

    if (!response.ok) return { latitude: null, longitude: null };

    const data = await response.json();
    if (data.length > 0) {
      console.log(`[reagendar] Geocode OK: ${data[0].lat}, ${data[0].lon}`);
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }

    // Fallback: try with just bairro + cidade
    const fallbackQuery = `${endereco.bairro}, ${endereco.cidade}, ${endereco.uf}, Brasil`;
    const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery)}&countrycodes=br&limit=1`;
    const fallbackResp = await fetch(fallbackUrl, {
      headers: { "User-Agent": "PraticConnect/1.0", "Accept-Language": "pt-BR" },
    });
    const fallbackData = await fallbackResp.json();
    if (fallbackData.length > 0) {
      console.log(`[reagendar] Geocode fallback OK: ${fallbackData[0].lat}, ${fallbackData[0].lon}`);
      return {
        latitude: parseFloat(fallbackData[0].lat),
        longitude: parseFloat(fallbackData[0].lon),
      };
    }

    return { latitude: null, longitude: null };
  } catch (err) {
    console.error("[reagendar] Geocode error:", err);
    return { latitude: null, longitude: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { servico_id, token, nova_data, periodo, endereco, permite_encaixe } = await req.json();

    if (!servico_id || !token || !nova_data || !periodo || !endereco) {
      throw new Error("Dados incompletos");
    }

    // Validar token
    const { data: servico, error: sErr } = await supabase
      .from("servicos")
      .select("*")
      .eq("id", servico_id)
      .eq("reagendamento_token", token)
      .single();

    if (sErr || !servico) throw new Error("Serviço não encontrado ou token inválido");

    if (servico.status === "reagendada") {
      throw new Error("Esta vistoria já foi reagendada");
    }

    // Validar vagas (skip for encaixe)
    if (!permite_encaixe) {
      const { data: servicosExistentes, error: vagasErr } = await supabase
        .from("servicos")
        .select("id")
        .eq("data_agendada", nova_data)
        .eq("periodo", periodo)
        .eq("local_vistoria", "cliente")
        .not("status", "in", '("cancelada","recusada","reagendada")');

      if (vagasErr) {
        console.error("[reagendar] Erro ao verificar vagas:", vagasErr);
        throw new Error("Erro ao verificar disponibilidade");
      }

      const count = servicosExistentes?.length || 0;
      if (count >= LIMITE_VAGAS_POR_PERIODO) {
        throw new Error(`Sem vagas disponíveis para o período ${periodo === "manha" ? "manhã" : "tarde"} nesta data`);
      }
    }

    // Geocodificar endereço
    const coords = await geocodificarEndereco(endereco);

    // Calcular hora agendada baseada no período
    const hora_agendada = periodo === "manha" ? "08:00:00" : "13:00:00";

    // Criar novo serviço copiando campos relevantes do original
    const { data: novoServico, error: insertErr } = await supabase
      .from("servicos")
      .insert({
        tipo: servico.tipo,
        associado_id: servico.associado_id,
        veiculo_id: servico.veiculo_id,
        cotacao_id: servico.cotacao_id,
        contrato_id: servico.contrato_id,
        rastreador_id: servico.rastreador_id,
        local_vistoria: servico.local_vistoria || "cliente",
        data_agendada: nova_data,
        hora_agendada,
        periodo,
        status: "agendada",
        permite_encaixe: permite_encaixe || false,
        cep: endereco.cep,
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
        complemento: endereco.complemento,
        latitude: coords.latitude,
        longitude: coords.longitude,
        observacoes: `Reagendamento automático do serviço ${servico.id?.slice(0, 8)}${permite_encaixe ? " (encaixe solicitado)" : ""}`,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[reagendar] Erro ao criar serviço:", insertErr);
      throw new Error("Erro ao criar novo agendamento");
    }

    // Marcar serviço antigo como reagendada
    await supabase
      .from("servicos")
      .update({
        status: "reagendada",
        observacoes: `${servico.observacoes || ""}\n[Reagendado para ${nova_data} - Novo ID: ${novoServico.id?.slice(0, 8)}]`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", servico_id);

    console.log(`[reagendar] Sucesso: ${servico_id} -> ${novoServico.id} (encaixe: ${!!permite_encaixe}, coords: ${coords.latitude ? 'sim' : 'não'})`);

    return new Response(
      JSON.stringify({ success: true, novo_servico_id: novoServico.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[reagendar-vistoria-publica] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
