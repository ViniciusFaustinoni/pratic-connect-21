import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://api.softruck.com';

// ========== TIPOS ==========

type SoftruckOperation = 
  // Status/Health
  | 'health'
  // Enterprises
  | 'listar-enterprises'
  | 'buscar-enterprise'
  | 'descobrir-enterprise-id'
  // Veículos
  | 'buscar-veiculo-placa'
  | 'buscar-veiculo-id'
  | 'listar-veiculos'
  | 'criar-veiculo'
  | 'atualizar-veiculo'
  | 'deletar-veiculo'
  | 'ativar-veiculo'
  | 'desativar-veiculo'
  // Dispositivos
  | 'buscar-device-imei'
  | 'buscar-device-id'
  | 'listar-devices'
  | 'criar-device'
  | 'atualizar-device'
  | 'deletar-device'
  | 'ativar-device'
  | 'desativar-device'
  | 'vincular-device-veiculo'
  // Chips
  | 'listar-chips'
  | 'buscar-chip'
  | 'criar-chip'
  | 'atualizar-chip'
  | 'deletar-chip'
  // Usuários
  | 'listar-usuarios'
  | 'buscar-usuario'
  | 'criar-usuario'
  | 'atualizar-usuario'
  | 'deletar-usuario'
  | 'ativar-usuario'
  | 'desativar-usuario'
  // Associações Device-Veículo
  | 'associar-device-veiculo'
  | 'desassociar-device-veiculo'
  | 'listar-devices-veiculo'
  | 'atualizar-device-principal'
  // Associações Usuário-Veículo
  | 'associar-usuario-veiculo'
  | 'desassociar-usuario-veiculo'
  | 'listar-usuarios-veiculo'
  // Tracking
  | 'tracking'
  | 'trajectories'
  | 'trajectories-geom'
  | 'trajectories-by-keys';

// ========== AUTENTICAÇÃO ==========

async function getAuthToken(): Promise<string> {
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY');
  const username = Deno.env.get('SOFTRUCK_USERNAME');
  const password = Deno.env.get('SOFTRUCK_PASSWORD');

  if (!publicKey || !username || !password) {
    throw new Error('Credenciais Softruck não configuradas (SOFTRUCK_PUBLIC_KEY, SOFTRUCK_USERNAME, SOFTRUCK_PASSWORD)');
  }

  console.log('[Softruck Auth] Obtendo token...');
  
  const response = await fetch(`${BASE_URL}/v2/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'public-key': publicKey,
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Softruck Auth] Erro:', response.status, errorText);
    throw new Error(`Erro de autenticação Softruck: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('[Softruck Auth] Token obtido com sucesso');
  return data.token || data.access_token || data.data?.token;
}

function getPublicKey(): string {
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY');
  if (!publicKey) {
    throw new Error('SOFTRUCK_PUBLIC_KEY não configurado');
  }
  return publicKey;
}

function getEnterpriseId(): string {
  const enterpriseId = Deno.env.get('SOFTRUCK_ENTERPRISE_ID');
  if (!enterpriseId) {
    throw new Error('SOFTRUCK_ENTERPRISE_ID não configurado. Execute "descobrir-enterprise-id" primeiro.');
  }
  return enterpriseId;
}

// ========== REQUISIÇÃO GENÉRICA ==========

async function softruckRequest(
  method: string,
  endpoint: string,
  token: string,
  body?: unknown
): Promise<unknown> {
  const publicKey = getPublicKey();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'public-key': publicKey,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) {
    options.body = JSON.stringify(body);
  }

  const fullUrl = `${BASE_URL}${endpoint}`;
  console.log(`[Softruck API] ${method} ${endpoint}`);
  
  const response = await fetch(fullUrl, options);
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

// ========== MAPEAMENTOS ==========

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

// ========== HANDLER PRINCIPAL ==========

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let operation: SoftruckOperation = 'health';
  let logData: Record<string, unknown> = {};

  try {
    const { operation: op, data } = await req.json() as { 
      operation: SoftruckOperation; 
      data: Record<string, unknown>;
    };
    operation = op;
    logData = { operation, data };

    console.log(`[Softruck API] Operation: ${operation}`, JSON.stringify(data));

    let result: unknown;
    let token: string;

    // Health check não precisa de autenticação
    if (operation === 'health') {
      const healthResponse = await fetch(`${BASE_URL}/health`);
      result = { 
        status: healthResponse.ok ? 'ok' : 'error', 
        statusCode: healthResponse.status 
      };
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter token para demais operações
    token = await getAuthToken();

    switch (operation) {
      // ========== ENTERPRISES ==========
      
      case 'listar-enterprises': {
        const { limit = 100, page = 1, search } = data as { 
          limit?: number; 
          page?: number; 
          search?: string;
        };
        let endpoint = `/v2/enterprises?attributes[]=name&attributes[]=cnpj&attributes[]=timezone&attributes[]=fantasy_name&limit=${limit}&page=${page}`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'buscar-enterprise': {
        const { enterpriseId } = data as { enterpriseId: string };
        if (!enterpriseId) throw new Error('enterpriseId é obrigatório');
        const endpoint = `/v2/enterprises/${enterpriseId}?attributes[]=name&attributes[]=cnpj&attributes[]=timezone&attributes[]=fantasy_name&attributes[]=phone1&attributes[]=email`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'descobrir-enterprise-id': {
        const { cnpj } = data as { cnpj?: string };
        let endpoint = `/v2/enterprises?attributes[]=name&attributes[]=cnpj&limit=10`;
        if (cnpj) {
          endpoint = `/v2/enterprises?filters[enterprises.cnpj][eq]=${encodeURIComponent(cnpj.replace(/\D/g, ''))}`;
        }
        
        const response = await softruckRequest('GET', endpoint, token) as { 
          data?: Array<{ id: string; attributes?: { name?: string; cnpj?: string } }> 
        };
        
        const enterprises = response?.data || [];
        if (enterprises.length === 0) {
          throw new Error('Nenhuma enterprise encontrada na conta Softruck');
        }
        
        result = {
          enterprise_id: enterprises[0].id,
          nome: enterprises[0].attributes?.name,
          cnpj: enterprises[0].attributes?.cnpj,
          total_encontradas: enterprises.length,
        };
        break;
      }

      // ========== VEÍCULOS ==========

      case 'listar-veiculos': {
        const { limit = 50, page = 1, search } = data as { 
          limit?: number; 
          page?: number; 
          search?: string;
        };
        let endpoint = `/v2/vehicles?attributes[]=plate&attributes[]=vin&attributes[]=type&attributes[]=brand&attributes[]=model&attributes[]=year&attributes[]=color&limit=${limit}&page=${page}`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'buscar-veiculo-placa': {
        const { placa } = data as { placa: string };
        if (!placa) throw new Error('placa é obrigatória');
        const endpoint = `/v2/vehicles?filters[asset_vehicles.plate][eq]=${encodeURIComponent(placa.toUpperCase().replace(/[^A-Z0-9]/g, ''))}`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'buscar-veiculo-id': {
        const { veiculoId } = data as { veiculoId: string };
        if (!veiculoId) throw new Error('veiculoId é obrigatório');
        const endpoint = `/v2/vehicles/${veiculoId}?includes[devices][]=name&includes[devices][]=imei&includes[enterprise][]=name`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'criar-veiculo': {
        const { placa, chassi, marca, modelo, ano, cor, tipo, codigo, descricao, enterpriseId } = data as {
          placa: string;
          chassi?: string;
          marca?: string;
          modelo?: string;
          ano?: string;
          cor?: string;
          tipo?: string;
          codigo?: string;
          descricao?: string;
          enterpriseId?: string;
        };

        const vehicleData = {
          data: [{
            attributes: {
              plate: placa?.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 16),
              vin: chassi?.substring(0, 20),
              type: tipo || 'carro',
              brand: marca?.substring(0, 20),
              model: modelo?.substring(0, 20),
              year: ano?.substring(0, 10),
              color: cor?.substring(0, 7),
              code: codigo?.substring(0, 16),
              description: descricao?.substring(0, 20),
            },
            relationships: {
              enterprise: {
                type: 'enterprise',
                id: enterpriseId || getEnterpriseId(),
              },
            },
          }],
        };

        result = await softruckRequest('POST', '/v2/vehicles', token, vehicleData);
        break;
      }

      case 'atualizar-veiculo': {
        const { veiculoId, placa, chassi, marca, modelo, ano, cor, tipo } = data as {
          veiculoId: string;
          placa?: string;
          chassi?: string;
          marca?: string;
          modelo?: string;
          ano?: string;
          cor?: string;
          tipo?: string;
        };

        if (!veiculoId) throw new Error('veiculoId é obrigatório');

        const updateData: Record<string, unknown> = { data: { attributes: {} } };
        const attrs = (updateData.data as Record<string, unknown>).attributes as Record<string, unknown>;
        
        if (placa) attrs.plate = placa.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 16);
        if (chassi) attrs.vin = chassi.substring(0, 20);
        if (marca) attrs.brand = marca.substring(0, 20);
        if (modelo) attrs.model = modelo.substring(0, 20);
        if (ano) attrs.year = ano.substring(0, 10);
        if (cor) attrs.color = cor.substring(0, 7);
        if (tipo) attrs.type = tipo;

        result = await softruckRequest('PATCH', `/v2/vehicles/${veiculoId}`, token, updateData);
        break;
      }

      case 'deletar-veiculo': {
        const { veiculoId } = data as { veiculoId: string };
        if (!veiculoId) throw new Error('veiculoId é obrigatório');
        
        const deleteData = {
          data: [{ type: 'vehicles', id: veiculoId }],
        };
        result = await softruckRequest('DELETE', '/v2/vehicles', token, deleteData);
        break;
      }

      case 'ativar-veiculo': {
        const { veiculoId } = data as { veiculoId: string };
        if (!veiculoId) throw new Error('veiculoId é obrigatório');
        result = await softruckRequest('PATCH', `/v2/vehicles/${veiculoId}/status/activation`, token);
        break;
      }

      case 'desativar-veiculo': {
        const { veiculoId } = data as { veiculoId: string };
        if (!veiculoId) throw new Error('veiculoId é obrigatório');
        result = await softruckRequest('PATCH', `/v2/vehicles/${veiculoId}/status/deactivation`, token);
        break;
      }

      // ========== DISPOSITIVOS ==========

      case 'listar-devices': {
        const { limit = 50, page = 1, search } = data as { 
          limit?: number; 
          page?: number; 
          search?: string;
        };
        let endpoint = `/v2/devices?attributes[]=name&attributes[]=imei&attributes[]=code&includes[vehicle][]=plate&includes[chip][]=serial&limit=${limit}&page=${page}`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'buscar-device-imei': {
        const { imei } = data as { imei: string };
        if (!imei) throw new Error('imei é obrigatório');
        const endpoint = `/v2/devices?filters[devices.imei][eq]=${encodeURIComponent(imei.replace(/\D/g, ''))}`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'buscar-device-id': {
        const { deviceId } = data as { deviceId: string };
        if (!deviceId) throw new Error('deviceId é obrigatório');
        const endpoint = `/v2/devices/${deviceId}?includes[chip][]=serial&includes[chip][]=number&includes[vehicle][]=plate&includes[enterprise][]=name`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'criar-device': {
        const { imei, nome, codigo, batch, chipId, veiculoId, tipoId, enterpriseId } = data as {
          imei: string;
          nome: string;
          codigo?: string;
          batch?: string;
          chipId?: string;
          veiculoId?: string;
          tipoId?: string;
          enterpriseId?: string;
        };

        const deviceData: Record<string, unknown> = {
          data: [{
            attributes: {
              name: nome?.substring(0, 21),
              imei: imei?.replace(/\D/g, '').substring(0, 25),
              code: codigo?.substring(0, 20),
              batch: batch?.substring(0, 50),
            },
            relationships: {
              enterprise: {
                type: 'enterprise',
                id: enterpriseId || getEnterpriseId(),
              },
            },
          }],
        };

        const relationships = ((deviceData.data as Array<Record<string, unknown>>)[0].relationships) as Record<string, unknown>;
        
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

      case 'atualizar-device': {
        const { deviceId, nome, codigo, batch, chipId, veiculoId } = data as {
          deviceId: string;
          nome?: string;
          codigo?: string;
          batch?: string;
          chipId?: string;
          veiculoId?: string;
        };

        if (!deviceId) throw new Error('deviceId é obrigatório');

        const updateData: Record<string, unknown> = { 
          data: { 
            attributes: {},
            relationships: {},
          } 
        };
        const dataObj = updateData.data as Record<string, unknown>;
        const attrs = dataObj.attributes as Record<string, unknown>;
        const rels = dataObj.relationships as Record<string, unknown>;
        
        if (nome) attrs.name = nome.substring(0, 21);
        if (codigo) attrs.code = codigo.substring(0, 20);
        if (batch) attrs.batch = batch.substring(0, 50);
        
        if (chipId) rels.chip = { type: 'chip', id: chipId };
        if (veiculoId) rels.vehicle = { type: 'vehicle', id: veiculoId };

        result = await softruckRequest('PATCH', `/v2/devices/${deviceId}`, token, updateData);
        break;
      }

      case 'deletar-device': {
        const { deviceId } = data as { deviceId: string };
        if (!deviceId) throw new Error('deviceId é obrigatório');
        
        const deleteData = {
          data: [{ type: 'devices', id: deviceId }],
        };
        result = await softruckRequest('DELETE', '/v2/devices', token, deleteData);
        break;
      }

      case 'vincular-device-veiculo': {
        const { deviceId, veiculoId } = data as { deviceId: string; veiculoId: string };
        if (!deviceId || !veiculoId) throw new Error('deviceId e veiculoId são obrigatórios');

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
        if (!deviceId) throw new Error('deviceId é obrigatório');
        result = await softruckRequest('PATCH', `/v2/devices/${deviceId}/status/activation`, token);
        break;
      }

      case 'desativar-device': {
        const { deviceId } = data as { deviceId: string };
        if (!deviceId) throw new Error('deviceId é obrigatório');
        result = await softruckRequest('PATCH', `/v2/devices/${deviceId}/status/deactivation`, token);
        break;
      }

      // ========== CHIPS ==========

      case 'listar-chips': {
        const { limit = 50, page = 1, search } = data as { 
          limit?: number; 
          page?: number; 
          search?: string;
        };
        let endpoint = `/v2/chips?attributes[]=serial&attributes[]=number&attributes[]=carrier&attributes[]=service_provider&includes[device][]=name&includes[device][]=imei&limit=${limit}&page=${page}`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'buscar-chip': {
        const { serial, chipId } = data as { serial?: string; chipId?: string };
        
        if (chipId) {
          const endpoint = `/v2/chips/${chipId}?includes[device][]=name&includes[device][]=imei`;
          result = await softruckRequest('GET', endpoint, token);
        } else if (serial) {
          const endpoint = `/v2/chips?filters[chips.serial][eq]=${encodeURIComponent(serial)}`;
          result = await softruckRequest('GET', endpoint, token);
        } else {
          throw new Error('serial ou chipId é obrigatório');
        }
        break;
      }

      case 'criar-chip': {
        const { serial, numero, operadora, provedor, batch, enterpriseId } = data as {
          serial: string;
          numero: string;
          operadora?: string;
          provedor: string;
          batch?: string;
          enterpriseId?: string;
        };

        const chipData = {
          data: [{
            attributes: {
              serial: serial?.replace(/\D/g, '').substring(0, 20),
              number: numero?.replace(/\D/g, '').substring(0, 20),
              carrier: operadora?.substring(0, 255) || 'Softruck',
              service_provider: provedor?.substring(0, 50),
              batch: batch?.substring(0, 50),
            },
            relationships: {
              enterprise: {
                type: 'enterprise',
                id: enterpriseId || getEnterpriseId(),
              },
            },
          }],
        };

        result = await softruckRequest('POST', '/v2/chips', token, chipData);
        break;
      }

      case 'atualizar-chip': {
        const { chipId, serial, numero, operadora, provedor } = data as {
          chipId: string;
          serial?: string;
          numero?: string;
          operadora?: string;
          provedor?: string;
        };

        if (!chipId) throw new Error('chipId é obrigatório');

        const updateData: Record<string, unknown> = { data: { attributes: {} } };
        const attrs = ((updateData.data as Record<string, unknown>).attributes) as Record<string, unknown>;
        
        if (serial) attrs.serial = serial.replace(/\D/g, '').substring(0, 20);
        if (numero) attrs.number = numero.replace(/\D/g, '').substring(0, 20);
        if (operadora) attrs.carrier = operadora.substring(0, 255);
        if (provedor) attrs.service_provider = provedor.substring(0, 50);

        result = await softruckRequest('PATCH', `/v2/chips/${chipId}`, token, updateData);
        break;
      }

      case 'deletar-chip': {
        const { chipId } = data as { chipId: string };
        if (!chipId) throw new Error('chipId é obrigatório');
        
        const deleteData = {
          data: [{ type: 'chips', id: chipId }],
        };
        result = await softruckRequest('DELETE', '/v2/chips', token, deleteData);
        break;
      }

      // ========== USUÁRIOS ==========

      case 'listar-usuarios': {
        const { limit = 50, page = 1, search } = data as { 
          limit?: number; 
          page?: number; 
          search?: string;
        };
        let endpoint = `/v2/users?attributes[]=username&attributes[]=name&attributes[]=email&attributes[]=cpf&attributes[]=phone1&limit=${limit}&page=${page}`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'buscar-usuario': {
        const { userId, username, cpf, email } = data as { 
          userId?: string; 
          username?: string;
          cpf?: string;
          email?: string;
        };
        
        if (userId) {
          const endpoint = `/v2/users/${userId}?attributes[]=username&attributes[]=name&attributes[]=email&attributes[]=cpf&attributes[]=phone1`;
          result = await softruckRequest('GET', endpoint, token);
        } else if (username) {
          const endpoint = `/v2/users?filters[users.username][eq]=${encodeURIComponent(username)}`;
          result = await softruckRequest('GET', endpoint, token);
        } else if (cpf) {
          const endpoint = `/v2/users?filters[users.cpf][eq]=${encodeURIComponent(cpf.replace(/\D/g, ''))}`;
          result = await softruckRequest('GET', endpoint, token);
        } else if (email) {
          const endpoint = `/v2/users?filters[users.email][eq]=${encodeURIComponent(email)}`;
          result = await softruckRequest('GET', endpoint, token);
        } else {
          throw new Error('userId, username, cpf ou email é obrigatório');
        }
        break;
      }

      case 'criar-usuario': {
        const { 
          username, 
          email, 
          nome, 
          telefone, 
          telefone2,
          cpf, 
          dataNascimento,
          contatoEmergencia,
          telefoneEmergencia,
          enterpriseId,
          roleId,
        } = data as {
          username: string;
          email: string;
          nome: string;
          telefone?: string;
          telefone2?: string;
          cpf?: string;
          dataNascimento?: string;
          contatoEmergencia?: string;
          telefoneEmergencia?: string;
          enterpriseId?: string;
          roleId?: string;
        };

        // Gerar username único se não fornecido
        const finalUsername = username?.replace(/\s/g, '_').substring(0, 255) || 
          `user_${Date.now()}`;

        const userData: Record<string, unknown> = {
          data: {
            attributes: {
              username: finalUsername,
              email: email?.substring(0, 255),
              name: nome?.substring(0, 255),
              phone1: telefone?.replace(/\D/g, '').substring(0, 20),
              phone2: telefone2?.replace(/\D/g, '').substring(0, 20),
              cpf: cpf?.replace(/\D/g, '').substring(0, 20),
              birthdate: dataNascimento,
              emergency_contact: contatoEmergencia?.substring(0, 255),
              emergency_phone: telefoneEmergencia?.replace(/\D/g, '').substring(0, 20),
              locale: 'pt_BR',
            },
            relationships: {
              enterprise: {
                type: 'enterprise',
                id: enterpriseId || getEnterpriseId(),
              },
            },
          },
        };

        if (roleId) {
          const dataObj = userData.data as Record<string, unknown>;
          const rels = dataObj.relationships as Record<string, unknown>;
          rels.roles = { type: 'roles', id: roleId };
        }

        result = await softruckRequest('POST', '/v2/users', token, userData);
        break;
      }

      case 'atualizar-usuario': {
        const { userId, nome, email, telefone, telefone2 } = data as {
          userId: string;
          nome?: string;
          email?: string;
          telefone?: string;
          telefone2?: string;
        };

        if (!userId) throw new Error('userId é obrigatório');

        const updateData: Record<string, unknown> = { data: { attributes: {} } };
        const attrs = ((updateData.data as Record<string, unknown>).attributes) as Record<string, unknown>;
        
        if (nome) attrs.name = nome.substring(0, 255);
        if (email) attrs.email = email.substring(0, 255);
        if (telefone) attrs.phone1 = telefone.replace(/\D/g, '').substring(0, 20);
        if (telefone2) attrs.phone2 = telefone2.replace(/\D/g, '').substring(0, 20);

        result = await softruckRequest('PATCH', `/v2/users/${userId}`, token, updateData);
        break;
      }

      case 'deletar-usuario': {
        const { userId } = data as { userId: string };
        if (!userId) throw new Error('userId é obrigatório');
        result = await softruckRequest('DELETE', `/v2/users/${userId}`, token);
        break;
      }

      case 'ativar-usuario': {
        const { userId } = data as { userId: string };
        if (!userId) throw new Error('userId é obrigatório');
        result = await softruckRequest('PATCH', `/v2/users/${userId}/status/activation`, token);
        break;
      }

      case 'desativar-usuario': {
        const { userId } = data as { userId: string };
        if (!userId) throw new Error('userId é obrigatório');
        result = await softruckRequest('PATCH', `/v2/users/${userId}/status/deactivation`, token);
        break;
      }

      // ========== ASSOCIAÇÕES DEVICE-VEÍCULO ==========

      case 'associar-device-veiculo': {
        const { deviceId, vehicleId, isPrincipal = true } = data as {
          deviceId: string;
          vehicleId: string;
          isPrincipal?: boolean;
        };

        if (!deviceId || !vehicleId) {
          throw new Error('deviceId e vehicleId são obrigatórios');
        }

        const associationData = {
          data: [{
            device_id: deviceId,
            vehicle_id: vehicleId,
            is_main_device: isPrincipal,
          }],
        };

        result = await softruckRequest('POST', '/v2/vehicles/associations/devices', token, associationData);
        break;
      }

      case 'desassociar-device-veiculo': {
        const { associationId } = data as { associationId: string };
        if (!associationId) throw new Error('associationId é obrigatório');

        const deleteData = {
          data: [{ type: 'device_association', id: associationId }],
        };

        result = await softruckRequest('DELETE', '/v2/vehicles/associations/devices', token, deleteData);
        break;
      }

      case 'listar-devices-veiculo': {
        const { vehicleId } = data as { vehicleId: string };
        if (!vehicleId) throw new Error('vehicleId é obrigatório');
        
        const endpoint = `/v2/vehicles/${vehicleId}/associations/devices?includes[device][]=name&includes[device][]=imei&includes[device][]=code`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'atualizar-device-principal': {
        const { vehicleId, associationId, isPrincipal } = data as {
          vehicleId: string;
          associationId: string;
          isPrincipal: boolean;
        };

        if (!vehicleId || !associationId) {
          throw new Error('vehicleId e associationId são obrigatórios');
        }

        const updateData = {
          data: {
            attributes: {
              is_main_device: isPrincipal,
            },
          },
        };

        result = await softruckRequest('PATCH', `/v2/vehicles/${vehicleId}/associations/devices/${associationId}`, token, updateData);
        break;
      }

      // ========== ASSOCIAÇÕES USUÁRIO-VEÍCULO ==========

      case 'associar-usuario-veiculo': {
        const { userId, vehicleId } = data as { userId: string; vehicleId: string };

        if (!userId || !vehicleId) {
          throw new Error('userId e vehicleId são obrigatórios');
        }

        const associationData = {
          data: [{
            vehicle_id: vehicleId,
            user_id: userId,
          }],
        };

        result = await softruckRequest('POST', '/v2/vehicles/associations/users', token, associationData);
        break;
      }

      case 'desassociar-usuario-veiculo': {
        const { associationId } = data as { associationId: string };
        if (!associationId) throw new Error('associationId é obrigatório');

        const deleteData = {
          data: [{ type: 'user_permission', id: associationId }],
        };

        result = await softruckRequest('DELETE', '/v2/vehicles/associations/users', token, deleteData);
        break;
      }

      case 'listar-usuarios-veiculo': {
        const { vehicleId } = data as { vehicleId: string };
        if (!vehicleId) throw new Error('vehicleId é obrigatório');
        
        const endpoint = `/v2/vehicles/${vehicleId}/associations/users?includes[user][]=name&includes[user][]=username&includes[user][]=cpf&includes[user][]=email`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      // ========== TRACKING ==========

      case 'tracking': {
        const { veiculoId, deviceId } = data as { veiculoId: string; deviceId: string };
        if (!veiculoId || !deviceId) {
          throw new Error('veiculoId e deviceId são obrigatórios');
        }
        
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
        if (!veiculoId) throw new Error('veiculoId é obrigatório');
        
        let endpoint = `/v2/vehicles/${veiculoId}/trajectories`;
        if (dataInicio && dataFim) {
          endpoint += `?filters[fromAcc]=${encodeURIComponent(dataInicio)}&filters[toAcc]=${encodeURIComponent(dataFim)}`;
        }
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'trajectories-geom': {
        const { veiculoId, dataInicio, dataFim } = data as { 
          veiculoId: string; 
          dataInicio?: string; 
          dataFim?: string;
        };
        if (!veiculoId) throw new Error('veiculoId é obrigatório');
        
        let endpoint = `/v2/vehicles/${veiculoId}/trajectories/geom`;
        if (dataInicio && dataFim) {
          endpoint += `?filters[fromAcc]=${encodeURIComponent(dataInicio)}&filters[toAcc]=${encodeURIComponent(dataFim)}`;
        }
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      case 'trajectories-by-keys': {
        const { veiculoId } = data as { veiculoId: string };
        if (!veiculoId) throw new Error('veiculoId é obrigatório');
        
        const endpoint = `/v2/vehicles/${veiculoId}/trajectories/by-keys`;
        result = await softruckRequest('GET', endpoint, token);
        break;
      }

      default:
        throw new Error(`Operação não suportada: ${operation}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Softruck API] ${operation} concluída em ${duration}ms`);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Softruck API] Erro em ${operation} após ${duration}ms:`, error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        operation,
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
