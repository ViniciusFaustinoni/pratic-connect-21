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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { servico_id, token, nova_data, periodo, endereco } = await req.json();

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

    // Calcular hora agendada baseada no período
    const hora_agendada = periodo === "manha" ? "08:00:00" : "13:00:00";

    // Criar novo serviço
    const { data: novoServico, error: insertErr } = await supabase
      .from("servicos")
      .insert({
        tipo: servico.tipo,
        associado_id: servico.associado_id,
        veiculo_id: servico.veiculo_id,
        cotacao_id: servico.cotacao_id,
        data_agendada: nova_data,
        hora_agendada,
        periodo: periodo,
        status: "agendada",
        cep: endereco.cep,
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
        complemento: endereco.complemento,
        observacoes: `Reagendamento automático do serviço ${servico.id?.slice(0, 8)}`,
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    // Marcar serviço antigo como reagendada
    await supabase
      .from("servicos")
      .update({
        status: "reagendada",
        observacoes: `${servico.observacoes || ""}\n[Reagendado para ${nova_data} - Novo ID: ${novoServico.id?.slice(0, 8)}]`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", servico_id);

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
