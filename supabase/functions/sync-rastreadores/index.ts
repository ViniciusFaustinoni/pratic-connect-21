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
  apiKey?: string;
  enabled: boolean;
  // Softruck específico
  publicKey?: string;
  username?: string;
  password?: string;
}

const getPlataformasConfig = (): Record<string, PlataformaConfig> => ({
  softruck: {
    baseUrl: Deno.env.get("SOFTRUCK_AMBIENTE") === "producao" 
      ? "https://api.softruck.com/v2"
      : "https://api.apiary.softruck.com/v2",
    publicKey: Deno.env.get("SOFTRUCK_PUBLIC_KEY") || "",
    username: Deno.env.get("SOFTRUCK_USERNAME") || "",
    password: Deno.env.get("SOFTRUCK_PASSWORD") || "",
    enabled: Boolean(Deno.env.get("SOFTRUCK_PUBLIC_KEY") && Deno.env.get("SOFTRUCK_USERNAME")),
  },
  rede_veiculos: {
    baseUrl: Deno.env.get("REDE_VEICULOS_AMBIENTE") === "producao"
      ? "https://integracao.redeveiculos.com/api/v2/prod"
      : "https://integracao.redeveiculos.com/api/v2/sandbox",
    apiKey: Deno.env.get("REDE_VEICULOS_TOKEN") || "",
    enabled: Boolean(Deno.env.get("REDE_VEICULOS_TOKEN")),
  },
});

// =====================================================
// TIPOS
// =====================================================

interface Rastreador {
  id: string;
  codigo: string;
  imei?: string;
  plataforma: string;
  id_plataforma: string;
  plataforma_device_id?: string;
  plataforma_veiculo_id?: string;
  // Dados do veículo e associado (para Rede Veículos)
  veiculo?: {
    placa?: string;
    chassi?: string;
    associado?: {
      cpf?: string;
      cnpj?: string;
    };
  };
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
// AUTENTICAÇÃO SOFTRUCK COM RETRY
// =====================================================

async function getSoftruckToken(
  supabase: any,
  config: PlataformaConfig,
  forceRefresh = false
): Promise<string> {
  // Verificar cache (se não forçar refresh)
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from("rastreadores_tokens_cache")
      .select("token, expires_at")
      .eq("plataforma", "softruck")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (cached?.token) {
      console.log("[Softruck] Usando token do cache");
      return cached.token;
    }
  }

  // Obter novo token
  console.log("[Softruck] Obtendo novo token...");
  
  const response = await fetch(`${config.baseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "public-key": config.publicKey || "",
    },
    body: JSON.stringify({
      username: config.username,
      password: config.password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha auth Softruck: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.data?.token) {
    throw new Error("Token Softruck não retornado na resposta");
  }

  // Buscar plataforma_id
  const { data: plataforma } = await supabase
    .from("rastreadores_config_plataformas")
    .select("id")
    .eq("plataforma", "softruck")
    .single();

  // Salvar no cache (expira em 6 dias)
  const expiresAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
  
  await supabase.from("rastreadores_tokens_cache").insert({
    plataforma: "softruck",
    plataforma_id: plataforma?.id || null,
    token: data.data.token,
    refresh_token: data.data.refresh_token || null,
    expires_at: expiresAt.toISOString(),
  });

  console.log("[Softruck] Novo token obtido e cacheado");
  return data.data.token;
}

// =====================================================
// FUNÇÕES DE SINCRONIZAÇÃO POR PLATAFORMA
// =====================================================

async function syncSoftruck(
  rastreadores: Rastreador[],
  config: PlataformaConfig,
  supabase: any
): Promise<{ posicoes: Posicao[]; result: SyncResult }> {
  const result: SyncResult = {
    plataforma: "softruck",
    total: rastreadores.length,
    sucesso: 0,
    falhas: 0,
    erros: [],
  };
  const posicoes: Posicao[] = [];

  if (!config.enabled) {
    result.erros.push("API Softruck não configurada (secrets faltando)");
    result.falhas = rastreadores.length;
    return { posicoes, result };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Para cada rastreador, buscar posição via softruck-api
  for (const rast of rastreadores) {
    try {
      // Usar IDs corretos da plataforma (endpoint v2 requer ambos)
      const vehicleId = rast.plataforma_veiculo_id;
      const deviceId = rast.plataforma_device_id;
      
      if (!vehicleId || !deviceId) {
        result.falhas++;
        result.erros.push(`${rast.codigo}: IDs de veículo/device não configurados`);
        continue;
      }
      
      console.log(`[Softruck] Buscando posição: ${rast.codigo}`);
      
      // Chamar softruck-api que já tem autenticação funcionando
      const response = await fetch(`${supabaseUrl}/functions/v1/softruck-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          operation: "tracking",
          data: {
            veiculoId: vehicleId,
            deviceId: deviceId,
          },
        }),
      });

      const responseData = await response.json();

      if (!responseData.success) {
        throw new Error(responseData.error || "Falha ao buscar tracking");
      }

      const trackingData = responseData.data;
      
      // Formato da API v2 Softruck:
      // - data.type = "Feature" (GeoJSON)
      // - data.attributes contém: ign, dir, spd, bl (bateria)
      // - data.attributes.geometry.coordinates = [longitude, latitude]
      const gpsFeature = trackingData?.data?.attributes || trackingData?.data || trackingData;
      
      // Extrair coordenadas do GeoJSON (coordinates = [lng, lat])
      let latitude: number | null = null;
      let longitude: number | null = null;
      
      if (gpsFeature?.geometry?.coordinates) {
        // GeoJSON: coordinates = [longitude, latitude]
        longitude = parseFloat(gpsFeature.geometry.coordinates[0]);
        latitude = parseFloat(gpsFeature.geometry.coordinates[1]);
      } else if (gpsFeature?.latitude && gpsFeature?.longitude) {
        // Formato alternativo com lat/lng direto
        latitude = parseFloat(gpsFeature.latitude);
        longitude = parseFloat(gpsFeature.longitude);
      }

      if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
        // Converter timestamp Unix para ISO string se necessário
        const actTimestamp = gpsFeature?.act;
        const dataPosicao = actTimestamp 
          ? new Date(actTimestamp * 1000).toISOString() 
          : (gpsFeature?.timestamp || new Date().toISOString());
        
        posicoes.push({
          rastreador_id: rast.id,
          latitude,
          longitude,
          velocidade: parseInt(gpsFeature?.spd || gpsFeature?.speed || 0),
          ignicao: Boolean(gpsFeature?.ign || gpsFeature?.ignition),
          data_posicao: dataPosicao,
          odometro: gpsFeature?.odometer || undefined,
          direcao: gpsFeature?.dir || gpsFeature?.heading || undefined,
          bateria_nivel: gpsFeature?.bl || gpsFeature?.battery || undefined,
        });
        result.sucesso++;
        console.log(`[Softruck] ${rast.codigo}: lat=${latitude}, lng=${longitude}, spd=${gpsFeature?.spd || 0}`);
      } else {
        result.falhas++;
        result.erros.push(`${rast.codigo}: Sem dados de posição na resposta`);
        console.warn(`[Softruck] ${rast.codigo}: Resposta sem lat/lng:`, JSON.stringify(trackingData).slice(0, 200));
      }
      
    } catch (error: unknown) {
      result.falhas++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.erros.push(`${rast.codigo}: ${errorMessage}`);
      console.error(`[Softruck] Erro no rastreador ${rast.codigo}:`, error);
    }
    
    // Rate limiting: delay entre requisições (Softruck limita 50 req/min)
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { posicoes, result };
}

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
    result.erros.push("API Rede Veículos não configurada (REDE_VEICULOS_TOKEN faltando)");
    result.falhas = rastreadores.length;
    return { posicoes, result };
  }

  for (const rast of rastreadores) {
    try {
      // Obter dados necessários para a API
      const imei = rast.imei || rast.codigo || '';
      const placa = rast.veiculo?.placa || '';
      const cpfCnpj = rast.veiculo?.associado?.cnpj || rast.veiculo?.associado?.cpf || '';
      
      if (!imei && !placa) {
        result.falhas++;
        result.erros.push(`${rast.codigo}: IMEI ou Placa não configurados`);
        continue;
      }
      
      if (!cpfCnpj) {
        result.falhas++;
        result.erros.push(`${rast.codigo}: CPF/CNPJ do associado não encontrado`);
        continue;
      }
      
      // Montar payload conforme documentação da API
      const payload = JSON.stringify({
        chassi: "",
        placa: placa || "",
        imei: imei || "",
        cpfCnpjCliente: cpfCnpj || ""
      });
      
      console.log(`[Rede Veículos] POST /obterUltimaPosicaoValida/ para ${rast.codigo}`);
      
      // Chamada à API da Rede Veículos usando endpoint correto
      const response = await fetch(
        `${config.baseUrl}/obterUltimaPosicaoValida/`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `json=${encodeURIComponent(payload)}`
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Mapear resposta da API conforme documentação
      if (data.latitude && data.longitude) {
        posicoes.push({
          rastreador_id: rast.id,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          velocidade: parseInt(data.velocidade || '0', 10),
          ignicao: data.ignicaoLigada === 'S',
          data_posicao: data.dataGPRS || data.dataGPS || new Date().toISOString(),
          odometro: undefined,
          direcao: data.direcao ? parseInt(data.direcao, 10) : undefined,
          bateria_nivel: data.voltagemBateria ? parseFloat(data.voltagemBateria) : undefined,
          sinal_gsm: undefined,
        });
        result.sucesso++;
        console.log(`[Rede Veículos] ${rast.codigo}: lat=${data.latitude}, lng=${data.longitude}`);
      } else {
        result.falhas++;
        result.erros.push(`${rast.codigo}: Sem dados de posição na resposta`);
        console.warn(`[Rede Veículos] ${rast.codigo}: Resposta sem lat/lng:`, JSON.stringify(data).slice(0, 200));
      }
    } catch (error: unknown) {
      result.falhas++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.erros.push(`${rast.codigo}: ${errorMessage}`);
      console.error(`[Rede Veículos] Erro no rastreador ${rast.codigo}:`, error);
    }
    
    // Rate limiting: delay entre requisições
    await new Promise(resolve => setTimeout(resolve, 200));
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
    // Verificar se foi solicitada uma plataforma específica
    let plataformaFiltro: string | null = null;
    try {
      const body = await req.json();
      plataformaFiltro = body?.plataforma || null;
    } catch {
      // Sem body ou body inválido - sincroniza todas
    }

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente SUPABASE não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar rastreadores instalados com dados de plataforma, veículo e associado
    let query = supabase
      .from("rastreadores")
      .select(`
        id, codigo, imei, plataforma, id_plataforma, plataforma_device_id, plataforma_veiculo_id,
        veiculo:veiculos(
          placa, chassi,
          associado:associados(cpf, cnpj)
        )
      `)
      .eq("status", "instalado");

    if (plataformaFiltro) {
      query = query.eq("plataforma", plataformaFiltro);
    }

    const { data: rastreadores, error: errRast } = await query;

    if (errRast) {
      throw new Error(`Erro ao buscar rastreadores: ${errRast.message}`);
    }

    // Filtrar rastreadores que possuem IDs de plataforma válidos
    // Para Softruck: precisa de plataforma_device_id E plataforma_veiculo_id
    // Para outras: precisa de id_plataforma
    const rastreadoresValidos = (rastreadores || []).filter((r) => {
      if (r.plataforma === 'softruck') {
        return r.plataforma_device_id && r.plataforma_veiculo_id;
      }
      return r.id_plataforma && r.id_plataforma.trim() !== "";
    });

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
        case "softruck":
          syncResult = await syncSoftruck(rasts, configs.softruck, supabase);
          break;
        case "rede_veiculos":
          syncResult = await syncRedeVeiculos(rasts, configs.rede_veiculos);
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
        results: resultados,
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
