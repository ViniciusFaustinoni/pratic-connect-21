// Helper compartilhado de correção de vínculo Softruck.
// Usado por:
//   - softruck-corrigir-vinculo (edge one-off / botão Reprocessar do Monitoramento)
//   - softruck-ativar-dispositivo (auto-correção quando read-back detecta vehicle_divergente)
//
// Sequência:
//   1. (opcional) GET buscar-device-imei pra confirmar vehicle remoto atual.
//   2. Se remoteVehicleId existir E ≠ alvo → desvincular do veículo errado.
//   3. POST associar-device-veiculo no veículo correto (idempotente).
//   4. PATCH ativar-device + ativar-veiculo.
//   5. (opcional) GET final de confirmação.
//
// Nunca desvincula sem GET prévio confirmando divergência.

export interface CorrigirVinculoInput {
  imei: string;
  remoteDeviceId: string;          // softruck device id (vG1...)
  softruckVehicleIdAlvo: string;   // veículo correto na Softruck
  remoteVehicleIdAtual?: string | null; // se já conhecido (vindo do read-back do caller)
}

export interface CorrigirVinculoStep {
  etapa: string;
  ok: boolean;
  detalhe?: unknown;
  erro?: string;
}

export interface CorrigirVinculoResult {
  ok: boolean;
  remoteVehicleIdAntes: string | null;
  remoteVehicleIdDepois: string | null;
  remotePlateAntes: string | null;
  remotePlateDepois: string | null;
  steps: CorrigirVinculoStep[];
  motivoFalha?: string;
}

type CallSoftruck = (
  operation: string,
  data: Record<string, unknown>
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

function extrairVehicleDoDevice(remoteDevice: Record<string, any> | null | undefined): { id: string | null; plate: string | null } {
  if (!remoteDevice) return { id: null, plate: null };
  const id =
    remoteDevice?.relationships?.vehicle?.data?.id
    || remoteDevice?.relationships?.vehicle?.id
    || null;
  const plate =
    remoteDevice?.relationships?.vehicle?.data?.attributes?.plate
    || remoteDevice?.relationships?.vehicle?.attributes?.plate
    || null;
  return { id, plate };
}

async function readbackDevice(callSoftruck: CallSoftruck, imei: string): Promise<{
  ok: boolean;
  remoteDevice: Record<string, any> | null;
  vehicleId: string | null;
  plate: string | null;
  erro?: string;
}> {
  const resp = await callSoftruck('buscar-device-imei', { imei });
  if (!resp.success) return { ok: false, remoteDevice: null, vehicleId: null, plate: null, erro: resp.error };
  const list = (resp.data as { data?: Array<Record<string, any>> })?.data || [];
  const remoteDevice = list[0] || null;
  const { id, plate } = extrairVehicleDoDevice(remoteDevice);
  return { ok: true, remoteDevice, vehicleId: id, plate };
}

export async function corrigirVinculoSoftruck(
  callSoftruck: CallSoftruck,
  input: CorrigirVinculoInput
): Promise<CorrigirVinculoResult> {
  const steps: CorrigirVinculoStep[] = [];
  const { imei, remoteDeviceId, softruckVehicleIdAlvo } = input;

  // 1. Confirmação inicial (sempre — nunca desvincula sem GET)
  const inicial = await readbackDevice(callSoftruck, imei);
  steps.push({
    etapa: 'readback_inicial',
    ok: inicial.ok,
    detalhe: { vehicleId: inicial.vehicleId, plate: inicial.plate },
    erro: inicial.erro,
  });
  if (!inicial.ok) {
    return {
      ok: false,
      remoteVehicleIdAntes: input.remoteVehicleIdAtual ?? null,
      remoteVehicleIdDepois: null,
      remotePlateAntes: null,
      remotePlateDepois: null,
      steps,
      motivoFalha: `readback_inicial_falhou:${inicial.erro || 'sem_detalhe'}`,
    };
  }

  const remoteVehicleIdAntes = inicial.vehicleId;
  const remotePlateAntes = inicial.plate;

  // Caso já esteja correto: retorna ok sem fazer nada.
  if (remoteVehicleIdAntes && remoteVehicleIdAntes === softruckVehicleIdAlvo) {
    return {
      ok: true,
      remoteVehicleIdAntes,
      remoteVehicleIdDepois: remoteVehicleIdAntes,
      remotePlateAntes,
      remotePlateDepois: remotePlateAntes,
      steps,
    };
  }

  // 2. Desvincular do veículo errado (apenas se houver um errado)
  if (remoteVehicleIdAntes && remoteVehicleIdAntes !== softruckVehicleIdAlvo) {
    // Buscar associationId via listar-devices-veiculo(vehicleId=errado)
    const listResp = await callSoftruck('listar-devices-veiculo', { vehicleId: remoteVehicleIdAntes });
    let associationId: string | null = null;
    if (listResp.success) {
      const arr = (listResp.data as { data?: Array<Record<string, any>> })?.data || [];
      const match = arr.find((a) => {
        const devId = a?.relationships?.device?.data?.id || a?.relationships?.device?.id;
        const devImei = a?.relationships?.device?.attributes?.imei || a?.attributes?.imei;
        return devId === remoteDeviceId || (devImei && String(devImei).replace(/\D/g, '') === imei.replace(/\D/g, ''));
      });
      associationId = (match as any)?.id || null;
    }
    steps.push({
      etapa: 'localizar_association',
      ok: !!associationId,
      detalhe: { vehicleErrado: remoteVehicleIdAntes, associationId },
      erro: listResp.success ? (associationId ? undefined : 'association_nao_encontrada') : listResp.error,
    });

    if (associationId) {
      const desRes = await callSoftruck('desassociar-device-veiculo', { associationId });
      steps.push({
        etapa: 'desassociar_veiculo_errado',
        ok: desRes.success,
        detalhe: desRes.data,
        erro: desRes.error,
      });
      if (!desRes.success) {
        return {
          ok: false,
          remoteVehicleIdAntes, remoteVehicleIdDepois: remoteVehicleIdAntes,
          remotePlateAntes, remotePlateDepois: remotePlateAntes,
          steps,
          motivoFalha: `desassociar_falhou:${desRes.error || 'sem_detalhe'}`,
        };
      }
    }
    // Se não achou associationId mas device aponta pra outro veículo, ainda tentamos vincular —
    // o POST de associação pode rejeitar duplicado, mas então o read-back final mostrará a verdade.
  }

  // 3. Vincular ao veículo correto (idempotente — trata "Already Exists")
  const assocRes = await callSoftruck('associar-device-veiculo', {
    deviceId: remoteDeviceId,
    vehicleId: softruckVehicleIdAlvo,
    isPrincipal: true,
  });
  const assocOk =
    assocRes.success
    || (assocRes.error?.includes('Already Exists') ?? false)
    || (assocRes.error?.includes('already associated') ?? false)
    || (assocRes.error?.includes('Already Has Main Device') ?? false);
  steps.push({
    etapa: 'associar_veiculo_correto',
    ok: assocOk,
    detalhe: assocRes.data,
    erro: assocOk ? undefined : assocRes.error,
  });
  if (!assocOk) {
    return {
      ok: false,
      remoteVehicleIdAntes, remoteVehicleIdDepois: remoteVehicleIdAntes,
      remotePlateAntes, remotePlateDepois: remotePlateAntes,
      steps,
      motivoFalha: `associar_falhou:${assocRes.error || 'sem_detalhe'}`,
    };
  }

  // 4. Ativar device + veículo (idempotentes; warning não bloqueia)
  const ativDev = await callSoftruck('ativar-device', { deviceId: remoteDeviceId });
  steps.push({ etapa: 'ativar_device', ok: ativDev.success, erro: ativDev.error });
  const ativVeic = await callSoftruck('ativar-veiculo', { veiculoId: softruckVehicleIdAlvo });
  steps.push({ etapa: 'ativar_veiculo', ok: ativVeic.success, erro: ativVeic.error });

  // 5. Read-back final
  const final = await readbackDevice(callSoftruck, imei);
  steps.push({
    etapa: 'readback_final',
    ok: final.ok,
    detalhe: { vehicleId: final.vehicleId, plate: final.plate },
    erro: final.erro,
  });
  const okFinal = final.ok && final.vehicleId === softruckVehicleIdAlvo;

  return {
    ok: okFinal,
    remoteVehicleIdAntes,
    remoteVehicleIdDepois: final.vehicleId,
    remotePlateAntes,
    remotePlateDepois: final.plate,
    steps,
    motivoFalha: okFinal
      ? undefined
      : `readback_final_divergente:remoto=${final.vehicleId || 'null'}/alvo=${softruckVehicleIdAlvo}`,
  };
}

// Helper de chamada à edge softruck-api (default impl). O caller passa pra
// corrigirVinculoSoftruck — assim o helper não precisa conhecer URLs/keys.
export function buildCallSoftruckApi(supabaseUrl: string, supabaseKey: string): CallSoftruck {
  return async (operation, data) => {
    const resp = await fetch(`${supabaseUrl}/functions/v1/softruck-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ operation, data }),
    });
    return await resp.json();
  };
}
