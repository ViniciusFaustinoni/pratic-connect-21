import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// CONFIGURAÇÃO
// =====================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlataformaConfig {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
}

const getPlataformasConfig = (): Record<string, PlataformaConfig> => ({
  rede_veiculos: {
    baseUrl: Deno.env.get("REDE_VEICULOS_URL") || "",
    apiKey: Deno.env.get("REDE_VEICULOS_KEY") || "",
    enabled: Boolean(Deno.env.get("REDE_VEICULOS_KEY")),
  },
  sascar: {
    baseUrl: Deno.env.get("SASCAR_URL") || "",
    apiKey: Deno.env.get("SASCAR_KEY") || "",
    enabled: Boolean(Deno.env.get("SASCAR_KEY")),
  },
  autotrac: {
    baseUrl: Deno.env.get("AUTOTRAC_URL") || "",
    apiKey: Deno.env.get("AUTOTRAC_KEY") || "",
    enabled: Boolean(Deno.env.get("AUTOTRAC_KEY")),
  },
  onixsat: {
    baseUrl: Deno.env.get("ONIXSAT_URL") || "",
    apiKey: Deno.env.get("ONIXSAT_KEY") || "",
    enabled: Boolean(Deno.env.get("ONIXSAT_KEY")),
  },
});

// =====================================================
// TIPOS
// =====================================================

interface Rastreador {
  id: string;
  codigo: string;
  plataforma: string;
  id_plataforma: string;
}

interface Posicao {
  rastreador_id: string;
  latitude: number;
  longitude: number;
  velocidade: number;
  ignicao: boolean;
  data_posicao: string;
  odometro?: number;
  direcao?: number;
  bateria_nivel?: number;
  sinal_gsm?: number;
}

interface SyncResult {
  plataforma: string;
  total: number;
  sucesso: number;
  falhas: number;
  erros: string[];
}

// =====================================================
// FUNÇÕES DE SINCRONIZAÇÃO POR PLATAFORMA
// =====================================================

async function syncRedeVeiculos(
  rastreadores: Rastreador[],
  config: PlataformaConfig
): Promise<{ posicoes: Posicao[]; result: SyncResult }> {
  const result: SyncResult = {
    plataforma: "rede_veiculos",
    total: rastreadores.length,
    sucesso: 0,
    falhas: 0,
    erros: [],
  };
  const posicoes: Posicao[] = [];

  if (!config.enabled) {
    result.erros.push("API não configurada");
    result.falhas = rastreadores.length;
    return { posicoes, result };
  }

  for (const rast of rastreadores) {
    try {
      // Chamada à API da Rede Veículos
      // ADAPTAR CONFORME DOCUMENTAÇÃO REAL DA API
      const response = await fetch(
        `${config.baseUrl}/api/v1/veiculos/${rast.id_plataforma}/posicao`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Mapear resposta da API para nosso formato
      posicoes.push({
        rastreador_id: rast.id,
        latitude: parseFloat(data.latitude || data.lat || 0),
        longitude: parseFloat(data.longitude || data.lng || data.lon || 0),
        velocidade: parseInt(data.velocidade || data.speed || 0),
        ignicao: Boolean(data.ignicao || data.ignition || data.ign),
        data_posicao: data.data_hora || data.timestamp || data.datetime || new Date().toISOString(),
        odometro: data.odometro || data.hodometro || undefined,
        direcao: data.direcao || data.heading || data.curso || undefined,
        bateria_nivel: data.bateria || data.battery || undefined,
        sinal_gsm: data.sinal || data.gsm || undefined,
      });

      result.sucesso++;
    } catch (error: unknown) {
      result.falhas++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.erros.push(`${rast.codigo}: ${errorMessage}`);
      console.error(`[Rede Veículos] Erro no rastreador ${rast.codigo}:`, error);
    }
  }

  return { posicoes, result };
}

async function syncSascar(
  rastreadores: Rastreador[],
  config: PlataformaConfig
): Promise<{ posicoes: Posicao[]; result: SyncResult }> {
  const result: SyncResult = {
    plataforma: "sascar",
    total: rastreadores.length,
    sucesso: 0,
    falhas: 0,
    erros: [],
  };
  const posicoes: Posicao[] = [];

  if (!config.enabled) {
    result.erros.push("API não configurada");
    result.falhas = rastreadores.length;
    return { posicoes, result };
  }

  // TODO: Implementar conforme documentação da Sascar
  for (const rast of rastreadores) {
    result.falhas++;
    result.erros.push(`${rast.codigo}: API Sascar não implementada`);
  }

  return { posicoes, result };
}

async function syncAutotrac(
  rastreadores: Rastreador[],
  config: PlataformaConfig
): Promise<{ posicoes: Posicao[]; result: SyncResult }> {
  const result: SyncResult = {
    plataforma: "autotrac",
    total: rastreadores.length,
    sucesso: 0,
    falhas: 0,
    erros: [],
  };
  const posicoes: Posicao[] = [];

  if (!config.enabled) {
    result.erros.push("API não configurada");
    result.falhas = rastreadores.length;
    return { posicoes, result };
  }

  // TODO: Implementar conforme documentação da Autotrac
  for (const rast of rastreadores) {
    result.falhas++;
    result.erros.push(`${rast.codigo}: API Autotrac não implementada`);
  }

  return { posicoes, result };
}

async function syncOnixsat(
  rastreadores: Rastreador[],
  config: PlataformaConfig
): Promise<{ posicoes: Posicao[]; result: SyncResult }> {
  const result: SyncResult = {
    plataforma: "onixsat",
    total: rastreadores.length,
    sucesso: 0,
    falhas: 0,
    erros: [],
  };
  const posicoes: Posicao[] = [];

  if (!config.enabled) {
    result.erros.push("API não configurada");
    result.falhas = rastreadores.length;
    return { posicoes, result };
  }

  // TODO: Implementar conforme documentação da Onixsat
  for (const rast of rastreadores) {
    result.falhas++;
    result.erros.push(`${rast.codigo}: API Onixsat não implementada`);
  }

  return { posicoes, result };
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("=".repeat(50));
  console.log(`[sync-rastreadores] Iniciando sincronização: ${new Date().toISOString()}`);

  try {
    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente SUPABASE não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar rastreadores instalados com id_plataforma
    const { data: rastreadores, error: errRast } = await supabase
      .from("rastreadores")
      .select("id, codigo, plataforma, id_plataforma")
      .eq("status", "instalado")
      .not("id_plataforma", "is", null);

    if (errRast) {
      throw new Error(`Erro ao buscar rastreadores: ${errRast.message}`);
    }

    // Filtrar rastreadores com id_plataforma vazio
    const rastreadoresValidos = (rastreadores || []).filter(
      (r) => r.id_plataforma && r.id_plataforma.trim() !== ""
    );

    if (rastreadoresValidos.length === 0) {
      console.log("[sync-rastreadores] Nenhum rastreador para sincronizar");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhum rastreador para sincronizar",
          total_rastreadores: 0,
          sincronizados: 0,
          duracao_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-rastreadores] Encontrados ${rastreadoresValidos.length} rastreadores`);

    // Agrupar rastreadores por plataforma
    const porPlataforma: Record<string, Rastreador[]> = {};
    for (const r of rastreadoresValidos) {
      const plat = r.plataforma || "outro";
      if (!porPlataforma[plat]) {
        porPlataforma[plat] = [];
      }
      porPlataforma[plat].push(r as Rastreador);
    }

    console.log(
      "[sync-rastreadores] Rastreadores por plataforma:",
      Object.entries(porPlataforma)
        .map(([k, v]) => `${k}: ${v.length}`)
        .join(", ")
    );

    // Obter configurações das plataformas
    const configs = getPlataformasConfig();

    // Sincronizar cada plataforma
    const todasPosicoes: Posicao[] = [];
    const resultados: SyncResult[] = [];

    for (const [plataforma, rasts] of Object.entries(porPlataforma)) {
      console.log(`[sync-rastreadores] Sincronizando ${plataforma} (${rasts.length} rastreadores)...`);

      let syncResult: { posicoes: Posicao[]; result: SyncResult };

      switch (plataforma) {
        case "rede_veiculos":
          syncResult = await syncRedeVeiculos(rasts, configs.rede_veiculos);
          break;
        case "sascar":
          syncResult = await syncSascar(rasts, configs.sascar);
          break;
        case "autotrac":
          syncResult = await syncAutotrac(rasts, configs.autotrac);
          break;
        case "onixsat":
          syncResult = await syncOnixsat(rasts, configs.onixsat);
          break;
        default:
          syncResult = {
            posicoes: [],
            result: {
              plataforma,
              total: rasts.length,
              sucesso: 0,
              falhas: rasts.length,
              erros: [`Plataforma "${plataforma}" não suportada`],
            },
          };
      }

      todasPosicoes.push(...syncResult.posicoes);
      resultados.push(syncResult.result);

      console.log(
        `[sync-rastreadores] ${plataforma}: ${syncResult.result.sucesso}/${syncResult.result.total} sucesso`
      );
    }

    // Salvar posições no banco (em lotes de 100)
    let posicoesInseridas = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < todasPosicoes.length; i += BATCH_SIZE) {
      const batch = todasPosicoes.slice(i, i + BATCH_SIZE);

      const { error: errPos } = await supabase.from("rastreador_posicoes").insert(batch);

      if (errPos) {
        console.error(`[sync-rastreadores] Erro ao inserir lote ${Math.floor(i / BATCH_SIZE) + 1}:`, errPos);
      } else {
        posicoesInseridas += batch.length;
      }
    }

    console.log(`[sync-rastreadores] ${posicoesInseridas} posições inseridas`);

    // Calcular totais
    const totalSucesso = resultados.reduce((sum, r) => sum + r.sucesso, 0);
    const totalFalhas = resultados.reduce((sum, r) => sum + r.falhas, 0);
    const duracao = Date.now() - startTime;

    console.log(`[sync-rastreadores] Concluído em ${duracao}ms`);
    console.log(`[sync-rastreadores] Sucesso: ${totalSucesso}, Falhas: ${totalFalhas}`);
    console.log("=".repeat(50));

    return new Response(
      JSON.stringify({
        success: true,
        total_rastreadores: rastreadoresValidos.length,
        sincronizados: totalSucesso,
        falhas: totalFalhas,
        posicoes_inseridas: posicoesInseridas,
        duracao_ms: duracao,
        plataformas: resultados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[sync-rastreadores] ERRO:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

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
