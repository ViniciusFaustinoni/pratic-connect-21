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

    // Guard de idempotência: se já existe um serviço criado nos últimos 60s
    // para a mesma origem/data, reusar (evita duplicação por clique duplo).
    {
      const sinceIso = new Date(Date.now() - 60_000).toISOString();
      let q = supabase
        .from("servicos")
        .select("id")
        .eq("status", "agendada")
        .eq("data_agendada", nova_data)
        .gte("created_at", sinceIso)
        .limit(1);
      if (servico.cotacao_id) q = q.eq("cotacao_id", servico.cotacao_id);
      else if (servico.instalacao_origem_id) q = q.eq("instalacao_origem_id", servico.instalacao_origem_id);
      else if (servico.vistoria_origem_id) q = q.eq("vistoria_origem_id", servico.vistoria_origem_id);
      else q = q.eq("associado_id", servico.associado_id).eq("veiculo_id", servico.veiculo_id);

      const { data: jaCriado } = await q.maybeSingle();
      if (jaCriado?.id) {
        console.log(`[reagendar] Idempotência: reusando serviço ${jaCriado.id}`);
        return new Response(
          JSON.stringify({ success: true, novo_servico_id: jaCriado.id, reused: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // DEDUPE: fechar quaisquer outros serviços ativos da mesma cotação ANTES de criar o novo,
    // evitando que o técnico veja itens fantasma com data antiga (relatos 2189c17b e ee37f6dc).
    if (servico.cotacao_id) {
      const { data: ativos } = await supabase
        .from("servicos")
        .select("id")
        .eq("cotacao_id", servico.cotacao_id)
        .neq("id", servico.id)
        .not("status", "in", '("cancelada","reagendada","reprovada","concluida","aprovada","aprovada_ressalvas","nao_compareceu")');

      if (ativos && ativos.length > 0) {
        const ids = ativos.map((s) => s.id);
        await supabase
          .from("servicos")
          .update({
            status: "cancelada",
            observacoes: `[AUTO 27/04/2026] Cancelado pelo fluxo de reagendamento — substituído por novo serviço.`,
            updated_at: new Date().toISOString(),
          })
          .in("id", ids);
        console.log(`[reagendar] Dedupe: ${ids.length} serviço(s) ativo(s) antigo(s) cancelado(s).`);

        // Fechar agendamentos_base órfãos da mesma cotação
        await supabase
          .from("agendamentos_base")
          .update({ status: "cancelado", updated_at: new Date().toISOString() })
          .eq("cotacao_id", servico.cotacao_id)
          .not("status", "in", '("cancelado","concluido","realizado")');
      }
    }

    // Validar vagas (skip for encaixe)
    if (!permite_encaixe) {
      const { data: servicosExistentes, error: vagasErr } = await supabase
        .from("servicos")
        .select("id")
        .eq("data_agendada", nova_data)
        .eq("periodo", periodo)
        .eq("local_vistoria", "cliente")
        .not("status", "in", '("cancelada","reagendada","nao_compareceu")');

      if (vagasErr) {
        console.error("[reagendar] Erro ao verificar vagas:", vagasErr);
        throw new Error("Erro ao verificar disponibilidade");
      }

      const count = servicosExistentes?.length || 0;
      if (count >= LIMITE_VAGAS_POR_PERIODO) {
        throw new Error(`Sem vagas disponíveis para o período ${periodo === "manha" ? "manhã" : "tarde"} nesta data`);
      }
    }

    // Validar que o serviço original tem associado e veículo
    if (!servico.associado_id || !servico.veiculo_id) {
      throw new Error("Serviço original incompleto (sem associado ou veículo). Não é possível reagendar.");
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

    // Encerrar agendamentos_base antigos vinculados à mesma origem
    // (a trigger trg_sync_agendamento_base_on_servico_terminal já cobre isso a partir
    // do update acima, mas mantemos esta varredura defensiva para origens não cobertas
    // por colunas atuais e para garantir o fechamento mesmo se a trigger for desligada).
    const filtros: Array<{ col: string; val: string }> = [];
    if (servico.cotacao_id) filtros.push({ col: 'cotacao_id', val: servico.cotacao_id });
    if (servico.instalacao_origem_id) filtros.push({ col: 'instalacao_id', val: servico.instalacao_origem_id });
    if (servico.vistoria_origem_id) filtros.push({ col: 'vistoria_id', val: servico.vistoria_origem_id });

    for (const f of filtros) {
      await supabase
        .from('agendamentos_base')
        .update({ status: 'reagendado', updated_at: new Date().toISOString() })
        .eq(f.col, f.val)
        .in('status', ['agendado', 'pendente', 'confirmado']);
    }

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
