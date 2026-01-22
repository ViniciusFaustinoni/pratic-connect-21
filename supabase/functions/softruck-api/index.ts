import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos
interface SoftruckAuthResult {
  token: string;
  expires_at: Date;
}

type SoftruckOperation = 
  | 'buscar-veiculo-placa'
  | 'criar-veiculo'
  | 'buscar-device-imei'
  | 'criar-device'
  | 'vincular-device-veiculo'
  | 'ativar-device'
  | 'desativar-device'
  | 'buscar-chip'
  | 'criar-chip'
  | 'tracking'
  | 'trajectories';

// Obter token de autenticação
async function getAuthToken(): Promise<string> {
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY');
  const username = Deno.env.get('SOFTRUCK_USERNAME');
  const password = Deno.env.get('SOFTRUCK_PASSWORD');

  if (!publicKey || !username || !password) {
    throw new Error('Credenciais Softruck não configuradas');
  }

  const baseUrl = 'https://api.softruck.com';
  
  const response = await fetch(`${baseUrl}/v2/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'public-key': publicKey,
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro de autenticação Softruck: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.token || data.access_token;
}

// Fazer requisição autenticada à API Softruck
async function softruckRequest(
  method: string,
  endpoint: string,
  token: string,
  body?: unknown
): Promise<unknown> {
  const baseUrl = 'https://api.softruck.com';
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) {
    options.body = JSON.stringify(body);
  }

  console.log(`[Softruck API] ${method} ${endpoint}`);
  
  const response = await fetch(`${baseUrl}${endpoint}`, options);
  
  const responseText = await response.text();
  console.log(`[Softruck API] Response status: ${response.status}`);
  
  if (!response.ok) {
    console.error(`[Softruck API] Error: ${responseText}`);
    throw new Error(`Softruck API error: ${response.status} - ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

// Mapear tipo de veículo local para Softruck
function mapVehicleType(combustivel: string | null): string {
  const mapping: Record<string, string> = {
    'gasolina': 'carro',
    'etanol': 'carro',
    'flex': 'carro',
    'diesel': 'caminhao',
    'eletrico': 'carro',
    'hibrido': 'carro',
    'gnv': 'carro',
  };
  
  return mapping[combustivel?.toLowerCase() || ''] || 'carro';
}

// Handler principal
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { operation, data } = await req.json() as { 
      operation: SoftruckOperation; 
      data: Record<string, unknown>;
    };

    console.log(`[Softruck API] Operation: ${operation}`, JSON.stringify(data));

    const enterpriseId = Deno.env.get('SOFTRUCK_ENTERPRISE_ID');
    if (!enterpriseId) {
      throw new Error('SOFTRUCK_ENTERPRISE_ID não configurado');
    }

    // Obter token
    const token = await getAuthToken();
    console.log('[Softruck API] Token obtido com sucesso');

    let result: unknown;

    switch (operation) {
      // ========== VEÍCULOS ==========
      case 'buscar-veiculo-placa': {
        const { placa } = data as { placa: string };
        const endpoint = `/v2/vehicles?filters[asset_vehicles.plate][eq]=${encodeURIComponent(placa)}`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'criar-veiculo': {
        const { placa, chassi, marca, modelo, ano, cor, tipo } = data as {
          placa: string;
          chassi?: string;
          marca?: string;
          modelo?: string;
          ano?: string;
          cor?: string;
          tipo?: string;
        };

        const vehicleData = {
          data: [{
            attributes: {
              plate: placa?.substring(0, 16),
              vin: chassi?.substring(0, 20),
              type: tipo || 'carro',
              brand: marca?.substring(0, 20),
              model: modelo?.substring(0, 20),
              year: ano?.substring(0, 10),
              color: cor?.substring(0, 7),
            },
            relationships: {
              enterprise: {
                type: 'enterprise',
                id: enterpriseId,
              },
            },
          }],
        };

        result = await softruckRequest('POST', '/v2/vehicles', token, vehicleData);
        break;
      }

      // ========== DISPOSITIVOS ==========
      case 'buscar-device-imei': {
        const { imei } = data as { imei: string };
        const endpoint = `/v2/devices?filters[devices.imei][eq]=${encodeURIComponent(imei)}`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'criar-device': {
        const { imei, nome, codigo, chipId, veiculoId, tipoId } = data as {
          imei: string;
          nome: string;
          codigo?: string;
          chipId?: string;
          veiculoId?: string;
          tipoId?: string;
        };

        const deviceData: Record<string, unknown> = {
          data: [{
            attributes: {
              name: nome?.substring(0, 21),
              imei: imei?.substring(0, 25),
              code: codigo?.substring(0, 20),
            },
            relationships: {
              enterprise: {
                type: 'enterprise',
                id: enterpriseId,
              },
            },
          }],
        };

        // Adicionar relacionamentos opcionais
        const relationships = (deviceData.data as Array<Record<string, unknown>>)[0].relationships as Record<string, unknown>;
        
        if (chipId) {
          relationships.chip = { type: 'chip', id: chipId };
        }
        if (veiculoId) {
          relationships.vehicle = { type: 'vehicle', id: veiculoId };
        }
        if (tipoId) {
          relationships.type = { type: 'type', id: tipoId };
        }

        result = await softruckRequest('POST', '/v2/devices', token, deviceData);
        break;
      }

      case 'vincular-device-veiculo': {
        const { deviceId, veiculoId } = data as { deviceId: string; veiculoId: string };

        const updateData = {
          data: {
            relationships: {
              vehicle: {
                type: 'vehicle',
                id: veiculoId,
              },
            },
          },
        };

        result = await softruckRequest('PATCH', `/v2/devices/${deviceId}`, token, updateData);
        break;
      }

      case 'ativar-device': {
        const { deviceId } = data as { deviceId: string };
        result = await softruckRequest('PATCH', `/v2/devices/${deviceId}/status/activation`, token);
        break;
      }

      case 'desativar-device': {
        const { deviceId } = data as { deviceId: string };
        result = await softruckRequest('PATCH', `/v2/devices/${deviceId}/status/deactivation`, token);
        break;
      }

      // ========== CHIPS ==========
      case 'buscar-chip': {
        const { serial } = data as { serial: string };
        const endpoint = `/v2/chips?filters[chips.serial][eq]=${encodeURIComponent(serial)}`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'criar-chip': {
        const { serial, numero, operadora, provedor } = data as {
          serial: string;
          numero?: string;
          operadora?: string;
          provedor?: string;
        };

        const chipData = {
          data: [{
            attributes: {
              serial: serial?.substring(0, 20),
              number: numero?.substring(0, 20),
              carrier: operadora?.substring(0, 255),
              service_provider: provedor?.substring(0, 50) || 'Softruck',
            },
            relationships: {
              enterprise: {
                type: 'enterprise',
                id: enterpriseId,
              },
            },
          }],
        };

        result = await softruckRequest('POST', '/v2/chips', token, chipData);
        break;
      }

      // ========== TRACKING ==========
      case 'tracking': {
        const { veiculoId, deviceId } = data as { veiculoId: string; deviceId: string };
        const endpoint = `/v2/vehicles/${veiculoId}/tracking/${deviceId}?includes[geocoder][]=address&includes[geocoder][]=display_name&format=JSON`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'trajectories': {
        const { veiculoId, dataInicio, dataFim } = data as { 
          veiculoId: string; 
          dataInicio?: string; 
          dataFim?: string;
        };
        let endpoint = `/v2/vehicles/${veiculoId}/trajectories`;
        if (dataInicio && dataFim) {
          endpoint += `?filters[fromAcc]=${dataInicio}&filters[toAcc]=${dataFim}`;
        }
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      default:
        throw new Error(`Operação não suportada: ${operation}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Softruck API] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
