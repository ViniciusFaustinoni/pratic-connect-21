// Reconciliação CSV de inadimplentes → tabela canônica `cobrancas`.
// Marca como pago boletos que sumiram da nova listagem; atualiza vencimentos/valores
// dos que continuam; cria os que ainda não existem em `cobrancas`.
//
// Suporta paginação por associado (offset/limit) para evitar IDLE_TIMEOUT em lotes grandes.
// Cliente deve invocar repetidamente até `tem_mais=false`.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROTECTION_HOURS = 24;
const PARALELISMO = 8; // associados processados em paralelo
const PAGE_READ = 1000;

function digits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

async function processarAssociado(
  supabase: any,
  associadoId: string,
  boletos: any[],
  cutoff: string,
  loteId: string,
) {
  const out = { pagas: 0, pagasValor: 0, atualizadas: 0, criadas: 0, ignoradasRecente: 0, logRows: [] as any[] };
  const linhasNovas = new Set(boletos.map((b) => digits(b.linha_digitavel)).filter(Boolean));

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

  // 1) PAGAMENTOS
  for (const c of abertas || []) {
    const k = digits(c.linha_digitavel);
    if (!k || linhasNovas.has(k)) continue;
    if (c.created_at && c.created_at > cutoff) {
      out.ignoradasRecente++;
      out.logRows.push({ lote_id: loteId, cobranca_id: c.id, associado_id: associadoId, veiculo_id: c.veiculo_id, linha_digitavel: c.linha_digitavel, acao: "ignorada_recente", valor: c.valor_final });
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
      .eq("status", "aguardando_pagamento");
    if (!errUpd) {
      out.pagas++;
      out.pagasValor += Number(c.valor_final || 0);
      out.logRows.push({ lote_id: loteId, cobranca_id: c.id, associado_id: associadoId, veiculo_id: c.veiculo_id, linha_digitavel: c.linha_digitavel, acao: "pago_por_ausencia", valor: c.valor_final });
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
        out.atualizadas++;
        out.logRows.push({ lote_id: loteId, cobranca_id: existente.id, associado_id: associadoId, veiculo_id: existente.veiculo_id, linha_digitavel: b.linha_digitavel, acao: "atualizada", valor: novoValor, detalhes: { mudouVenc, mudouValor } });
      }
    } else {
      const valor = Number(b.valor || 0);
      if (!valor || !b.data_vencimento) continue;
      const { data: ins } = await supabase
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
      if (ins?.id) {
        out.criadas++;
        out.logRows.push({ lote_id: loteId, cobranca_id: ins.id, associado_id: associadoId, veiculo_id: b.veiculo_id, linha_digitavel: b.linha_digitavel, acao: "criada", valor });
      }
    }
  }

  return out;
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
    const offset: number = Math.max(0, Number(body.offset || 0));
    const limit: number = Math.max(1, Math.min(200, Number(body.limit || 100)));
    if (!loteId) {
      return new Response(JSON.stringify({ success: false, error: "lote_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lê TODOS os boletos do lote (paginando para superar limite default 1000).
    const boletosLote: any[] = [];
    for (let from = 0; ; from += PAGE_READ) {
      const { data, error } = await supabase
        .from("cobranca_csv_boletos")
        .select("id, matricula, associado_id, veiculo_id, linha_digitavel, data_vencimento, vencimento, valor, link_fatura, nome")
        .eq("lote_id", loteId)
        .range(from, from + PAGE_READ - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      boletosLote.push(...data);
      if (data.length < PAGE_READ) break;
    }

    const totalLinhas = boletosLote.length;
    const semMatch = boletosLote.filter((b) => !b.associado_id).length;

    // Agrupa por associado_id
    const porAssoc = new Map<string, any[]>();
    for (const b of boletosLote) {
      if (!b.associado_id || !b.linha_digitavel) continue;
      const arr = porAssoc.get(b.associado_id) || [];
      arr.push(b);
      porAssoc.set(b.associado_id, arr);
    }

    const associadosOrdenados = Array.from(porAssoc.keys()).sort();
    const totalAssociados = associadosOrdenados.length;
    const fatia = associadosOrdenados.slice(offset, offset + limit);
    const proximoOffset = offset + fatia.length;
    const temMais = proximoOffset < totalAssociados;

    const cutoff = new Date(Date.now() - PROTECTION_HOURS * 3600 * 1000).toISOString();

    let pagas = 0, pagasValor = 0, atualizadas = 0, criadas = 0, ignoradasRecente = 0;
    const logRows: any[] = [];

    // Processa em sub-batches paralelos
    for (let i = 0; i < fatia.length; i += PARALELISMO) {
      const sub = fatia.slice(i, i + PARALELISMO);
      const results = await Promise.all(
        sub.map((aid) => processarAssociado(supabase, aid, porAssoc.get(aid)!, cutoff, loteId)),
      );
      for (const r of results) {
        pagas += r.pagas;
        pagasValor += r.pagasValor;
        atualizadas += r.atualizadas;
        criadas += r.criadas;
        ignoradasRecente += r.ignoradasRecente;
        logRows.push(...r.logRows);
      }
    }

    if (logRows.length) {
      for (let i = 0; i < logRows.length; i += 500) {
        await supabase.from("cobranca_reconciliacao_log").insert(logRows.slice(i, i + 500));
      }
    }

    const resumo = {
      success: true,
      lote_id: loteId,
      total_linhas: totalLinhas,
      total_associados: totalAssociados,
      offset,
      processados: fatia.length,
      proximo_offset: proximoOffset,
      tem_mais: temMais,
      sem_match: semMatch,
      pagas,
      pagas_valor: pagasValor,
      atualizadas,
      criadas,
      ignoradas_recente: ignoradasRecente,
    };

    // Atualiza observação só no último chunk
    if (!temMais) {
      try {
        // Soma totais agregados de todas as ações deste lote no log para resumo final consistente
        const { data: agg } = await supabase
          .from("cobranca_reconciliacao_log")
          .select("acao, valor")
          .eq("lote_id", loteId);
        const totPagas = (agg || []).filter((r: any) => r.acao === "pago_por_ausencia");
        const totAtu = (agg || []).filter((r: any) => r.acao === "atualizada").length;
        const totCri = (agg || []).filter((r: any) => r.acao === "criada").length;
        const totIgn = (agg || []).filter((r: any) => r.acao === "ignorada_recente").length;
        const valorPagas = totPagas.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
        const linha = `Reconciliação: pagas=${totPagas.length} (R$ ${valorPagas.toFixed(2)}) · atualizadas=${totAtu} · criadas=${totCri} · sem_match=${semMatch} · ignoradas_recente=${totIgn}`;
        const { data: cur } = await supabase
          .from("cobranca_csv_lotes")
          .select("observacao")
          .eq("id", loteId)
          .maybeSingle();
        const obs = (cur?.observacao || "").trim();
        await supabase
          .from("cobranca_csv_lotes")
          .update({ observacao: obs ? `${obs}\n${linha}` : linha })
          .eq("id", loteId);
      } catch (_e) { /* noop */ }
    }

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
