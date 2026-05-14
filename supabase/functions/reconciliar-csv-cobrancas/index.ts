// Reconciliação CSV de inadimplentes → tabela canônica `cobrancas`.
// Marca como pago boletos que sumiram da nova listagem; atualiza vencimentos/valores
// dos que continuam; cria os que ainda não existem em `cobrancas`.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROTECTION_HOURS = 24; // não baixa cobranças criadas há menos disso

function digits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const loteId: string | undefined = body.lote_id;
    if (!loteId) {
      return new Response(JSON.stringify({ success: false, error: "lote_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega todos os boletos do lote com associado matched.
    const { data: boletosLote, error: errBoletos } = await supabase
      .from("cobranca_csv_boletos")
      .select("id, matricula, associado_id, veiculo_id, linha_digitavel, data_vencimento, vencimento, valor, link_fatura, nome")
      .eq("lote_id", loteId);
    if (errBoletos) throw errBoletos;

    const totalLinhas = boletosLote?.length || 0;
    const semMatch = (boletosLote || []).filter((b) => !b.associado_id).length;

    // Agrupa por associado_id
    const porAssoc = new Map<string, any[]>();
    for (const b of boletosLote || []) {
      if (!b.associado_id || !b.linha_digitavel) continue;
      const arr = porAssoc.get(b.associado_id) || [];
      arr.push(b);
      porAssoc.set(b.associado_id, arr);
    }

    const cutoff = new Date(Date.now() - PROTECTION_HOURS * 3600 * 1000).toISOString();

    let pagas = 0, pagasValor = 0;
    let atualizadas = 0;
    let criadas = 0;
    let ignoradasRecente = 0;
    const logRows: any[] = [];

    for (const [associadoId, boletos] of porAssoc.entries()) {
      const linhasNovas = new Set(boletos.map((b) => digits(b.linha_digitavel)).filter(Boolean));

      // Cobranças abertas atuais desse associado (origem SGA)
      const { data: abertas } = await supabase
        .from("cobrancas")
        .select("id, linha_digitavel, valor_final, data_vencimento, created_at, veiculo_id")
        .eq("associado_id", associadoId)
        .eq("status", "aguardando_pagamento")
        .eq("origem", "sga_hinova");

      const abertasMap = new Map<string, any>();
      for (const c of abertas || []) {
        const k = digits(c.linha_digitavel);
        if (k) abertasMap.set(k, c);
      }

      // 1) PAGAMENTOS: abertas que sumiram do CSV
      for (const c of abertas || []) {
        const k = digits(c.linha_digitavel);
        if (!k) continue; // sem linha digitável não dá pra reconciliar com segurança
        if (linhasNovas.has(k)) continue; // ainda em aberto
        if (c.created_at && c.created_at > cutoff) {
          ignoradasRecente++;
          logRows.push({ lote_id: loteId, cobranca_id: c.id, associado_id: associadoId, veiculo_id: c.veiculo_id, linha_digitavel: c.linha_digitavel, acao: "ignorada_recente", valor: c.valor_final });
          continue;
        }
        const { error: errUpd } = await supabase
          .from("cobrancas")
          .update({
            status: "pago",
            data_pagamento: new Date().toISOString().slice(0, 10),
            valor_pago: c.valor_final,
            forma_pagamento: "baixa_csv_sga",
            updated_at: new Date().toISOString(),
          })
          .eq("id", c.id)
          .eq("status", "aguardando_pagamento"); // CAS
        if (!errUpd) {
          pagas++;
          pagasValor += Number(c.valor_final || 0);
          logRows.push({ lote_id: loteId, cobranca_id: c.id, associado_id: associadoId, veiculo_id: c.veiculo_id, linha_digitavel: c.linha_digitavel, acao: "pago_por_ausencia", valor: c.valor_final });
        }
      }

      // 2) ATUALIZAÇÕES + 3) NOVOS
      for (const b of boletos) {
        const k = digits(b.linha_digitavel);
        if (!k) continue;
        const existente = abertasMap.get(k);
        if (existente) {
          const novoVenc = b.data_vencimento || existente.data_vencimento;
          const novoValor = Number(b.valor || 0) || existente.valor_final;
          const mudouVenc = novoVenc && String(novoVenc) !== String(existente.data_vencimento);
          const mudouValor = novoValor && Number(novoValor) !== Number(existente.valor_final);
          if (mudouVenc || mudouValor) {
            await supabase
              .from("cobrancas")
              .update({
                data_vencimento: novoVenc,
                valor: novoValor,
                valor_final: novoValor,
                link_fatura: b.link_fatura || null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existente.id)
              .eq("status", "aguardando_pagamento");
            atualizadas++;
            logRows.push({ lote_id: loteId, cobranca_id: existente.id, associado_id: associadoId, veiculo_id: existente.veiculo_id, linha_digitavel: b.linha_digitavel, acao: "atualizada", valor: novoValor, detalhes: { mudouVenc, mudouValor } });
          }
        } else {
          // Cria nova cobrança (idempotente via índice único parcial em linha_digitavel)
          const valor = Number(b.valor || 0);
          if (!valor || !b.data_vencimento) continue;
          const { data: ins, error: errIns } = await supabase
            .from("cobrancas")
            .upsert({
              associado_id: associadoId,
              veiculo_id: b.veiculo_id || null,
              tipo: "mensalidade",
              status: "aguardando_pagamento",
              origem: "sga_hinova",
              valor,
              valor_final: valor,
              data_emissao: new Date().toISOString().slice(0, 10),
              data_vencimento: b.data_vencimento,
              linha_digitavel: b.linha_digitavel,
              link_fatura: b.link_fatura || null,
            }, { onConflict: "linha_digitavel", ignoreDuplicates: true })
            .select("id")
            .maybeSingle();
          if (!errIns && ins?.id) {
            criadas++;
            logRows.push({ lote_id: loteId, cobranca_id: ins.id, associado_id: associadoId, veiculo_id: b.veiculo_id, linha_digitavel: b.linha_digitavel, acao: "criada", valor });
          }
        }
      }
    }

    // Grava log em chunks
    if (logRows.length) {
      for (let i = 0; i < logRows.length; i += 500) {
        await supabase.from("cobranca_reconciliacao_log").insert(logRows.slice(i, i + 500));
      }
    }

    const resumo = {
      success: true,
      lote_id: loteId,
      total_linhas: totalLinhas,
      sem_match: semMatch,
      pagas,
      pagas_valor: pagasValor,
      atualizadas,
      criadas,
      ignoradas_recente: ignoradasRecente,
    };

    // Anexa resumo na observacao do lote
    try {
      const { data: cur } = await supabase
        .from("cobranca_csv_lotes")
        .select("observacao")
        .eq("id", loteId)
        .maybeSingle();
      const obs = (cur?.observacao || "").trim();
      const linha = `Reconciliação: pagas=${pagas} (R$ ${pagasValor.toFixed(2)}) · atualizadas=${atualizadas} · criadas=${criadas} · sem_match=${semMatch} · ignoradas_recente=${ignoradasRecente}`;
      await supabase
        .from("cobranca_csv_lotes")
        .update({ observacao: obs ? `${obs}\n${linha}` : linha })
        .eq("id", loteId);
    } catch (_e) { /* noop */ }

    return new Response(JSON.stringify(resumo), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[reconciliar-csv-cobrancas]", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
