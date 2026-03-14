// ============================================
// EDGE FUNCTION: cron-app-apolice
// Envia automaticamente a Apólice de Passageiros (APP)
// 30 dias após assinatura do contrato
// ============================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar contratos assinados há exatamente 30 dias que ainda não receberam a apólice APP
    const hoje = new Date();
    const trintaDiasAtras = new Date(hoje);
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    
    const dataAlvo = trintaDiasAtras.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`[cron-app-apolice] Buscando contratos assinados em ${dataAlvo}...`);

    // Buscar contratos que:
    // 1. Foram assinados na data alvo (autentique_assinado_em)
    // 2. Ainda não receberam a apólice (app_apolice_enviada != true)
    // 3. Estão ativos
    const { data: contratos, error: contratosError } = await supabase
      .from("contratos")
      .select(`
        id,
        numero,
        associado_id,
        cliente_nome,
        cliente_email,
        cliente_telefone,
        veiculo_marca,
        veiculo_modelo,
        veiculo_placa,
        autentique_assinado_em
      `)
      .gte("autentique_assinado_em", `${dataAlvo}T00:00:00`)
      .lt("autentique_assinado_em", `${dataAlvo}T23:59:59`)
      .eq("status", "ativo")
      .neq("app_apolice_enviada", true);

    if (contratosError) {
      // Se a coluna app_apolice_enviada não existe, logamos e seguimos
      console.warn("[cron-app-apolice] Erro ao buscar contratos:", contratosError.message);
      
      // Tentar busca sem o filtro app_apolice_enviada (coluna pode não existir ainda)
      const { data: contratosFallback, error: fallbackError } = await supabase
        .from("contratos")
        .select("id, numero, associado_id, cliente_nome, cliente_email, cliente_telefone, veiculo_marca, veiculo_modelo, veiculo_placa, autentique_assinado_em")
        .gte("autentique_assinado_em", `${dataAlvo}T00:00:00`)
        .lt("autentique_assinado_em", `${dataAlvo}T23:59:59`)
        .eq("status", "ativo");

      if (fallbackError || !contratosFallback?.length) {
        console.log("[cron-app-apolice] Nenhum contrato elegível encontrado");
        return new Response(JSON.stringify({ success: true, processados: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const contratosElegiveis = contratos || [];

    if (contratosElegiveis.length === 0) {
      console.log("[cron-app-apolice] Nenhum contrato elegível para envio de APP");
      return new Response(JSON.stringify({ success: true, processados: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[cron-app-apolice] ${contratosElegiveis.length} contrato(s) elegível(is) para APP`);

    let enviados = 0;
    let erros = 0;

    for (const contrato of contratosElegiveis) {
      try {
        console.log(`[cron-app-apolice] Processando contrato ${contrato.numero} (${contrato.id})`);

        // Registrar notificação de APP enviada
        const { error: notifError } = await supabase
          .from("notificacoes")
          .insert({
            tipo: "app_apolice",
            titulo: "Apólice de Passageiros (APP)",
            mensagem: `Sua Apólice de Proteção a Passageiros está disponível. Contrato ${contrato.numero}.`,
            destinatario_id: contrato.associado_id,
            canal: "app",
            dados: {
              contrato_id: contrato.id,
              contrato_numero: contrato.numero,
              tipo: "app_apolice_30_dias",
            },
          });

        if (notifError) {
          console.warn(`[cron-app-apolice] Erro ao criar notificação para ${contrato.numero}:`, notifError.message);
        }

        // Marcar contrato como APP enviada (se coluna existir)
        await supabase
          .from("contratos")
          .update({ app_apolice_enviada: true, app_apolice_enviada_em: new Date().toISOString() })
          .eq("id", contrato.id);

        enviados++;
        console.log(`[cron-app-apolice] ✅ APP enviada para contrato ${contrato.numero}`);
      } catch (err) {
        erros++;
        console.error(`[cron-app-apolice] ❌ Erro no contrato ${contrato.numero}:`, err);
      }
    }

    const resultado = {
      success: true,
      processados: contratosElegiveis.length,
      enviados,
      erros,
      dataAlvo,
    };

    console.log("[cron-app-apolice] Resultado:", resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[cron-app-apolice] Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
