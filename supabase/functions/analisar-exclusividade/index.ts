import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertaConfig {
  tipo: string;
  scoreBase: number;
  descricao: string;
}

const ALERTAS_CONFIG: Record<string, AlertaConfig> = {
  cpf_duplicado: {
    tipo: "cpf_duplicado",
    scoreBase: 30,
    descricao: "CPF trabalhado por múltiplos vendedores",
  },
  taxa_conversao_baixa: {
    tipo: "taxa_conversao_baixa",
    scoreBase: 20,
    descricao: "Taxa de conversão abaixo de 5% (mínimo 10 leads)",
  },
  cotacoes_abandonadas: {
    tipo: "cotacoes_abandonadas",
    scoreBase: 25,
    descricao: "Mais de 80% das cotações abandonadas",
  },
  leads_perdidos_massa: {
    tipo: "leads_perdidos_massa",
    scoreBase: 15,
    descricao: "Mais de 60% dos leads marcados como perdidos",
  },
  horario_atipico: {
    tipo: "horario_atipico",
    scoreBase: 10,
    descricao: "Atividade frequente em horários não comerciais",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { vendedorId } = await req.json().catch(() => ({}));

    console.log("🔍 Iniciando análise de exclusividade...", vendedorId ? `Vendedor: ${vendedorId}` : "Todos");

    // 1. Buscar métricas de vendedores
    let query = supabase.from("vw_metricas_vendedores").select("*");
    
    if (vendedorId) {
      query = query.eq("vendedor_id", vendedorId);
    }

    const { data: metricas, error: metricasError } = await query;

    if (metricasError) {
      console.error("Erro ao buscar métricas:", metricasError);
      throw metricasError;
    }

    console.log(`📊 ${metricas?.length || 0} vendedores para analisar`);

    // 2. Buscar CPFs duplicados
    const { data: cpfsDuplicados, error: cpfsError } = await supabase
      .from("vw_cpfs_duplicados")
      .select("*");

    if (cpfsError) {
      console.error("Erro ao buscar CPFs duplicados:", cpfsError);
      throw cpfsError;
    }

    console.log(`🔄 ${cpfsDuplicados?.length || 0} CPFs duplicados encontrados`);

    // 3. Mapear vendedores com CPFs duplicados
    const vendedoresComCpfDuplicado = new Map<string, { cpfs: string[]; total: number }>();
    
    for (const cpfDup of cpfsDuplicados || []) {
      for (const vendId of cpfDup.vendedores_ids || []) {
        if (!vendedoresComCpfDuplicado.has(vendId)) {
          vendedoresComCpfDuplicado.set(vendId, { cpfs: [], total: 0 });
        }
        const info = vendedoresComCpfDuplicado.get(vendId)!;
        info.cpfs.push(cpfDup.cpf);
        info.total++;
      }
    }

    const alertasGerados: any[] = [];
    const vendedoresAtualizados: string[] = [];

    // 4. Analisar cada vendedor
    for (const vendedor of metricas || []) {
      let scoreTotal = 0;
      const alertasVendedor: any[] = [];

      // 4.1 Verificar CPFs duplicados
      const cpfInfo = vendedoresComCpfDuplicado.get(vendedor.vendedor_id);
      if (cpfInfo && cpfInfo.total > 0) {
        const config = ALERTAS_CONFIG.cpf_duplicado;
        const score = Math.min(config.scoreBase * Math.ceil(cpfInfo.total / 3), 50);
        scoreTotal += score;

        alertasVendedor.push({
          vendedor_id: vendedor.vendedor_id,
          tipo_alerta: config.tipo,
          descricao: `${cpfInfo.total} CPF(s) trabalhados por outros vendedores`,
          dados: {
            cpfs_duplicados: cpfInfo.cpfs.slice(0, 10),
            total_cpfs: cpfInfo.total,
          },
          score_risco: score,
        });
      }

      // 4.2 Verificar taxa de conversão baixa (mínimo 10 leads)
      if (vendedor.total_leads >= 10 && vendedor.taxa_conversao < 5) {
        const config = ALERTAS_CONFIG.taxa_conversao_baixa;
        scoreTotal += config.scoreBase;

        alertasVendedor.push({
          vendedor_id: vendedor.vendedor_id,
          tipo_alerta: config.tipo,
          descricao: `Taxa de conversão de ${vendedor.taxa_conversao}% com ${vendedor.total_leads} leads`,
          dados: {
            taxa_conversao: vendedor.taxa_conversao,
            total_leads: vendedor.total_leads,
            leads_ganhos: vendedor.leads_ganhos,
          },
          score_risco: config.scoreBase,
        });
      }

      // 4.3 Verificar cotações abandonadas (> 80%)
      if (vendedor.total_cotacoes >= 5) {
        const taxaAbandono = (vendedor.cotacoes_abandonadas / vendedor.total_cotacoes) * 100;
        if (taxaAbandono > 80) {
          const config = ALERTAS_CONFIG.cotacoes_abandonadas;
          scoreTotal += config.scoreBase;

          alertasVendedor.push({
            vendedor_id: vendedor.vendedor_id,
            tipo_alerta: config.tipo,
            descricao: `${taxaAbandono.toFixed(1)}% das cotações abandonadas (${vendedor.cotacoes_abandonadas}/${vendedor.total_cotacoes})`,
            dados: {
              taxa_abandono: taxaAbandono,
              cotacoes_abandonadas: vendedor.cotacoes_abandonadas,
              total_cotacoes: vendedor.total_cotacoes,
            },
            score_risco: config.scoreBase,
          });
        }
      }

      // 4.4 Verificar leads perdidos em massa (> 60%)
      if (vendedor.total_leads >= 10 && vendedor.taxa_perda > 60) {
        const config = ALERTAS_CONFIG.leads_perdidos_massa;
        scoreTotal += config.scoreBase;

        alertasVendedor.push({
          vendedor_id: vendedor.vendedor_id,
          tipo_alerta: config.tipo,
          descricao: `${vendedor.taxa_perda}% dos leads marcados como perdidos`,
          dados: {
            taxa_perda: vendedor.taxa_perda,
            leads_perdidos: vendedor.leads_perdidos,
            total_leads: vendedor.total_leads,
          },
          score_risco: config.scoreBase,
        });
      }

      // 5. Inserir alertas (evitando duplicados recentes - últimas 24h)
      for (const alerta of alertasVendedor) {
        // Verificar se já existe alerta similar nas últimas 24h
        const { data: alertaExistente } = await supabase
          .from("auditoria_vendedores")
          .select("id")
          .eq("vendedor_id", alerta.vendedor_id)
          .eq("tipo_alerta", alerta.tipo_alerta)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!alertaExistente || alertaExistente.length === 0) {
          const { error: insertError } = await supabase
            .from("auditoria_vendedores")
            .insert(alerta);

          if (insertError) {
            console.error("Erro ao inserir alerta:", insertError);
          } else {
            alertasGerados.push(alerta);
          }
        }
      }

      // 6. Atualizar ou criar registro de monitoramento
      if (scoreTotal > 0) {
        const { data: monitoramento } = await supabase
          .from("vendedores_monitoramento")
          .select("*")
          .eq("vendedor_id", vendedor.vendedor_id)
          .single();

        const novoScore = Math.min((monitoramento?.score_risco_acumulado || 0) + scoreTotal, 100);
        const novoStatus = novoScore >= 70 ? "sob_observacao" : (novoScore >= 50 ? "sob_observacao" : "normal");

        if (monitoramento) {
          await supabase
            .from("vendedores_monitoramento")
            .update({
              score_risco_acumulado: novoScore,
              total_alertas: (monitoramento.total_alertas || 0) + alertasVendedor.length,
              status_monitoramento: monitoramento.status_monitoramento === "suspenso" ? "suspenso" : novoStatus,
              ultima_analise: new Date().toISOString(),
            })
            .eq("id", monitoramento.id);
        } else {
          await supabase
            .from("vendedores_monitoramento")
            .insert({
              vendedor_id: vendedor.vendedor_id,
              score_risco_acumulado: novoScore,
              total_alertas: alertasVendedor.length,
              status_monitoramento: novoStatus,
              ultima_analise: new Date().toISOString(),
            });
        }

        vendedoresAtualizados.push(vendedor.vendedor_id);

        // 7. Notificar gestores se score >= 70
        if (novoScore >= 70) {
          // Buscar gestores para notificar
          const { data: gestores } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("role", ["diretor", "gerente_comercial"]);

          for (const gestor of gestores || []) {
            // Buscar profile_id do gestor
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("user_id", gestor.user_id)
              .single();

            if (profile) {
              await supabase.from("notificacoes").insert({
                user_id: profile.id,
                titulo: "⚠️ Alerta de Auditoria",
                mensagem: `Vendedor ${vendedor.vendedor_nome} atingiu score de risco ${novoScore}. Verifique o painel de auditoria.`,
                tipo: "alerta",
                lida: false,
                dados: {
                  vendedor_id: vendedor.vendedor_id,
                  score_risco: novoScore,
                  link: `/auditoria/vendedores?vendedor=${vendedor.vendedor_id}`,
                },
              });
            }
          }
        }
      }
    }

    console.log(`✅ Análise concluída: ${alertasGerados.length} alertas gerados, ${vendedoresAtualizados.length} vendedores atualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        alertas_gerados: alertasGerados.length,
        vendedores_analisados: metricas?.length || 0,
        vendedores_com_alertas: vendedoresAtualizados.length,
        cpfs_duplicados: cpfsDuplicados?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Erro na análise de exclusividade:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
