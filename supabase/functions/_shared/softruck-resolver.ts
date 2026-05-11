// Resolução de IDs Softruck (vehicleId/deviceId) a partir do IMEI.
// Usado por rastreador-posicao e posicao-veiculo para auto-recuperação
// quando os IDs persistidos ficam stale (404 "Internal Service Error").

export function isRawImei(value: string | null | undefined): boolean {
  return !!value && /^\d{15,}$/.test(value);
}

/**
 * Detecta erros que indicam IDs stale na Softruck (não 5xx genéricos).
 */
export function isSoftruckStaleIdError(message: string): boolean {
  return /Internal Service Error|invalid vehicle|invalid device|not found|404/i.test(
    message,
  );
}

async function getSoftruckAuth(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  forceRefresh = false,
): Promise<{ token: string; publicKey: string }> {
  const authResponse = await fetch(
    `${supabaseUrl}/functions/v1/rastreador-auth`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ plataforma: 'softruck', force_refresh: forceRefresh }),
    },
  );
  const authData = await authResponse.json();
  if (!authData.success) {
    throw new Error('Falha na autenticação Softruck: ' + authData.error);
  }

  // Tenta credenciais híbridas para public_key
  let publicKey = '';
  try {
    const mod = await import('./credenciais-hibridas.ts');
    const cred = await mod.getCredenciaisSoftruck(supabase);
    publicKey = cred?.public_key || '';
  } catch {
    // ignore — fallback abaixo
  }
  if (!publicKey) {
    publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '';
  }
  return { token: authData.token, publicKey };
}

/**
 * Resolve hash deviceId/vehicleId da Softruck via IMEI e persiste no banco.
 * Retorna null quando não encontrar dispositivo na Softruck.
 */
export async function resolverSoftruckIdsPorImei(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  imei: string,
  rastreadorId: string,
  baseUrl: string,
): Promise<{ deviceId: string; vehicleId: string } | null> {
  if (!imei) return null;
  console.log(`[SoftruckResolver] Resolvendo IDs para IMEI ${imei}`);
  try {
    const { token, publicKey } = await getSoftruckAuth(
      supabase,
      supabaseUrl,
      supabaseKey,
      false,
    );
    const url = `${baseUrl}/devices/?filters[devices.imei][eq]=${imei}&includes[vehicle][]=plate`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'public-key': publicKey,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(
        `[SoftruckResolver] Falha ${response.status} ao resolver IMEI ${imei}: ${errText.slice(0, 200)}`,
      );
      return null;
    }
    const data = await response.json();
    const devices = data.data;
    if (!Array.isArray(devices) || devices.length === 0) {
      console.warn(`[SoftruckResolver] Nenhum device para IMEI ${imei}`);
      return null;
    }
    const device = devices[0];
    const deviceHashId = device.id;
    const vehicleHashId = device.relationships?.vehicle?.id || null;
    console.log(
      `[SoftruckResolver] IMEI ${imei} → device=${deviceHashId} vehicle=${vehicleHashId}`,
    );

    const updateData: Record<string, string> = {
      plataforma_device_id: deviceHashId,
      id_plataforma: deviceHashId,
    };
    if (vehicleHashId) updateData.plataforma_veiculo_id = vehicleHashId;

    await supabase.from('rastreadores').update(updateData).eq('id', rastreadorId);

    return {
      deviceId: deviceHashId,
      vehicleId: vehicleHashId || deviceHashId,
    };
  } catch (e) {
    console.error('[SoftruckResolver] Exceção:', e);
    return null;
  }
}
