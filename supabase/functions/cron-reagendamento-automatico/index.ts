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

    // Verificar flag de atribuição manual — quando ativa, NÃO redistribui órfãos automaticamente
    // (mas o fluxo de marcar nao_compareceu + enviar link de reagendamento continua)
    const { data: configManualFlag } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'atribuicao_manual_rotas')
      .maybeSingle();
    const atribuicaoManualAtiva = configManualFlag?.valor === 'true';
    if (atribuicaoManualAtiva) {
      console.log('[cron-reagendamento] Atribuição MANUAL ativa — redistribuição automática de órfãos desligada');
    }

    // ===== PARTE 1: Recuperar imprevistos órfãos =====
    // Serviços com imprevisto registrado há mais de 30 min mas ainda em status ativo ou imprevisto_pendente
    const threshold30min = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    const { data: orfaos, error: orfaosError } = await supabase
      .from("servicos")
      .select("id, status, reagendamento_enviado_em, imprevisto_origem, profissional_id, latitude, longitude, associado_id, veiculo_id")
      .not("imprevisto_registrado_em", "is", null)
      .lt("imprevisto_registrado_em", threshold30min)
      .in("status", ["em_andamento", "em_rota", "agendada", "imprevisto_pendente"]);

    if (orfaosError) {
      console.error("[cron-reagendamento] Erro ao buscar órfãos:", orfaosError.message);
    }

    let orfaosProcessados = 0;
    for (const orfao of orfaos || []) {
      try {
        // Guard: cancelar órfãos sem associado ou veículo
        if (!orfao.associado_id || !orfao.veiculo_id) {
          await supabase.from("servicos").update({
            status: "cancelada",
            observacoes: "Cancelado automaticamente: sem associado/veículo vinculado",
            updated_at: new Date().toISOString(),
          }).eq("id", orfao.id);
          console.log(`[cron-reagendamento] Órfão cancelado (sem associado/veículo): ${orfao.id}`);
          orfaosProcessados++;
          continue;
        }

        const origem = orfao.imprevisto_origem || 'associado'; // default = associado (comportamento anterior)

        if (origem === 'instalador' && orfao.latitude && orfao.longitude && !atribuicaoManualAtiva) {
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

        // Espelhar liberação nas tabelas de origem (instalacoes / vistorias)
        const { data: refs } = await supabase
          .from("servicos")
          .select("instalacao_origem_id, vistoria_origem_id")
          .eq("id", orfao.id)
          .maybeSingle();

        if (refs?.instalacao_origem_id) {
          await supabase
            .from("instalacoes")
            .update({
              instalador_responsavel_id: null,
              rota_id: null,
              status: "agendada",
              updated_at: new Date().toISOString(),
            })
            .eq("id", refs.instalacao_origem_id);
        }
        if (refs?.vistoria_origem_id) {
          await supabase
            .from("vistorias")
            .update({
              vistoriador_id: null,
              rota_id: null,
              status: "agendada",
              updated_at: new Date().toISOString(),
            })
            .eq("id", refs.vistoria_origem_id);
        }

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
    // ✅ CORRIGIDO: Só marca como nao_compareceu quando a janela de atendimento realmente venceu
    const { data: servicos, error } = await supabase
      .from("servicos")
      .select("id, tipo, status, reagendamento_enviado_em, created_at, hora_agendada, periodo, associado_id, veiculo_id, profissional_id, local_vistoria")
      .eq("data_agendada", hoje)
      .in("status", ["agendada", "em_rota", "em_andamento"])
      .is("reagendamento_enviado_em", null)
      .in("tipo", [
        "vistoria_entrada",
        "vistoria_saida",
        "vistoria_sinistro",
        "vistoria_periodica",
        "instalacao",
        "vistoria_manutencao",
        "vistoria_retirada",
      ]);

    if (error) throw error;

    console.log(`[cron-reagendamento] Encontrados ${servicos?.length || 0} serviços pendentes para avaliação`);

    // Hora atual em Brasília (formato HH:MM)
    const horaAtualBrasilia = now.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Idade mínima: 30 minutos desde a criação
    const IDADE_MINIMA_MS = 30 * 60 * 1000;
    // Tolerância após hora agendada: 15 minutos
    const TOLERANCIA_HORA_MIN = "00:15";

    // Mapa de cutoff por período (com tolerância de 15 min)
    const cutoffPeriodo: Record<string, string> = {
      manha: "12:15",
      tarde: "17:15",
      noite: "21:15",
    };
    // Cutoff padrão (sem hora nem período)
    const CUTOFF_PADRAO = "20:00";

    function somarHoras(hora: string, acrescimo: string): string {
      const [h1, m1] = hora.split(":").map(Number);
      const [h2, m2] = acrescimo.split(":").map(Number);
      const totalMin = h1 * 60 + m1 + h2 * 60 + m2;
      const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
      const mm = String(totalMin % 60).padStart(2, "0");
      return `${hh}:${mm}`;
    }

    let processados = 0;
    let ignoradosRecente = 0;
    let ignoradosJanela = 0;

    for (const servico of servicos || []) {
      try {
        // Guard: cancelar serviços sem associado ou veículo
        if (!servico.associado_id || !servico.veiculo_id) {
          await supabase.from("servicos").update({
            status: "cancelada",
            observacoes: "Cancelado automaticamente: sem associado/veículo vinculado",
            updated_at: new Date().toISOString(),
          }).eq("id", servico.id);
          console.log(`[cron-reagendamento] Serviço cancelado (sem associado/veículo): ${servico.id}`);
          processados++;
          continue;
        }

        // CHECK 1: Idade mínima — nunca reagendar serviço recém-criado
        const idadeMs = now.getTime() - new Date(servico.created_at).getTime();
        if (idadeMs < IDADE_MINIMA_MS) {
          ignoradosRecente++;
          continue;
        }

        // CHECK 2: Janela de atendimento ainda não venceu
        let cutoff: string;

        if (servico.hora_agendada) {
          // Tem hora específica → cutoff = hora + tolerância
          cutoff = somarHoras(servico.hora_agendada, TOLERANCIA_HORA_MIN);
        } else if (servico.periodo && cutoffPeriodo[servico.periodo]) {
          // Tem período → usar cutoff do período
          cutoff = cutoffPeriodo[servico.periodo];
        } else {
          // Sem hora nem período → cutoff padrão conservador
          cutoff = CUTOFF_PADRAO;
        }

        if (horaAtualBrasilia < cutoff) {
          ignoradosJanela++;
          continue;
        }

        // Janela vencida e serviço antigo → marcar como nao_compareceu e devolver do técnico
        const profissionalAnterior = servico.profissional_id;
        await supabase
          .from("servicos")
          .update({
            status: "nao_compareceu",
            profissional_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", servico.id);

        // Cancelar entradas em fila ligadas ao serviço
        await supabase
          .from("fila_servicos")
          .update({ status: "cancelado" } as any)
          .eq("servico_id", servico.id)
          .eq("status", "aguardando");

        if (profissionalAnterior) {
          console.log(`[cron-reagendamento] ↩ Tarefa ${servico.id} devolvida do técnico ${profissionalAnterior}`);
        }

        await supabase.functions.invoke("enviar-link-reagendamento", {
          body: { servico_id: servico.id },
        });

        processados++;
        console.log(`[cron-reagendamento] Processado (vencido): ${servico.id} (cutoff=${cutoff}, status_anterior=${servico.status})`);
      } catch (e: any) {
        console.error(`[cron-reagendamento] Erro no serviço ${servico.id}:`, e.message);
      }
    }

    console.log(`[cron-reagendamento] Resumo Parte 2: ${processados} reagendados, ${ignoradosRecente} ignorados (recentes), ${ignoradosJanela} ignorados (janela ativa)`);

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
