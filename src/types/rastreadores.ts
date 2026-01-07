/**
 * Tipos para sistema de rastreamento multi-plataforma
 */

export type PlataformaRastreador = 'rede_veiculos' | 'softruck';

export type StatusRastreador = 'estoque' | 'instalado' | 'manutencao' | 'baixado';

export interface RastreadorPosicao {
  latitude: number;
  longitude: number;
  velocidade: number;
  ignicao: boolean;
  data_posicao: string;
  endereco?: string;
  dados_extras?: Record<string, unknown>;
}

export interface RastreadorConfigPlataforma {
  id: string;
  plataforma: PlataformaRastreador;
  nome_exibicao: string;
  api_url_sandbox: string;
  api_url_producao: string;
  auth_type: 'bearer_fixo' | 'oauth_jwt';
  suporta_posicao_tempo_real: boolean;
  suporta_historico_trajeto: boolean;
  suporta_acionamento_roubo: boolean;
  suporta_bloqueio: boolean;
  suporta_webhooks: boolean;
  ativa: boolean;
  ambiente_atual: 'sandbox' | 'producao';
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RastreadorComPlataforma {
  id: string;
  veiculo_id?: string;
  codigo: string;
  numero_serie?: string;
  imei?: string;
  plataforma: PlataformaRastreador;
  plataforma_device_id?: string;
  id_plataforma?: string;
  status: StatusRastreador;
  ultima_comunicacao?: string;
  ultima_posicao_lat?: number;
  ultima_posicao_lng?: number;
  ultima_velocidade?: number;
  ultima_ignicao?: boolean;
  bloqueado?: boolean;
  dados_extras?: Record<string, unknown>;
  config_plataforma?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RastreadorLog {
  id: string;
  rastreador_id?: string;
  plataforma: PlataformaRastreador;
  operacao: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  status: 'sucesso' | 'erro' | 'timeout';
  tempo_resposta_ms?: number;
  erro_mensagem?: string;
  created_at: string;
}

export interface RastreadorTokenCache {
  id: string;
  plataforma: PlataformaRastreador;
  token: string;
  refresh_token?: string;
  expires_at: string;
  created_at: string;
}

// Response da edge function rastreador-auth
export interface RastreadorAuthResponse {
  success: boolean;
  token?: string;
  from_cache?: boolean;
  expires_at?: string;
  error?: string;
}

// Histórico de posições
export interface RastreadorHistorico {
  id: string;
  rastreador_id: string;
  latitude: number;
  longitude: number;
  velocidade: number;
  ignicao: boolean;
  data_posicao: string;
  endereco?: string;
  dados_extras?: Record<string, unknown>;
  created_at: string;
}
