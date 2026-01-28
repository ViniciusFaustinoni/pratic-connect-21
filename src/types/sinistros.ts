// ============================================
// ENUMS E TIPOS BASE
// ============================================

export type TipoSinistro = 
  | 'colisao' 
  | 'roubo' 
  | 'furto' 
  | 'incendio' 
  | 'fenomeno_natural' 
  | 'terceiros' 
  | 'vidros' 
  | 'outro';

export type StatusSinistro = 
  | 'comunicado'
  | 'em_analise'
  | 'documentacao_pendente'
  | 'aprovado'
  | 'negado'
  | 'em_regulacao'
  | 'em_reparo'
  | 'aguardando_pagamento'
  | 'pago'
  | 'encerrado'
  | 'cancelado'
  | 'em_sindicancia';

export type CanalAbertura = 'app' | 'whatsapp' | 'telefone' | 'presencial';

// ============================================
// LABELS E CORES
// ============================================

export const TIPO_SINISTRO_LABELS: Record<TipoSinistro, string> = {
  colisao: 'Colisão',
  roubo: 'Roubo',
  furto: 'Furto',
  incendio: 'Incêndio',
  fenomeno_natural: 'Fenômeno Natural',
  terceiros: 'Terceiros',
  vidros: 'Vidros',
  outro: 'Outro',
};

export const TIPO_SINISTRO_ICONS: Record<TipoSinistro, string> = {
  colisao: 'Car',
  roubo: 'ShieldAlert',
  furto: 'ShieldOff',
  incendio: 'Flame',
  fenomeno_natural: 'CloudRain',
  terceiros: 'Users',
  vidros: 'Square',
  outro: 'HelpCircle',
};

export const STATUS_SINISTRO_LABELS: Record<StatusSinistro, string> = {
  comunicado: 'Comunicado',
  em_analise: 'Em Análise',
  documentacao_pendente: 'Doc. Pendente',
  aprovado: 'Aprovado',
  negado: 'Negado',
  em_regulacao: 'Em Regulação',
  em_reparo: 'Em Reparo',
  aguardando_pagamento: 'Aguard. Pagamento',
  pago: 'Pago',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
  em_sindicancia: 'Em Sindicância',
};

export const STATUS_SINISTRO_COLORS: Record<StatusSinistro, string> = {
  comunicado: 'bg-yellow-100 text-yellow-800',
  em_analise: 'bg-blue-100 text-blue-800',
  documentacao_pendente: 'bg-orange-100 text-orange-800',
  aprovado: 'bg-green-100 text-green-800',
  negado: 'bg-red-100 text-red-800',
  em_regulacao: 'bg-purple-100 text-purple-800',
  em_reparo: 'bg-indigo-100 text-indigo-800',
  aguardando_pagamento: 'bg-cyan-100 text-cyan-800',
  pago: 'bg-emerald-100 text-emerald-800',
  encerrado: 'bg-gray-100 text-gray-800',
  cancelado: 'bg-gray-100 text-gray-500',
  em_sindicancia: 'bg-rose-100 text-rose-800',
};

export const CANAL_LABELS: Record<CanalAbertura, string> = {
  app: 'App',
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  presencial: 'Presencial',
};

// ============================================
// INTERFACES PRINCIPAIS
// ============================================

export interface Sinistro {
  id: string;
  associado_id: string;
  veiculo_id: string;
  protocolo: string;
  tipo: TipoSinistro;
  status: StatusSinistro;
  data_ocorrencia: string;
  hora_ocorrencia?: string;
  local_ocorrencia: string;
  cidade_ocorrencia: string;
  estado_ocorrencia: string;
  descricao: string;
  bo_numero?: string;
  bo_arquivo_url?: string;
  valor_fipe_momento?: number;
  valor_aprovado?: number;
  valor_participacao?: number;
  valor_pago?: number;
  analista_id?: string;
  canal: CanalAbertura;
  created_at: string;
  updated_at: string;
}

export interface SinistroComRelacoes extends Sinistro {
  associado?: {
    id: string;
    nome: string;
    cpf: string;
    telefone: string;
    email: string;
  };
  veiculo?: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    ano_modelo: number;
    cor: string;
  };
  analista?: {
    id: string;
    nome: string;
  };
  documentos?: SinistroDocumento[];
  fotos?: SinistroFoto[];
  historico?: SinistroHistorico[];
}

// ============================================
// INTERFACES DE DOCUMENTOS E FOTOS
// ============================================

export interface SinistroDocumento {
  id: string;
  sinistro_id: string;
  tipo: 'bo' | 'cnh' | 'crlv' | 'laudo' | 'orcamento' | 'nf' | 'outros';
  nome: string;
  url: string;
  uploaded_at: string;
}

export interface SinistroFoto {
  id: string;
  sinistro_id: string;
  categoria: 'veiculo_geral' | 'dano_frontal' | 'dano_traseiro' | 'dano_lateral' | 'dano_interno' | 'local_ocorrencia' | 'outros';
  url: string;
  descricao?: string;
  uploaded_at: string;
}

// ============================================
// INTERFACES DE HISTÓRICO
// ============================================

export interface SinistroHistorico {
  id: string;
  sinistro_id: string;
  status_anterior?: StatusSinistro;
  status_novo: StatusSinistro;
  usuario_id: string;
  usuario_nome?: string;
  observacao?: string;
  created_at: string;
}

// ============================================
// INTERFACES DE FILTROS
// ============================================

export interface SinistroFilters {
  search?: string;
  status?: StatusSinistro | StatusSinistro[];
  tipo?: TipoSinistro | TipoSinistro[];
  analista_id?: string;
  data_inicio?: string;
  data_fim?: string;
  canal?: CanalAbertura;
  sem_analista?: boolean;
}

// ============================================
// PAYLOADS
// ============================================

export interface AbrirSinistroPayload {
  associado_id: string;
  veiculo_id: string;
  tipo: TipoSinistro;
  data_ocorrencia: string;
  hora_ocorrencia?: string;
  local_ocorrencia: string;
  cidade_ocorrencia: string;
  estado_ocorrencia: string;
  descricao: string;
  bo_numero?: string;
  canal: CanalAbertura;
}

export interface AtualizarSinistroPayload {
  tipo?: TipoSinistro;
  data_ocorrencia?: string;
  local_ocorrencia?: string;
  cidade_ocorrencia?: string;
  estado_ocorrencia?: string;
  descricao?: string;
  bo_numero?: string;
  valor_fipe_momento?: number;
  valor_aprovado?: number;
  valor_participacao?: number;
}

export interface MudarStatusSinistroPayload {
  sinistro_id: string;
  novo_status: StatusSinistro;
  observacao?: string;
}

export interface AtribuirAnalistaPayload {
  sinistro_id: string;
  analista_id: string;
}

// ============================================
// ESTATÍSTICAS
// ============================================

export interface ContagemSinistros {
  total: number;
  comunicados: number;
  em_analise: number;
  documentacao_pendente: number;
  aprovados: number;
  negados: number;
  em_reparo: number;
  encerrados_mes: number;
}

export interface EstatisticasSinistros {
  total_mes: number;
  total_ano: number;
  valor_total_aprovado: number;
  valor_total_pago: number;
  tempo_medio_analise_dias: number;
  taxa_aprovacao: number;
  por_tipo: Record<TipoSinistro, number>;
  por_status: Record<StatusSinistro, number>;
}

// ============================================
// WORKFLOW
// ============================================

export const WORKFLOW_SINISTRO: Record<StatusSinistro, StatusSinistro[]> = {
  comunicado: ['em_analise', 'em_sindicancia', 'cancelado'],
  em_analise: ['documentacao_pendente', 'aprovado', 'negado', 'em_sindicancia', 'cancelado'],
  documentacao_pendente: ['em_analise', 'em_sindicancia', 'cancelado'],
  aprovado: ['em_regulacao', 'em_reparo', 'aguardando_pagamento'],
  negado: ['encerrado'],
  em_regulacao: ['em_reparo', 'aguardando_pagamento'],
  em_reparo: ['aguardando_pagamento'],
  aguardando_pagamento: ['pago'],
  pago: ['encerrado'],
  encerrado: [],
  cancelado: [],
  em_sindicancia: ['em_analise', 'aprovado', 'negado', 'cancelado'],
};
