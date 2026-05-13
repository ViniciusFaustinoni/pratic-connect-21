/**
 * Extrai vínculo Softruck (veículo + motorista + cliente + dispositivo) das
 * payloads "v2/vehicles" e "v2/devices" com `includes`.
 */
function pickRel(vehicle: any, key: string): any | null {
  const rel = vehicle?.relationships?.[key];
  if (!rel) return null;
  if (rel.data && typeof rel.data === 'object') return rel.data;
  return rel;
}

export function extractVinculoSoftruck(vehicle: any, device: any): any {
  if (!vehicle && !device) return null;
  const driver = pickRel(vehicle, 'driver');
  const client = pickRel(vehicle, 'client');
  const group = pickRel(vehicle, 'group');
  const brand = pickRel(vehicle, 'brand');
  const model = pickRel(vehicle, 'model');
  const color = pickRel(vehicle, 'color');
  return {
    veiculo: vehicle ? {
      id: vehicle.id ? String(vehicle.id) : null,
      placa: vehicle?.attributes?.plate ?? null,
      chassi: vehicle?.attributes?.chassis ?? vehicle?.attributes?.vin ?? null,
      ano: vehicle?.attributes?.year ?? null,
      marca: brand?.attributes?.name ?? null,
      modelo: model?.attributes?.name ?? null,
      cor: color?.attributes?.name ?? null,
      grupo: group?.attributes?.name ?? null,
    } : null,
    motorista: driver ? {
      nome: driver?.attributes?.name ?? null,
      documento: driver?.attributes?.document ?? null,
      telefone: driver?.attributes?.phone ?? null,
    } : null,
    cliente: client ? {
      nome: client?.attributes?.name ?? null,
      documento: client?.attributes?.document ?? null,
      email: client?.attributes?.email ?? null,
      telefone: client?.attributes?.phone ?? null,
    } : null,
    dispositivo: device ? {
      imei: device?.attributes?.imei ?? null,
      modelo: device?.attributes?.model ?? null,
    } : null,
  };
}
