import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredenciaisSoftruck, getCredenciaisRedeVeiculos } from "../_shared/credenciais-hibridas.ts";

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
  publicKey?: string;
  token?: string;
}

/**
 * Busca configuração das plataformas do BANCO DE DADOS (rastreadores_config_plataformas)
 * em vez de variáveis de ambiente. Isso garante que o ambiente correto (produção/sandbox)
 * seja usado, e que as credenciais venham do credenciais-hibridas (criptografadas).
 */
async function getPlataformasConfigFromDB(supabase: any): Promise<Record<string, PlataformaConfig>> {
  const configs: Record<string, PlataformaConfig> = {
    softruck: { baseUrl: "https://api.softruck.com/v2", enabled: false },
    rede_veiculos: { baseUrl: "https://integracao.redeveiculos.com/api/v2/prod", enabled: false },
  };

  try {
    // Buscar configurações de todas as plataformas do banco
    const { data: plataformas, error } = await supabase
      .from("rastreadores_config_plataformas")
      .select("plataforma, ambiente_atual, api_url_producao, api_url_sandbox, config");

    if (!error && plataformas) {
      for (const p of plataformas) {
        const url = p.ambiente_atual === "producao"
          ? (p.api_url_producao || configs[p.plataforma]?.baseUrl)
          : (p.api_url_sandbox || configs[p.plataforma]?.baseUrl);

        if (p.plataforma === "softruck") {
          const creds = await getCredenciaisSoftruck(supabase);
          if (creds) {
            configs.softruck = {
              baseUrl: url || "https://api.softruck.com/v2",
              publicKey: creds.public_key,
              enabled: true,
            };
          }
          console.log(`[Config] Softruck: ambiente=${p.ambiente_atual}, url=${configs.softruck.baseUrl}, enabled=${configs.softruck.enabled}`);
        }

        if (p.plataforma === "rede_veiculos") {
          const creds = await getCredenciaisRedeVeiculos(supabase);
          if (creds) {
            configs.rede_veiculos = {
              baseUrl: url || "https://integracao.redeveiculos.com/api/v2/prod",
              apiKey: creds.bearer_token,
              enabled: true,
            };
          }
          console.log(`[Config] Rede Veículos: ambiente=${p.ambiente_atual}, url=${configs.rede_veiculos.baseUrl}, enabled=${configs.rede_veiculos.enabled}`);
        }
      }
    }
  } catch (err) {
    console.error("[Config] Erro ao buscar config do banco:", err);
  }

  return configs;
}

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

  console.log("[Softruck] Obtendo novo token...");
  
  // Buscar credenciais do banco
  const creds = await getCredenciaisSoftruck(supabase);
  if (!creds) throw new Error("Credenciais Softruck não encontradas");

  const response = await fetch(`${config.baseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "public-key": creds.public_key,
    },
    body: JSON.stringify({
      username: creds.username,
      password: creds.password,
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

  const { data: plataforma } = await supabase
    .from("rastreadores_config_plataformas")
    .select("id")
    .eq("plataforma", "softruck")
    .single();

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
// RESOLVER IMEI BRUTO → HASH ID via API Softruck
// =====================================================

async function resolveImeiToDeviceId(
  token: string,
  publicKey: string,
  baseUrl: string,
  imei: string
): Promise<{ deviceHashId: string; vehicleId: string | null } | null> {
  try {
    const url = `${baseUrl}/devices?filters[devices.imei][eq]=${encodeURIComponent(imei)}&includes[vehicle][]=plate`;
    console.log(`[Softruck Resolver] Buscando device por IMEI: ${imei}`);

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "public-key": publicKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[Softruck Resolver] IMEI ${imei}: HTTP ${response.status}`);
      return null;
    }

    const result = await response.json();
    const device = result?.data?.[0];

    if (!device?.id) {
      console.warn(`[Softruck Resolver] IMEI ${imei}: device não encontrado na API`);
      return null;
    }

    const deviceHashId = device.id;
    const vehicleId = device?.relationships?.vehicle?.id
      || device?.relationships?.vehicle?.data?.id
      || null;

    console.log(`[Softruck Resolver] IMEI ${imei} → deviceId=${deviceHashId}, vehicleId=${vehicleId}`);
    return { deviceHashId, vehicleId };
  } catch (e) {
    console.error(`[Softruck Resolver] Erro ao resolver IMEI ${imei}:`, e);
    return null;
  }
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
    result.erros.push("API Softruck não configurada");
    result.falhas = rastreadores.length;
    return { posicoes, result };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Obter token Softruck para resolução de IMEIs
  let softruckToken: string | null = null;
  try {
    softruckToken = await getSoftruckToken(supabase, config);
  } catch (err) {
    console.error("[Softruck] Falha ao obter token para resolver IMEIs:", err);
  }

  let imeisResolvidos = 0;
  let imeisFalhas = 0;

  for (const rast of rastreadores) {
    try {
      let vehicleId = rast.plataforma_veiculo_id;
      let deviceId = rast.plataforma_device_id;

      if (!deviceId) {
        result.falhas++;
        result.erros.push(`${rast.codigo}: device ID não configurado`);
        continue;
      }

      // ========== CORREÇÃO 2: Resolver IMEI bruto → hash ID ==========
      const isRawImei = /^\d{10,}$/.test(deviceId);
      if (isRawImei && softruckToken && config.publicKey) {
        console.log(`[Softruck] ${rast.codigo}: IMEI bruto detectado (${deviceId}), resolvendo...`);
        const resolved = await resolveImeiToDeviceId(
          softruckToken,
          config.publicKey,
          config.baseUrl,
          deviceId
        );

        if (resolved) {
          // Atualizar no banco para futuras execuções
          const updateData: Record<string, string> = {
            plataforma_device_id: resolved.deviceHashId,
          };
          if (resolved.vehicleId) {
            updateData.plataforma_veiculo_id = resolved.vehicleId;
            vehicleId = resolved.vehicleId;
          }

          await supabase
            .from("rastreadores")
            .update(updateData)
            .eq("id", rast.id);

          // Também salvar no veículo se disponível
          if (resolved.vehicleId && rast.veiculo_id) {
            await supabase
              .from("veiculos")
              .update({ softruck_vehicle_id: resolved.vehicleId })
              .eq("id", rast.veiculo_id);
          }

          deviceId = resolved.deviceHashId;
          imeisResolvidos++;
          console.log(`[Softruck] ${rast.codigo}: IMEI resolvido → device=${deviceId}, vehicle=${vehicleId}`);
        } else {
          imeisFalhas++;
          result.falhas++;
          result.erros.push(`${rast.codigo}: IMEI ${deviceId} não encontrado na API Softruck`);
          continue;
        }

        // Rate limit para resolução de IMEI (extra delay)
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // If no vehicleId, try to resolve it from cache
      if (!vehicleId) {
        vehicleId = rast.veiculo?.softruck_vehicle_id || null;
        
        if (vehicleId) {
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
      const gpsFeature = trackingData?.data?.attributes || trackingData?.data || trackingData;
      
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
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  if (imeisResolvidos > 0 || imeisFalhas > 0) {
    console.log(`[Softruck] IMEIs resolvidos: ${imeisResolvidos}, falhas: ${imeisFalhas}`);
  }

  return { posicoes, result };
}

async function syncRedeVeiculos(
  rastreadores: Rastreador[],
  config: PlataformaConfig,
  supabase: any
): Promise<{ posicoes: Posicao[]; result: SyncResult }> {
  const result: SyncResult = {
    plataforma: "rede_veiculos",
    total: rastreadores.length,
    sucesso: 0,
    falhas: 0,
    erros: [],
  };
  const posicoes: Posicao[] = [];

  if (!config.enabled || !config.apiKey) {
    result.erros.push("API Rede Veículos não configurada (credenciais faltando)");
    result.falhas = rastreadores.length;
    return { posicoes, result };
  }

  for (const rast of rastreadores) {
    try {
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
      
      const payload = JSON.stringify({
        chassi: "",
        placa: placa || "",
        imei: imei || "",
        cpfCnpjCliente: cpfCnpj || ""
      });
      
      console.log(`[Rede Veículos] POST /obterUltimaPosicaoValida/ para ${rast.codigo}`);
      
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
      
      console.log(`[Rede Veículos] ${rast.codigo}: Resposta:`, JSON.stringify(data).slice(0, 300));

      if (data.error === 'true' || data.error === true) {
        const msg = typeof data.message === 'string' ? data.message : 'Erro na API';
        throw new Error(msg);
      }

      const posData = (typeof data.message === 'object' && data.message !== null) ? data.message : data;

      let lat: number | null = null;
      let lng: number | null = null;
      
      if (posData.latlon && typeof posData.latlon === 'string' && posData.latlon.includes('|')) {
        const parts = posData.latlon.split('|');
        lat = parseFloat(parts[0]);
        lng = parseFloat(parts[1]);
      } else if (posData.latitude && posData.longitude) {
        lat = parseFloat(posData.latitude);
        lng = parseFloat(posData.longitude);
      }

      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        posicoes.push({
          rastreador_id: rast.id,
          latitude: lat,
          longitude: lng,
          velocidade: parseInt(posData.velocidade || '0', 10),
          ignicao: posData.ignicaoLigada === 'S',
          data_posicao: posData.dataGPRS || posData.dataGPS || new Date().toISOString(),
          odometro: undefined,
          direcao: undefined,
          bateria_nivel: posData.voltagemBateria ? parseFloat(posData.voltagemBateria) : undefined,
          sinal_gsm: undefined,
        });
        result.sucesso++;
        console.log(`[Rede Veículos] ${rast.codigo}: lat=${lat}, lng=${lng}`);
      } else {
        result.falhas++;
        result.erros.push(`${rast.codigo}: Sem dados de posição. Campos: ${Object.keys(posData).join(', ')}`);
        console.warn(`[Rede Veículos] ${rast.codigo}: Resposta sem coords:`, JSON.stringify(data).slice(0, 300));
      }
    } catch (error: unknown) {
      result.falhas++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.erros.push(`${rast.codigo}: ${errorMessage}`);
      console.error(`[Rede Veículos] Erro no rastreador ${rast.codigo}:`, error);
    }
    
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

  const mapaRecente: Record<string, Posicao> = {};
  for (const p of posicoes) {
    const atual = mapaRecente[p.rastreador_id];
    if (!atual || new Date(p.data_posicao) > new Date(atual.data_posicao)) {
      mapaRecente[p.rastreador_id] = p;
    }
  }

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("=".repeat(50));
  console.log(`[sync-rastreadores] Iniciando sincronização: ${new Date().toISOString()}`);

  try {
    let plataformaFiltro: string | null = null;
    let batchSize = 200;
    try {
      const body = await req.json();
      plataformaFiltro = body?.plataforma || null;
      if (body?.batch_size) batchSize = Math.min(body.batch_size, 500);
    } catch {
      // Sem body ou body inválido
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente SUPABASE não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========== CORREÇÃO 1 & 3: Ler config do BANCO ==========
    const configs = await getPlataformasConfigFromDB(supabase);

    // ========== BUSCA PAGINADA ==========
    const todosRastreadores = await fetchAllRastreadoresInstalados(supabase, plataformaFiltro);
    console.log(`[sync-rastreadores] Total de rastreadores instalados: ${todosRastreadores.length}`);

    // ========== FILTRAR VÁLIDOS ==========
    const rastreadoresValidos = todosRastreadores.filter((r) => {
      if (r.plataforma === 'softruck') {
        // Aceitar também IMEIs brutos — serão resolvidos durante o sync
        if (!r.plataforma_device_id) return false;
        // Se for IMEI bruto, aceitar (será resolvido)
        if (/^\d{10,}$/.test(r.plataforma_device_id)) return true;
        // Se já tem hash, precisa de vehicleId
        if (r.plataforma_veiculo_id) return true;
        if (r.veiculo?.softruck_vehicle_id) return true;
        if (r.veiculo?.placa) return true;
        return false;
      }
      if (r.plataforma === 'rede_veiculos') {
        const temIdentificador = r.imei || r.codigo;
        const temPlaca = r.veiculo?.placa;
        const temCpf = r.veiculo?.associado?.cpf;
        return Boolean(temIdentificador && temPlaca && temCpf);
      }
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

    // ========== ROUND-ROBIN ==========
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

    const todasPosicoes: Posicao[] = [];
    const resultados: SyncResult[] = [];

    for (const [plataforma, todosRasts] of Object.entries(porPlataforma)) {
      const offset = await getRoundRobinOffset(supabase, plataforma);
      const loteAtual = todosRasts.slice(offset, offset + batchSize);
      const proximoOffset = (offset + batchSize >= todosRasts.length) ? 0 : offset + batchSize;
      
      console.log(
        `[sync-rastreadores] ${plataforma}: lote ${offset}-${offset + loteAtual.length} de ${todosRasts.length} (próximo offset: ${proximoOffset})`
      );

      if (loteAtual.length === 0) {
        await saveRoundRobinOffset(supabase, plataforma, 0);
        continue;
      }

      let syncResult: { posicoes: Posicao[]; result: SyncResult };

      switch (plataforma) {
        case "softruck":
          syncResult = await syncSoftruck(loteAtual, configs.softruck, supabase);
          break;
        case "rede_veiculos":
          syncResult = await syncRedeVeiculos(loteAtual, configs.rede_veiculos, supabase);
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

      await saveRoundRobinOffset(supabase, plataforma, proximoOffset);

      console.log(
        `[sync-rastreadores] ${plataforma}: ${syncResult.result.sucesso}/${syncResult.result.total} sucesso`
      );
    }

    // Salvar posições no banco
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

    const rastreadoresAtualizados = await atualizarUltimaComunicacao(supabase, todasPosicoes);

    // Limpar posições antigas (>7 dias)
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
