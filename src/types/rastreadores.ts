/**
 * Tipos para sistema de rastreamento multi-plataforma
 */

export type PlataformaRastreador = 'rede_veiculos' | 'softruck';

/**
 * Status do rastreador no ciclo de vida completo
 * Inclui Processo 1 (Campo) e Processo 2 (Manutenção Interna/Base)
 */
export type StatusRastreador = 
  | 'estoque'               // Pronto para uso na base
  | 'instalado'             // No veículo do associado
  | 'manutencao'            // Vistoria aberta (campo)
  | 'retorno_base'          // Voltou do campo, aguarda triagem
  | 'triagem'               // Coordenador avaliando na bancada
  | 'em_analise_plataforma' // Na plataforma (Rede Veículos/Softruck)
  | 'em_garantia'           // No fornecedor
  | 'baixado';              // TERMINAL - descartado

export const STATUS_RASTREADOR_LABELS: Record<StatusRastreador, string> = {
  estoque: 'Em Estoque',
  instalado: 'Instalado',
  manutencao: 'Em Manutenção (Campo)',
  retorno_base: 'Retorno Base',
  triagem: 'Em Triagem',
  em_analise_plataforma: 'Análise Plataforma',
  em_garantia: 'Em Garantia',
  baixado: 'Baixado',
};

export const STATUS_RASTREADOR_COLORS: Record<StatusRastreador, string> = {
  estoque: 'bg-green-100 text-green-800',
  instalado: 'bg-emerald-100 text-emerald-800',
  manutencao: 'bg-orange-100 text-orange-800',
  retorno_base: 'bg-yellow-100 text-yellow-800',
  triagem: 'bg-purple-100 text-purple-800',
  em_analise_plataforma: 'bg-cyan-100 text-cyan-800',
  em_garantia: 'bg-indigo-100 text-indigo-800',
  baixado: 'bg-gray-100 text-gray-600',
};

/**
 * Status que podem ser selecionados manualmente no formulário de rastreador
 * (exclui os status de workflow automático)
 */
export type StatusRastreadorManual = 'estoque' | 'instalado' | 'manutencao' | 'baixado';

/**
 * Status de manutenção interna (Processo 2)
 */
export type StatusManutencaoInterna = 'retorno_base' | 'triagem' | 'em_analise_plataforma' | 'em_garantia';

/**
 * Transições permitidas de status de rastreador
 */
export const TRANSICOES_STATUS_RASTREADOR: Record<StatusRastreador, StatusRastreador[]> = {
  estoque: ['instalado', 'manutencao', 'baixado'],
  instalado: ['manutencao', 'estoque'],
  manutencao: ['instalado', 'retorno_base', 'baixado'],
  retorno_base: ['triagem'],
  triagem: ['estoque', 'em_analise_plataforma', 'em_garantia', 'baixado'],
  em_analise_plataforma: ['triagem', 'estoque', 'baixado'],
  em_garantia: ['triagem', 'estoque', 'baixado'],
  baixado: [], // Terminal - sem transições
};

// StatusRastreador removido - usar a definição na linha 11

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
