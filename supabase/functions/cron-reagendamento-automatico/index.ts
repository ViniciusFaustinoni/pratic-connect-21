import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfiguracaoNumero } from "../_shared/config-helper.ts";

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

    // Data de hoje no fuso de Brasília
    const now = new Date();
    const brasiliaDate = now.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const [dia, mes, ano] = brasiliaDate.split("/");
    const hoje = `${ano}-${mes}-${dia}`;

    console.log(`[cron-reagendamento] Executando para data: ${hoje}`);

    // Ler configuração dinâmica de raio de redistribuição
    const redistribuicaoRaioKm = await getConfiguracaoNumero(supabase, 'redistribuicao_raio_km', 5);

    // ===== PARTE 1: Recuperar imprevistos órfãos =====
    // Serviços com imprevisto registrado há mais de 30 min mas ainda em status ativo ou imprevisto_pendente
    const threshold30min = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    const { data: orfaos, error: orfaosError } = await supabase
      .from("servicos")
      .select("id, status, reagendamento_enviado_em, imprevisto_origem, profissional_id, latitude, longitude")
      .not("imprevisto_registrado_em", "is", null)
      .lt("imprevisto_registrado_em", threshold30min)
      .in("status", ["em_andamento", "em_rota", "agendada", "imprevisto_pendente"]);

    if (orfaosError) {
      console.error("[cron-reagendamento] Erro ao buscar órfãos:", orfaosError.message);
    }

    let orfaosProcessados = 0;
    for (const orfao of orfaos || []) {
      try {
        const origem = orfao.imprevisto_origem || 'associado'; // default = associado (comportamento anterior)

        if (origem === 'instalador' && orfao.latitude && orfao.longitude) {
          // ========== REDISTRIBUIÇÃO PROATIVA (imprevisto do instalador) ==========
          console.log(`[cron-reagendamento] Imprevisto do INSTALADOR: tentando redistribuir ${orfao.id}`);

          // Buscar profissionais com GPS ativo
          const trintaMin = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
          const { data: profissionaisAtivos } = await supabase
            .from("vistoriadores_localizacao")
            .select("vistoriador_id, latitude, longitude, em_servico")
            .eq("em_servico", true)
            .gte("updated_at", trintaMin)
            .not("latitude", "is", null)
            .not("longitude", "is", null);

          let redistribuido = false;

          if (profissionaisAtivos && profissionaisAtivos.length > 0) {
            // Calcular distâncias
            const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
              const R = 6371;
              const dLat = ((lat2 - lat1) * Math.PI) / 180;
              const dLon = ((lon2 - lon1) * Math.PI) / 180;
              const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
              return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            };

            // Excluir o profissional que reportou o imprevisto
            const candidatos = profissionaisAtivos
              .filter((p: any) => p.vistoriador_id !== orfao.profissional_id)
              .map((p: any) => ({
                ...p,
                distancia: calcDist(orfao.latitude!, orfao.longitude!, p.latitude, p.longitude),
              }))
              .sort((a: any, b: any) => a.distancia - b.distancia);

            // Tentar atribuir a profissional disponível a menos de 5km
            for (const cand of candidatos) {
              if (cand.distancia > redistribuicaoRaioKm) break;

              // Verificar se está livre
              const { data: tarefaAtual } = await supabase.rpc("buscar_tarefa_atual_profissional", {
                p_profissional_id: cand.vistoriador_id,
              });

              if (!tarefaAtual || tarefaAtual.length === 0) {
                // Disponível! Atribuir diretamente
                await supabase.from("servicos").update({
                  profissional_id: cand.vistoriador_id,
                  status: "agendada",
                  updated_at: new Date().toISOString(),
                }).eq("id", orfao.id);

                console.log(`[cron-reagendamento] ✓ Redistribuído ${orfao.id} para ${cand.vistoriador_id} (${cand.distancia.toFixed(1)}km)`);
                redistribuido = true;
                break;
              } else if (cand.distancia <= 0.5) {
                // Ocupado mas muito perto — enfileirar com prioridade alta
                await supabase.from("fila_servicos").insert({
                  servico_id: orfao.id,
                  profissional_id: cand.vistoriador_id,
                  distancia_km: cand.distancia,
                  prioridade: 1,
                  status: "aguardando",
                  motivo: "redistribuicao_imprevisto",
                }).onConflict("servico_id,profissional_id").ignore();

                console.log(`[cron-reagendamento] 📋 Enfileirado ${orfao.id} para ${cand.vistoriador_id} com prioridade alta (${cand.distancia.toFixed(2)}km)`);
                redistribuido = true;
                break;
              }
            }
          }

          // Se redistribuiu, marcar imprevisto como tratado mas NÃO como nao_compareceu
          if (redistribuido) {
            await supabase.from("servicos").update({
              imprevisto_duplo_check: true,
              imprevisto_duplo_check_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", orfao.id);

            // Redistribuir fila do profissional com imprevisto
            if (orfao.profissional_id) {
              const { data: filaDoProf } = await supabase
                .from("fila_servicos")
                .select("id, servico_id")
                .eq("profissional_id", orfao.profissional_id)
                .eq("status", "aguardando");

              if (filaDoProf && filaDoProf.length > 0) {
                await supabase
                  .from("fila_servicos")
                  .update({ status: "cancelado" } as any)
                  .eq("profissional_id", orfao.profissional_id)
                  .eq("status", "aguardando");
                console.log(`[cron-reagendamento] Canceladas ${filaDoProf.length} entradas de fila do profissional com imprevisto`);
              }
            }

            orfaosProcessados++;
            continue;
          }
          // Se não redistribuiu, cai no fluxo normal abaixo
        }

        // ========== FLUXO PADRÃO: reagendar (imprevisto do associado OU falha na redistribuição) ==========
        await supabase
          .from("servicos")
          .update({
            status: "nao_compareceu",
            profissional_id: null,
            imprevisto_duplo_check: true,
            imprevisto_duplo_check_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", orfao.id);

        await supabase.functions.invoke("enviar-link-reagendamento", {
          body: { servico_id: orfao.id },
        });

        orfaosProcessados++;
        console.log(`[cron-reagendamento] Órfão recuperado (${origem}): ${orfao.id}`);
      } catch (e: any) {
        console.error(`[cron-reagendamento] Erro no órfão ${orfao.id}:`, e.message);
      }
    }

    // ===== PARTE 2: Reagendamento automático de serviços do dia não iniciados =====
    const { data: servicos, error } = await supabase
      .from("servicos")
      .select("id, tipo, status, reagendamento_enviado_em")
      .eq("data_agendada", hoje)
      .eq("status", "agendada")
      .is("reagendamento_enviado_em", null)
      .in("tipo", [
        "vistoria_adesao",
        "vistoria_transferencia",
        "vistoria_substituicao",
        "revistoria",
        "instalacao",
        "manutencao",
        "retirada",
      ]);

    if (error) throw error;

    console.log(`[cron-reagendamento] Encontrados ${servicos?.length || 0} serviços pendentes`);

    let processados = 0;
    for (const servico of servicos || []) {
      try {
        await supabase
          .from("servicos")
          .update({
            status: "nao_compareceu",
            updated_at: new Date().toISOString(),
          })
          .eq("id", servico.id);

        await supabase.functions.invoke("enviar-link-reagendamento", {
          body: { servico_id: servico.id },
        });

        processados++;
        console.log(`[cron-reagendamento] Processado: ${servico.id}`);
      } catch (e: any) {
        console.error(`[cron-reagendamento] Erro no serviço ${servico.id}:`, e.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: hoje,
        orfaos_encontrados: orfaos?.length || 0,
        orfaos_processados: orfaosProcessados,
        total_encontrados: servicos?.length || 0,
        total_processados: processados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[cron-reagendamento] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
