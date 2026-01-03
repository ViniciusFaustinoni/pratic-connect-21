import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuração de limites para alertas
const CONFIG = {
  SEM_COMUNICACAO_HORAS: 2,      // Alerta após 2h sem comunicação
  SEM_COMUNICACAO_CRITICO: 24,   // Crítico após 24h
};

interface Rastreador {
  id: string;
  codigo: string;
  ultima_comunicacao: string | null;
  status: string;
}

interface AlertaExistente {
  id: string;
  rastreador_id: string;
  tipo: string;
  status: string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("=".repeat(50));
  console.log(`[check-alertas] Iniciando verificação: ${new Date().toISOString()}`);

  try {
    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // =========================================
    // 1. VERIFICAR RASTREADORES SEM COMUNICAÇÃO
    // =========================================
    
    const limiteHoras = CONFIG.SEM_COMUNICACAO_HORAS;
    const dataLimite = new Date(Date.now() - limiteHoras * 60 * 60 * 1000).toISOString();

    // Buscar rastreadores instalados sem comunicação recente
    const { data: semComunicacao, error: errRast } = await supabase
      .from("rastreadores")
      .select("id, codigo, ultima_comunicacao")
      .eq("status", "instalado")
      .or(`ultima_comunicacao.is.null,ultima_comunicacao.lt.${dataLimite}`);

    if (errRast) {
      throw new Error(`Erro ao buscar rastreadores: ${errRast.message}`);
    }

    console.log(`[check-alertas] ${semComunicacao?.length || 0} rastreadores sem comunicação`);

    // Buscar alertas de "sem_comunicacao" já abertos
    const { data: alertasExistentes, error: errAlertas } = await supabase
      .from("rastreador_alertas")
      .select("id, rastreador_id, tipo, status")
      .eq("tipo", "sem_comunicacao")
      .in("status", ["aberto", "visualizado"]);

    if (errAlertas) {
      throw new Error(`Erro ao buscar alertas existentes: ${errAlertas.message}`);
    }

    // Mapear alertas existentes por rastreador
    const alertasPorRastreador = new Map<string, AlertaExistente>();
    for (const alerta of alertasExistentes || []) {
      alertasPorRastreador.set(alerta.rastreador_id, alerta);
    }

    // Criar novos alertas
    const novosAlertas: any[] = [];
    const alertasAtualizados: string[] = [];

    for (const rast of semComunicacao || []) {
      // Calcular horas sem comunicação
      let horasSemCom = 9999;
      if (rast.ultima_comunicacao) {
        horasSemCom = Math.floor(
          (Date.now() - new Date(rast.ultima_comunicacao).getTime()) / (1000 * 60 * 60)
        );
      }

      // Determinar severidade
      let severidade: string;
      if (horasSemCom >= CONFIG.SEM_COMUNICACAO_CRITICO) {
        severidade = "critica";
      } else if (horasSemCom >= 12) {
        severidade = "alta";
      } else if (horasSemCom >= 6) {
        severidade = "media";
      } else {
        severidade = "baixa";
      }

      // Verificar se já existe alerta para este rastreador
      const alertaExistente = alertasPorRastreador.get(rast.id);

      if (alertaExistente) {
        // Atualizar severidade se necessário
        alertasAtualizados.push(alertaExistente.id);
      } else {
        // Criar novo alerta
        novosAlertas.push({
          rastreador_id: rast.id,
          tipo: "sem_comunicacao",
          severidade,
          mensagem: rast.ultima_comunicacao
            ? `Rastreador ${rast.codigo} sem comunicação há ${horasSemCom} hora(s)`
            : `Rastreador ${rast.codigo} nunca comunicou`,
          dados: {
            ultima_comunicacao: rast.ultima_comunicacao,
            horas_sem_comunicacao: horasSemCom,
          },
          status: "aberto",
        });
      }
    }

    // Inserir novos alertas
    let alertasCriados = 0;
    if (novosAlertas.length > 0) {
      const { data: inserted, error: errInsert } = await supabase
        .from("rastreador_alertas")
        .insert(novosAlertas)
        .select();

      if (errInsert) {
        console.error("[check-alertas] Erro ao inserir alertas:", errInsert);
      } else {
        alertasCriados = inserted?.length || 0;
        console.log(`[check-alertas] ${alertasCriados} novos alertas criados`);
      }
    }

    // =========================================
    // 2. FECHAR ALERTAS DE RASTREADORES QUE VOLTARAM
    // =========================================
    
    // Buscar rastreadores que voltaram a comunicar
    const { data: comunicando, error: errCom } = await supabase
      .from("rastreadores")
      .select("id")
      .eq("status", "instalado")
      .gte("ultima_comunicacao", dataLimite);

    let alertasFechados = 0;
    if (!errCom && comunicando) {
      const idsComunicando = comunicando.map(r => r.id);
      
      if (idsComunicando.length > 0) {
        // Fechar alertas desses rastreadores
        const { data: fechados, error: errFechar } = await supabase
          .from("rastreador_alertas")
          .update({
            status: "tratado",
            observacao_tratamento: "Resolvido automaticamente - rastreador voltou a comunicar",
            tratado_em: new Date().toISOString(),
          })
          .eq("tipo", "sem_comunicacao")
          .in("status", ["aberto", "visualizado"])
          .in("rastreador_id", idsComunicando)
          .select();

        if (!errFechar && fechados) {
          alertasFechados = fechados.length;
          console.log(`[check-alertas] ${alertasFechados} alertas fechados automaticamente`);
        }
      }
    }

    // =========================================
    // 3. RESULTADO
    // =========================================

    const duracao = Date.now() - startTime;
    console.log(`[check-alertas] Concluído em ${duracao}ms`);
    console.log("=".repeat(50));

    return new Response(
      JSON.stringify({
        success: true,
        verificados: semComunicacao?.length || 0,
        alertas_criados: alertasCriados,
        alertas_fechados: alertasFechados,
        alertas_existentes: alertasExistentes?.length || 0,
        duracao_ms: duracao,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[check-alertas] ERRO:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        duracao_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
