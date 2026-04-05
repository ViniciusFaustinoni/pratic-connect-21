import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveSoftruckIds, getSoftruckAuthToken } from "../_shared/softruck-id-resolver.ts";

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
  veiculo_id?: string;
  veiculo?: {
    id?: string;
    placa?: string;
    chassi?: string;
    softruck_vehicle_id?: string;
    associado?: {
      cpf?: string;
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
// BUSCA PAGINADA DE RASTREADORES
// =====================================================

async function fetchAllRastreadoresInstalados(
  supabase: any,
  plataformaFiltro: string | null
): Promise<Rastreador[]> {
  const allRastreadores: Rastreador[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    let query = supabase
      .from("rastreadores")
      .select(`
        id, codigo, imei, plataforma, id_plataforma, plataforma_device_id, plataforma_veiculo_id, veiculo_id,
        veiculo:veiculos(
          id, placa, chassi, softruck_vehicle_id,
          associado:associados(cpf)
        )
      `)
      .eq("status", "instalado")
      .range(from, from + PAGE_SIZE - 1);

    if (plataformaFiltro) {
      query = query.eq("plataforma", plataformaFiltro);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar rastreadores (offset ${from}): ${error.message}`);
    }

    if (!data || data.length === 0) break;

    allRastreadores.push(...(data as Rastreador[]));
    console.log(`[sync-rastreadores] Página ${Math.floor(from / PAGE_SIZE) + 1}: ${data.length} registros`);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRastreadores;
}

// =====================================================
// ROUND-ROBIN: Controle de offset rotativo
// =====================================================

async function getRoundRobinOffset(supabase: any, plataforma: string): Promise<number> {
  const { data } = await supabase
    .from("rastreadores_config_plataformas")
    .select("config")
    .eq("plataforma", plataforma)
    .single();

  return (data?.config as any)?.sync_offset ?? 0;
}

async function saveRoundRobinOffset(supabase: any, plataforma: string, offset: number): Promise<void> {
  // Merge into existing config JSON
  const { data: existing } = await supabase
    .from("rastreadores_config_plataformas")
    .select("config")
    .eq("plataforma", plataforma)
    .single();

  const currentConfig = (existing?.config as Record<string, unknown>) || {};
  const newConfig = { ...currentConfig, sync_offset: offset };

  await supabase
    .from("rastreadores_config_plataformas")
    .update({ config: newConfig })
    .eq("plataforma", plataforma);
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
      // Resolve vehicle ID using shared resolver with fallback chain
      let vehicleId = rast.plataforma_veiculo_id;
      const deviceId = rast.plataforma_device_id;

      if (!deviceId) {
        result.falhas++;
        result.erros.push(`${rast.codigo}: device ID não configurado`);
        continue;
      }

      // If no vehicleId, try to resolve it
      if (!vehicleId) {
        // Quick check: cached on vehicle table
        vehicleId = rast.veiculo?.softruck_vehicle_id || null;
        
        if (vehicleId) {
          // Persist on rastreador for future syncs
          await supabase
            .from('rastreadores')
            .update({ plataforma_veiculo_id: vehicleId })
            .eq('id', rast.id);
          console.log(`[Softruck] ${rast.codigo}: vehicleId resolvido via cache veículo: ${vehicleId}`);
        }
      }

      if (!vehicleId) {
        result.falhas++;
        result.erros.push(`${rast.codigo}: vehicle ID não resolvido`);
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
      const gpsFeature = trackingData?.data?.attributes || trackingData?.data || trackingData;
      
      // Extrair coordenadas do GeoJSON (coordinates = [lng, lat])
      let latitude: number | null = null;
      let longitude: number | null = null;
      
      if (gpsFeature?.geometry?.coordinates) {
        longitude = parseFloat(gpsFeature.geometry.coordinates[0]);
        latitude = parseFloat(gpsFeature.geometry.coordinates[1]);
      } else if (gpsFeature?.latitude && gpsFeature?.longitude) {
        latitude = parseFloat(gpsFeature.latitude);
        longitude = parseFloat(gpsFeature.longitude);
      }

      if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
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
      const cpfCnpj = rast.veiculo?.associado?.cpf || '';
      
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
// ATUALIZAR ultima_comunicacao nos rastreadores
// =====================================================

async function atualizarUltimaComunicacao(supabase: any, posicoes: Posicao[]): Promise<number> {
  if (posicoes.length === 0) return 0;

  let atualizados = 0;

  // Agrupar por rastreador_id, manter a posição mais recente
  const mapaRecente: Record<string, Posicao> = {};
  for (const p of posicoes) {
    const atual = mapaRecente[p.rastreador_id];
    if (!atual || new Date(p.data_posicao) > new Date(atual.data_posicao)) {
      mapaRecente[p.rastreador_id] = p;
    }
  }

  // Update em lotes de 50
  const entries = Object.entries(mapaRecente);
  for (let i = 0; i < entries.length; i += 50) {
    const batch = entries.slice(i, i + 50);
    const promises = batch.map(([rastId, pos]) =>
      supabase
        .from("rastreadores")
        .update({
          ultima_comunicacao: pos.data_posicao,
          ultima_posicao_lat: pos.latitude,
          ultima_posicao_lng: pos.longitude,
          ultima_velocidade: pos.velocidade,
          ultima_ignicao: pos.ignicao,
        })
        .eq("id", rastId)
    );

    const results = await Promise.all(promises);
    atualizados += results.filter(r => !r.error).length;
  }

  console.log(`[sync-rastreadores] ${atualizados}/${entries.length} rastreadores atualizados (ultima_comunicacao)`);
  return atualizados;
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
    // Verificar se foi solicitada uma plataforma específica ou batch_size
    let plataformaFiltro: string | null = null;
    let batchSize = 200; // Default: processar 200 por execução
    try {
      const body = await req.json();
      plataformaFiltro = body?.plataforma || null;
      if (body?.batch_size) batchSize = Math.min(body.batch_size, 500);
    } catch {
      // Sem body ou body inválido - usa defaults
    }

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente SUPABASE não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========== BUSCA PAGINADA ==========
    // Buscar TODOS os rastreadores instalados (sem limite de 1000)
    const todosRastreadores = await fetchAllRastreadoresInstalados(supabase, plataformaFiltro);
    console.log(`[sync-rastreadores] Total de rastreadores instalados: ${todosRastreadores.length}`);

    // ========== FILTRAR VÁLIDOS ==========
    // Softruck: precisa de plataforma_device_id + alguma forma de resolver vehicleId
    // Rede Veículos: precisa de (imei OU codigo) + veículo com placa + associado com CPF
    const rastreadoresValidos = todosRastreadores.filter((r) => {
      if (r.plataforma === 'softruck') {
        if (!r.plataforma_device_id) return false;
        if (r.plataforma_veiculo_id) return true;
        if (r.veiculo?.softruck_vehicle_id) return true;
        if (r.veiculo?.placa) return true;
        return false;
      }
      if (r.plataforma === 'rede_veiculos') {
        // Aceitar se tiver (imei ou codigo) E veículo com placa E associado com CPF
        const temIdentificador = r.imei || r.codigo;
        const temPlaca = r.veiculo?.placa;
        const temCpf = r.veiculo?.associado?.cpf;
        return Boolean(temIdentificador && temPlaca && temCpf);
      }
      // Outras plataformas: exigir id_plataforma
      return r.id_plataforma && r.id_plataforma.trim() !== "";
    });

    console.log(`[sync-rastreadores] Rastreadores válidos para sync: ${rastreadoresValidos.length}`);

    if (rastreadoresValidos.length === 0) {
      console.log("[sync-rastreadores] Nenhum rastreador para sincronizar");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhum rastreador para sincronizar",
          total_rastreadores: 0,
          total_instalados: todosRastreadores.length,
          sincronizados: 0,
          duracao_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ROUND-ROBIN: Selecionar lote da vez ==========
    // Agrupar por plataforma
    const porPlataforma: Record<string, Rastreador[]> = {};
    for (const r of rastreadoresValidos) {
      const plat = r.plataforma || "outro";
      if (!porPlataforma[plat]) porPlataforma[plat] = [];
      porPlataforma[plat].push(r as Rastreador);
    }

    console.log(
      "[sync-rastreadores] Rastreadores válidos por plataforma:",
      Object.entries(porPlataforma)
        .map(([k, v]) => `${k}: ${v.length}`)
        .join(", ")
    );

    // Obter configurações das plataformas
    const configs = getPlataformasConfig();

    // Sincronizar cada plataforma com round-robin
    const todasPosicoes: Posicao[] = [];
    const resultados: SyncResult[] = [];

    for (const [plataforma, todosRasts] of Object.entries(porPlataforma)) {
      // Round-robin: pegar offset atual e selecionar sub-lote
      const offset = await getRoundRobinOffset(supabase, plataforma);
      const loteAtual = todosRasts.slice(offset, offset + batchSize);
      
      // Calcular próximo offset
      const proximoOffset = (offset + batchSize >= todosRasts.length) ? 0 : offset + batchSize;
      
      console.log(
        `[sync-rastreadores] ${plataforma}: lote ${offset}-${offset + loteAtual.length} de ${todosRasts.length} (próximo offset: ${proximoOffset})`
      );

      if (loteAtual.length === 0) {
        // Reset offset if we went past the end
        await saveRoundRobinOffset(supabase, plataforma, 0);
        continue;
      }

      let syncResult: { posicoes: Posicao[]; result: SyncResult };

      switch (plataforma) {
        case "softruck":
          syncResult = await syncSoftruck(loteAtual, configs.softruck, supabase);
          break;
        case "rede_veiculos":
          syncResult = await syncRedeVeiculos(loteAtual, configs.rede_veiculos);
          break;
        default:
          syncResult = {
            posicoes: [],
            result: {
              plataforma,
              total: loteAtual.length,
              sucesso: 0,
              falhas: loteAtual.length,
              erros: [`Plataforma "${plataforma}" não suportada`],
            },
          };
      }

      todasPosicoes.push(...syncResult.posicoes);
      resultados.push(syncResult.result);

      // Salvar próximo offset para a próxima execução
      await saveRoundRobinOffset(supabase, plataforma, proximoOffset);

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

    // ========== ATUALIZAR ultima_comunicacao ==========
    const rastreadoresAtualizados = await atualizarUltimaComunicacao(supabase, todasPosicoes);

    // Limpar posições com mais de 7 dias
    let posicoesRemovidas = 0;
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: deletados, error: errDelete } = await supabase
      .from("rastreador_posicoes")
      .delete({ count: 'exact' })
      .lt("data_posicao", seteDiasAtras);

    if (errDelete) {
      console.error("[sync-rastreadores] Erro ao limpar posições antigas:", errDelete);
    } else {
      posicoesRemovidas = deletados || 0;
      console.log(`[sync-rastreadores] ${posicoesRemovidas} posições antigas removidas (>7 dias)`);
    }

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
        total_instalados: todosRastreadores.length,
        total_validos: rastreadoresValidos.length,
        lote_processado: todasPosicoes.length > 0 ? batchSize : 0,
        sincronizados: totalSucesso,
        falhas: totalFalhas,
        posicoes_inseridas: posicoesInseridas,
        rastreadores_atualizados: rastreadoresAtualizados,
        posicoes_removidas: posicoesRemovidas,
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
