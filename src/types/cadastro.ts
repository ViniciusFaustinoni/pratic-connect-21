// ============================================
// TYPES DO MÓDULO DE CADASTRO — SGA Pratic 2.0
// ============================================

// Re-exportar tipos base de database.ts (evita duplicação)
export type {
  StatusAssociado,
  StatusDocumento,
  StatusVeiculo,
  TipoDocumento,
  MotivoReprovacaoDocumento,
  Associado,
  Veiculo,
  Documento,
} from './database';

export {
  STATUS_ASSOCIADO_LABELS,
  STATUS_DOCUMENTO_LABELS,
  STATUS_VEICULO_LABELS,
  TIPO_DOCUMENTO_LABELS,
  STATUS_DOCUMENTO_COLORS,
  TIPO_DOCUMENTO_COLORS,
  MOTIVO_REPROVACAO_DOCUMENTO_LABELS,
} from './database';

// Importar para uso interno
import type {
  StatusAssociado,
  StatusDocumento,
  StatusVeiculo,
  TipoDocumento,
  Associado,
  Veiculo,
  Documento,
} from './database';

// ============================================
// CORES PARA BADGES — ASSOCIADOS
// ============================================

export const STATUS_ASSOCIADO_COLORS: Record<StatusAssociado, string> = {
  em_analise: 'bg-blue-100 text-blue-800 border-blue-200',
  pendente_vistoria: 'bg-violet-100 text-violet-800 border-violet-200',
  aprovado: 'bg-teal-100 text-teal-800 border-teal-200',
  documentacao_pendente: 'bg-amber-100 text-amber-800 border-amber-200',
  aguardando_instalacao: 'bg-purple-100 text-purple-800 border-purple-200',
  ativo: 'bg-green-100 text-green-800 border-green-200',
  inadimplente: 'bg-orange-100 text-orange-800 border-orange-200',
  suspenso: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
  bloqueado: 'bg-gray-100 text-gray-800 border-gray-200',
};

// ============================================
// CORES PARA BADGES — VEÍCULOS
// ============================================

export const STATUS_VEICULO_COLORS: Record<StatusVeiculo, string> = {
  em_analise: 'bg-blue-100 text-blue-800 border-blue-200',
  aprovado: 'bg-teal-100 text-teal-800 border-teal-200',
  instalacao_pendente: 'bg-amber-100 text-amber-800 border-amber-200',
  ativo: 'bg-green-100 text-green-800 border-green-200',
  suspenso: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
  sinistrado: 'bg-purple-100 text-purple-800 border-purple-200',
};

// ============================================
// PLATAFORMAS DE RASTREAMENTO
// ============================================

export type PlataformaRastreamento =
  | 'rede_veiculos'
  | 'soft_truck'
  | 'autotrac'
  | 'sascar'
  | 'nenhum';

export const PLATAFORMA_LABELS: Record<PlataformaRastreamento, string> = {
  rede_veiculos: 'Rede Veículos',
  soft_truck: 'Soft Truck',
  autotrac: 'Autotrac',
  sascar: 'Sascar',
  nenhum: 'Nenhum',
};

// ============================================
// INTERFACES COM RELAÇÕES
// ============================================

export interface VeiculoResumo {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano_modelo: number;
  status: StatusVeiculo | null;
}

export interface AssociadoComRelacoes extends Associado {
  plano?: {
    id: string;
    nome: string;
    codigo: string;
  };
  veiculos?: VeiculoResumo[];
  documentos_pendentes?: number;
  contrato?: {
    id: string;
    numero: string;
    status: string;
  };
}

export interface VeiculoComRelacoes extends Veiculo {
  associado?: {
    id: string;
    nome: string;
    cpf: string;
    telefone: string;
  };
  rastreador?: {
    id: string;
    numero_serie: string;
    modelo: string;
  };
  documentos?: Documento[];
}

export interface DocumentoComRelacoes extends Documento {
  associado?: {
    id: string;
    nome: string;
    cpf: string;
    telefone: string;
  };
  veiculo?: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
  };
  analista?: {
    id: string;
    nome: string;
  };
}

// ============================================
// INTERFACES DE FILTROS
// ============================================

export interface AssociadoFilters {
  search?: string;
  status?: StatusAssociado | StatusAssociado[];
  plano_id?: string;
  cidade?: string;
  estado?: string;
  data_adesao_inicio?: string;
  data_adesao_fim?: string;
  documentos_pendentes?: boolean;
  com_sinistro?: boolean;
}

export interface VeiculoFilters {
  search?: string;
  status?: StatusVeiculo;
  associado_id?: string;
  plataforma?: PlataformaRastreamento;
  uso_aplicativo?: boolean;
  sem_rastreador?: boolean;
}

export interface DocumentoFilters {
  search?: string;
  tipo?: TipoDocumento;
  status?: StatusDocumento;
  associado_id?: string;
  veiculo_id?: string;
  data_inicio?: string;
  data_fim?: string;
  prioridade?: 'alta' | 'normal';
}

// ============================================
// PAYLOADS DE AÇÕES
// ============================================

export interface AnalisarDocumentoPayload {
  id: string;
  status: 'aprovado' | 'reprovado';
  motivo_reprovacao?: string;
  observacao?: string;
}

export interface AtualizarAssociadoPayload {
  id: string;
  dados: Partial<Omit<Associado, 'id' | 'created_at' | 'updated_at'>>;
}

export interface AtualizarVeiculoPayload {
  id: string;
  dados: Partial<Omit<Veiculo, 'id' | 'created_at' | 'updated_at'>>;
}

// ============================================
// CONTAGENS
// ============================================

export interface ContagemDocumentos {
  total: number;
  pendente: number;
  em_analise: number;
  aprovado: number;
  reprovado: number;
  expirado: number;
}

export interface ContagemAssociados {
  total: number;
  em_analise: number;
  aprovado: number;
  documentacao_pendente: number;
  aguardando_instalacao: number;
  ativo: number;
  inadimplente: number;
  suspenso: number;
  cancelado: number;
  bloqueado: number;
}

export interface ContagemVeiculos {
  total: number;
  em_analise: number;
  aprovado: number;
  instalacao_pendente: number;
  ativo: number;
  suspenso: number;
  cancelado: number;
  sinistrado: number;
}

// ============================================
// RESUMOS
// ============================================

export interface ResumoAssociado {
  id: string;
  nome: string;
  cpf: string;
  status: StatusAssociado;
  plano: string | null;
  veiculos_count: number;
  data_adesao: string | null;
}

export interface ResumoVeiculo {
  id: string;
  placa: string;
  marca_modelo: string;
  ano: number;
  status: StatusVeiculo | null;
  associado_nome: string;
}

export interface ResumoDocumento {
  id: string;
  tipo: TipoDocumento;
  status: StatusDocumento;
  associado_nome: string;
  created_at: string;
}

// ============================================
// MOTIVOS DE REPROVAÇÃO ESTENDIDOS
// ============================================

export const MOTIVOS_REPROVACAO_EXTENDED = [
  { value: 'ilegivel', label: 'Documento ilegível' },
  { value: 'vencido', label: 'Documento vencido' },
  { value: 'outra_pessoa', label: 'Documento de outra pessoa' },
  { value: 'foto_incompleta', label: 'Foto cortada ou incompleta' },
  { value: 'dados_incorretos', label: 'Dados não conferem com cadastro' },
  { value: 'baixa_qualidade', label: 'Qualidade da imagem muito baixa' },
  { value: 'documento_invalido', label: 'Documento inválido ou adulterado' },
  { value: 'placa_divergente', label: 'Placa divergente do cadastro' },
  { value: 'veiculo_diferente', label: 'Veículo diferente do cadastrado' },
  { value: 'outro', label: 'Outro motivo' },
] as const;

export type MotivoReprovacaoExtended = typeof MOTIVOS_REPROVACAO_EXTENDED[number]['value'];
