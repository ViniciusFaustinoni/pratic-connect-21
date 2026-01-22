/**
 * Tipos para integração com API Softruck
 * Baseado na documentação: docs.apiary.softruck.com
 */

// ========== OPERAÇÕES DISPONÍVEIS ==========

export type SoftruckOperation = 
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
  
  // Associações Veículo-Device
  | 'associar-device-veiculo'
  | 'desassociar-device-veiculo'
  | 'listar-devices-veiculo'
  | 'atualizar-device-principal'
  
  // Associações Veículo-Usuário
  | 'associar-usuario-veiculo'
  | 'desassociar-usuario-veiculo'
  | 'listar-usuarios-veiculo'
  
  // Tracking e Telemetria
  | 'tracking'
  | 'trajectories'
  | 'trajectories-geom'
  | 'trajectories-by-keys';

// ========== ENTIDADES ==========

export interface SoftruckEnterprise {
  id: string;
  type: 'enterprises';
  attributes: {
    name: string;
    cnpj?: string;
    timezone?: string;
    phone1?: string;
    phone2?: string;
    email?: string;
    contact_name?: string;
    webpage?: string;
    fantasy_name?: string;
    assistance_emergency_tel?: string;
    theft_emergency_tel?: string;
    created_at?: string;
    updated_at?: string;
    deactivated_at?: string | null;
  };
  relationships?: {
    country?: { type: string; id: string };
  };
}

export interface SoftruckVehicle {
  id: string;
  type: 'vehicles';
  attributes: {
    plate?: string;
    vin?: string;
    type?: string;
    code?: string;
    brand?: string;
    model?: string;
    year?: string;
    color?: string;
    description?: string;
    batch?: string;
    registration_number?: string;
    user_names?: string;
    deactivated_at?: string | null;
  };
  relationships?: {
    enterprise?: { type: string; id: string };
    devices?: Array<{ type: string; id: string }>;
    users?: Array<{ type: string; id: string }>;
  };
}

export interface SoftruckDevice {
  id: string;
  type: 'devices';
  attributes: {
    name: string;
    imei: string;
    code?: string;
    batch?: string;
  };
  relationships?: {
    chip?: { type: string; id: string };
    enterprise?: { type: string; id: string };
    vehicle?: { type: string; id: string };
    type?: { type: string; id: string };
  };
}

export interface SoftruckChip {
  id: string;
  type: 'chips';
  attributes: {
    serial: string;
    number: string;
    carrier?: string;
    service_provider: string;
    batch?: string;
  };
  relationships?: {
    enterprise?: { type: string; id: string };
    device?: { type: string; id: string };
  };
}

export interface SoftruckUser {
  id: string;
  type: 'users';
  attributes: {
    username: string;
    email: string;
    name: string;
    phone1?: string;
    phone2?: string;
    emergency_contact?: string;
    emergency_phone?: string;
    document_number?: string;
    cpf?: string;
    birthdate?: string;
    locale?: string;
  };
  relationships?: {
    enterprise?: { type: string; id: string };
    roles?: { type: string; id: string };
  };
}

export interface SoftruckDeviceAssociation {
  id: string;
  device_id: string;
  vehicle_id: string;
  is_main_device: boolean;
}

export interface SoftruckUserAssociation {
  id: string;
  user_id: string;
  vehicle_id: string;
}

// ========== TRACKING ==========

export interface SoftruckTrackingData {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  ignition?: boolean;
  last_connection_time?: string;
  last_gps_time?: string;
  address?: string;
  display_name?: string;
}

export interface SoftruckTrajectoryPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed?: number;
  ignition?: boolean;
}

// ========== REQUESTS ==========

export interface CriarVeiculoParams {
  placa: string;
  chassi?: string;
  tipo?: string;
  marca?: string;
  modelo?: string;
  ano?: string;
  cor?: string;
  codigo?: string;
  descricao?: string;
  enterpriseId?: string;
}

export interface CriarDeviceParams {
  nome: string;
  imei: string;
  codigo?: string;
  batch?: string;
  chipId?: string;
  veiculoId?: string;
  tipoId?: string;
  enterpriseId?: string;
}

export interface CriarChipParams {
  serial: string;
  numero: string;
  operadora?: string;
  provedor: string;
  batch?: string;
  enterpriseId?: string;
}

export interface CriarUsuarioParams {
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
}

export interface AssociarDeviceVeiculoParams {
  deviceId: string;
  vehicleId: string;
  isPrincipal?: boolean;
}

export interface AssociarUsuarioVeiculoParams {
  userId: string;
  vehicleId: string;
}

export interface TrackingParams {
  veiculoId: string;
  deviceId: string;
}

export interface TrajetoriaParams {
  veiculoId: string;
  dataInicio?: string;
  dataFim?: string;
}

// ========== RESPONSES ==========

export interface SoftruckApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SoftruckListResponse<T> {
  data: T[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface EnterpriseDiscoveryResult {
  enterprise_id: string;
  nome: string;
  cnpj?: string;
}

// ========== TIPOS DE VEÍCULOS ==========

export const SOFTRUCK_VEHICLE_TYPES = [
  'carro',
  'moto',
  'caminhao',
  'van',
  'onibus',
  'reboque',
  'barco',
  'equipamento',
  'outro',
] as const;

export type SoftruckVehicleType = typeof SOFTRUCK_VEHICLE_TYPES[number];

// ========== MAPEAMENTOS ==========

export const COMBUSTIVEL_TO_VEHICLE_TYPE: Record<string, SoftruckVehicleType> = {
  'gasolina': 'carro',
  'etanol': 'carro',
  'flex': 'carro',
  'diesel': 'caminhao',
  'eletrico': 'carro',
  'hibrido': 'carro',
  'gnv': 'carro',
};

export function mapCombustivelToVehicleType(combustivel?: string | null): SoftruckVehicleType {
  if (!combustivel) return 'carro';
  return COMBUSTIVEL_TO_VEHICLE_TYPE[combustivel.toLowerCase()] || 'carro';
}
