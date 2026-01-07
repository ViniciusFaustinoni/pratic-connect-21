// Tipos para integração WhatsApp via Evolution API

export type WhatsAppInstanceStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'open' 
  | 'close' 
  | 'qrcode';

export type WhatsAppMessageType = 
  | 'text' 
  | 'image' 
  | 'document' 
  | 'audio' 
  | 'video' 
  | 'template';

export type WhatsAppMessageStatus = 
  | 'pendente' 
  | 'enviando' 
  | 'enviada' 
  | 'entregue' 
  | 'lida' 
  | 'erro' 
  | 'cancelada';

export type WhatsAppMessageDirection = 'saida' | 'entrada';

export interface WhatsAppInstancia {
  id: string;
  nome: string;
  instance_name: string;
  descricao?: string;
  api_url: string;
  status: WhatsAppInstanceStatus;
  telefone?: string;
  nome_perfil?: string;
  foto_perfil?: string;
  webhook_url?: string;
  webhook_enabled: boolean;
  webhook_events: string[];
  principal: boolean;
  ativa: boolean;
  ultima_conexao?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMensagem {
  id: string;
  instancia_id?: string;
  telefone: string;
  nome_contato?: string;
  tipo: WhatsAppMessageType;
  mensagem?: string;
  media_url?: string;
  media_mimetype?: string;
  media_filename?: string;
  template_id?: string;
  template_variaveis?: Record<string, unknown>;
  status: WhatsAppMessageStatus;
  message_id?: string;
  erro_codigo?: string;
  erro_mensagem?: string;
  referencia_tipo?: string;
  referencia_id?: string;
  direcao: WhatsAppMessageDirection;
  enviado_por?: string;
  created_at: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
}

export interface WhatsAppLog {
  id: string;
  instancia_id?: string;
  tipo: string;
  evento?: string;
  payload?: Record<string, unknown>;
  resposta?: Record<string, unknown>;
  erro?: string;
  created_at: string;
}

export interface WhatsAppStatusResponse {
  success: boolean;
  instancia: {
    id: string;
    nome: string;
    instance_name: string;
  };
  status: WhatsAppInstanceStatus;
  connected: boolean;
  telefone?: string;
  raw?: unknown;
  error?: string;
}

export interface WhatsAppQRCodeResponse {
  success: boolean;
  qrcode?: string;
  code?: string;
  pairingCode?: string;
  error?: string;
}

export type WhatsAppMediaType = 'image' | 'document' | 'audio' | 'video';

// Templates
export type WhatsAppTemplateCategoria = 
  | 'vendas' 
  | 'cadastro' 
  | 'cobranca' 
  | 'monitoramento' 
  | 'eventos' 
  | 'assistencia' 
  | 'geral';

export interface WhatsAppTemplate {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  categoria: WhatsAppTemplateCategoria;
  mensagem: string;
  variaveis: string[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppSendMediaPayload {
  telefone: string;
  media_url?: string;
  media_base64?: string;
  media_type: WhatsAppMediaType;
  mimetype: string;
  filename?: string;
  caption?: string;
  instancia_id?: string;
  referencia_tipo?: string;
  referencia_id?: string;
}

export interface WhatsAppSendMediaResponse {
  success: boolean;
  mensagem_id?: string;
  message_id?: string;
  error?: string;
}
