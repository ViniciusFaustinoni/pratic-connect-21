/**
 * Shared Softruck ID Resolver
 * 
 * Centralizes vehicle/device ID resolution for Softruck platform.
 * Resolution order:
 * 1. rastreadores.plataforma_veiculo_id (already known)
 * 2. veiculos.softruck_vehicle_id (cached from previous lookup)
 * 3. Softruck API lookup by plate
 * 4. Softruck API lookup by device relationship
 */

const BASE_URL = 'https://api.softruck.com';

interface ResolvedIds {
  deviceId: string;
  vehicleId: string;
  source: 'rastreador' | 'veiculo_cache' | 'api_placa' | 'api_device' | 'not_found';
  persisted: boolean;
}

interface ResolverOptions {
  supabase: any;
  rastreadorId: string;
  plataformaDeviceId: string | null;
  plataformaVeiculoId: string | null;
  veiculoId: string | null;
  veiculoPlaca: string | null;
  softruckVehicleId: string | null;
  token: string;
  publicKey: string;
  persistOnResolve?: boolean;
}

/**
 * Resolve Softruck IDs using multiple fallback strategies
 */
export async function resolveSoftruckIds(opts: ResolverOptions): Promise<ResolvedIds | null> {
  const {
    supabase,
    rastreadorId,
    plataformaDeviceId,
    plataformaVeiculoId,
    veiculoId,
    veiculoPlaca,
    softruckVehicleId,
    token,
    publicKey,
    persistOnResolve = true,
  } = opts;

  const deviceId = plataformaDeviceId;
  if (!deviceId) {
    console.warn(`[resolver] Rastreador ${rastreadorId}: sem plataforma_device_id`);
    return null;
  }

  // 1. Already has vehicleId on rastreador
  if (plataformaVeiculoId) {
    return { deviceId, vehicleId: plataformaVeiculoId, source: 'rastreador', persisted: true };
  }

  // 2. Cached on veiculos table
  if (softruckVehicleId) {
    if (persistOnResolve) {
      await persistVehicleId(supabase, rastreadorId, softruckVehicleId);
    }
    return { deviceId, vehicleId: softruckVehicleId, source: 'veiculo_cache', persisted: persistOnResolve };
  }

  // 3. Lookup by plate via Softruck API
  if (veiculoPlaca) {
    const vehicleByPlate = await lookupVehicleByPlate(token, publicKey, veiculoPlaca);
    if (vehicleByPlate) {
      if (persistOnResolve) {
        await persistBothIds(supabase, rastreadorId, veiculoId, vehicleByPlate);
      }
      return { deviceId, vehicleId: vehicleByPlate, source: 'api_placa', persisted: persistOnResolve };
    }
  }

  // 4. Lookup by device relationship
  const vehicleByDevice = await lookupVehicleByDevice(token, publicKey, deviceId);
  if (vehicleByDevice) {
    if (persistOnResolve) {
      await persistBothIds(supabase, rastreadorId, veiculoId, vehicleByDevice);
    }
    return { deviceId, vehicleId: vehicleByDevice, source: 'api_device', persisted: persistOnResolve };
  }

  return null;
}

/**
 * Lookup vehicle on Softruck by plate
 */
async function lookupVehicleByPlate(token: string, publicKey: string, placa: string): Promise<string | null> {
  try {
    const url = `${BASE_URL}/v2/vehicles?filters[vehicles.plate][eq]=${encodeURIComponent(placa)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'public-key': publicKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[resolver] Busca por placa ${placa} falhou: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data?.data?.length > 0) {
      const vehicleId = data.data[0].id;
      console.log(`[resolver] Placa ${placa} -> vehicleId ${vehicleId}`);
      return vehicleId;
    }

    return null;
  } catch (e) {
    console.error(`[resolver] Erro busca placa ${placa}:`, e);
    return null;
  }
}

/**
 * Lookup vehicle by device relationship on Softruck
 */
async function lookupVehicleByDevice(token: string, publicKey: string, deviceId: string): Promise<string | null> {
  try {
    // Check if deviceId is IMEI (all digits, 10+ chars)
    const isImei = /^\d{10,}$/.test(deviceId);
    
    let url: string;
    if (isImei) {
      url = `${BASE_URL}/v2/devices?filters[devices.imei][eq]=${encodeURIComponent(deviceId)}&includes[vehicle][]=plate`;
    } else {
      url = `${BASE_URL}/v2/devices/${deviceId}?includes[vehicle][]=plate`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'public-key': publicKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const result = await response.json();
    
    const device = isImei
      ? result?.data?.[0]
      : (Array.isArray(result?.data) ? result.data[0] : result?.data);

    if (!device) return null;

    // Extract vehicle ID from relationships
    const rel = device?.relationships?.vehicle;
    if (!rel) return null;
    
    const vehicleId = rel.id || rel.data?.id;
    if (vehicleId) {
      console.log(`[resolver] Device ${deviceId} -> vehicleId ${vehicleId}`);
    }
    return vehicleId || null;
  } catch (e) {
    console.error(`[resolver] Erro busca device ${deviceId}:`, e);
    return null;
  }
}

/**
 * Persist vehicleId on rastreador
 */
async function persistVehicleId(supabase: any, rastreadorId: string, vehicleId: string): Promise<void> {
  try {
    await supabase
      .from('rastreadores')
      .update({ plataforma_veiculo_id: vehicleId })
      .eq('id', rastreadorId);
  } catch (e) {
    console.error(`[resolver] Erro ao persistir vehicleId:`, e);
  }
}

/**
 * Persist vehicleId on both rastreador and veiculo tables
 */
async function persistBothIds(supabase: any, rastreadorId: string, veiculoId: string | null, vehicleId: string): Promise<void> {
  try {
    await supabase
      .from('rastreadores')
      .update({ plataforma_veiculo_id: vehicleId })
      .eq('id', rastreadorId);

    if (veiculoId) {
      await supabase
        .from('veiculos')
        .update({ softruck_vehicle_id: vehicleId })
        .eq('id', veiculoId);
    }
  } catch (e) {
    console.error(`[resolver] Erro ao persistir IDs:`, e);
  }
}

/**
 * Get Softruck auth token (via rastreador-auth edge function)
 */
export async function getSoftruckAuthToken(
  supabaseUrl: string,
  supabaseKey: string,
  forceRefresh = false
): Promise<{ token: string; publicKey: string }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/rastreador-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ plataforma: 'softruck', force_refresh: forceRefresh }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error('Falha na autenticação Softruck: ' + data.error);
  }

  return {
    token: data.token,
    publicKey: Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '',
  };
}
