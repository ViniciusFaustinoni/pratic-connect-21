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

    const hoje = new Date().toISOString().split("T")[0];

    // Buscar despesas recorrentes ativas com proximo_lancamento <= hoje
    const { data: despesas, error: fetchError } = await supabase
      .from("despesas_recorrentes")
      .select("*")
      .eq("ativo", true)
      .lte("proximo_lancamento", hoje);

    if (fetchError) {
      console.error("Erro ao buscar despesas:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!despesas || despesas.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma despesa a gerar", geradas: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let geradas = 0;

    for (const despesa of despesas) {
      // Inserir em contas_pagar
      const { error: insertError } = await supabase.from("contas_pagar").insert({
        fornecedor_nome: despesa.fornecedor_nome,
        fornecedor_documento: despesa.fornecedor_documento,
        categoria: despesa.categoria,
        subcategoria: despesa.subcategoria,
        valor: despesa.valor,
        data_vencimento: despesa.proximo_lancamento,
        forma_pagamento: despesa.forma_pagamento,
        banco: despesa.banco,
        agencia: despesa.agencia,
        conta: despesa.conta,
        pix_chave: despesa.pix_chave,
        observacao: `${despesa.descricao} (recorrente)`,
        status: "pendente",
        referencia_tipo: "despesa_recorrente",
        referencia_id: despesa.id,
      });

      if (insertError) {
        console.error(`Erro ao inserir conta para despesa ${despesa.id}:`, insertError);
        continue;
      }

      // Calcular próximo lançamento
      const proximoAtual = new Date(despesa.proximo_lancamento + "T12:00:00Z");
      let novoProximo: Date;

      switch (despesa.frequencia) {
        case "semanal":
          novoProximo = new Date(proximoAtual);
          novoProximo.setDate(novoProximo.getDate() + 7);
          break;
        case "quinzenal":
          novoProximo = new Date(proximoAtual);
          novoProximo.setDate(novoProximo.getDate() + 15);
          break;
        case "anual":
          novoProximo = new Date(proximoAtual);
          novoProximo.setFullYear(novoProximo.getFullYear() + 1);
          break;
        case "mensal":
        default:
          novoProximo = new Date(proximoAtual);
          novoProximo.setMonth(novoProximo.getMonth() + 1);
          // Ajustar dia se necessário
          if (novoProximo.getDate() !== despesa.dia_vencimento) {
            novoProximo.setDate(Math.min(despesa.dia_vencimento, 28));
          }
          break;
      }

      const novoProximoStr = novoProximo.toISOString().split("T")[0];

      // Atualizar despesa recorrente
      const { error: updateError } = await supabase
        .from("despesas_recorrentes")
        .update({
          ultimo_lancamento: hoje,
          proximo_lancamento: novoProximoStr,
        })
        .eq("id", despesa.id);

      if (updateError) {
        console.error(`Erro ao atualizar despesa ${despesa.id}:`, updateError);
      }

      geradas++;
    }

    console.log(`Geradas ${geradas} contas a pagar de despesas recorrentes`);

    return new Response(
      JSON.stringify({ message: `${geradas} conta(s) gerada(s)`, geradas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro geral:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
