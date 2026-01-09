// ============================================
// TIPOS PARA COTAÇÃO PÚBLICA - JORNADA COMPLETA
// SGA Pratic 2.0 - Proteção Veicular
// ============================================

// ============================================
// TIPOS BÁSICOS
// ============================================

export type TipoUsoVeiculo = 'particular' | 'aplicativo';

export type CategoriaPlano = 'Básico' | 'Completo' | 'Premium';

export type StatusCotacaoPublica =
  | 'aguardando'
  | 'visualizado'
  | 'uso_definido'
  | 'plano_escolhido'
  | 'proposta_aceita'
  | 'documentos_ok'
  | 'selfie_ok'
  | 'vistoria_ok'
  | 'termos_ok'
  | 'em_analise'
  | 'aprovado'
  | 'pendente'
  | 'recusado'
  | 'expirado'
  | 'cancelado';

export type TipoVistoria = 'autoatendimento' | 'presencial';

// ============================================
// INTERFACES
// ============================================

export interface PlanoCalculado {
  categoria: CategoriaPlano;
  valor_mensal: number;
  valor_adesao: number;
  valor_primeira_parcela: number;
  coberturas: string[];
  tag?: string;
  destaque?: boolean;
}

export interface ResultadoCalculo {
  planos: PlanoCalculado[];
  valor_fipe: number;
  tipo_uso: TipoUsoVeiculo;
}

export interface CotacaoPublicaData {
  id: string;
  token: string;
  lead_id: string;
  vendedor_id?: string;
  status: StatusCotacaoPublica;
  
  // Veículo
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_ano?: number;
  veiculo_placa?: string;
  veiculo_cor?: string;
  valor_fipe?: number;
  
  // Escolhas
  uso_aplicativo?: boolean;
  plano_escolhido?: string;
  valor_mensal_final?: number;
  valor_adesao_final?: number;
  
  // Documentos
  doc_cnh_frente?: string;
  doc_cnh_verso?: string;
  doc_crlv?: string;
  doc_comprovante?: string;
  doc_selfie?: string;
  
  // Verificação facial
  face_match_score?: number;
  face_aprovada?: boolean;
  
  // Vistoria
  tipo_vistoria?: TipoVistoria;
  vistoria_agendada_para?: string;
  vistoria_local?: string;
  
  // Termos
  termos_aceitos?: boolean;
  
  // Timestamps
  expires_at: string;
  created_at: string;
  updated_at: string;
  visualizado_em?: string;
  uso_definido_em?: string;
  plano_escolhido_em?: string;
  proposta_aceita_em?: string;
  documentos_ok_em?: string;
  selfie_ok_em?: string;
  vistoria_ok_em?: string;
  termos_ok_em?: string;
  
  // Joins
  leads?: {
    id: string;
    nome: string;
    telefone?: string;
    email?: string;
  };
}

export interface FotoVistoria {
  id?: string;
  cotacao_id: string;
  tipo: string;
  url: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
}

// ============================================
// CONSTANTES
// ============================================

export const CORES_PLANO: Record<CategoriaPlano, { bg: string; border: string; text: string; badge: string }> = {
  'Básico': {
    bg: 'bg-slate-50',
    border: 'border-slate-400',
    text: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-700',
  },
  'Completo': {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
  },
  'Premium': {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
};

export const COBERTURAS_POR_PLANO: Record<CategoriaPlano, string[]> = {
  'Básico': [
    'Roubo e Furto (100% FIPE)',
    'Colisão (até 75% FIPE)',
    'Incêndio',
    'Fenômenos Naturais',
    'Assistência 24h (200km)',
  ],
  'Completo': [
    'Roubo e Furto (100% FIPE)',
    'Colisão (100% FIPE)',
    'Incêndio',
    'Fenômenos Naturais',
    'Assistência 24h (400km)',
    'Vidros Laterais',
    'Carro Reserva (7 dias)',
    'APP Morte (R$ 10.000)',
  ],
  'Premium': [
    'Roubo e Furto (100% FIPE)',
    'Colisão (100% FIPE)',
    'Perda Total',
    'Incêndio',
    'Fenômenos Naturais',
    'Assistência 24h (Ilimitada)',
    'Vidros (Todos)',
    'Carro Reserva (15 dias)',
    'APP Morte (R$ 30.000)',
    'APP Invalidez (R$ 30.000)',
    'Danos Morais (R$ 20.000)',
    'Reboque Especializado',
  ],
};

export const STATUS_COTACAO_PUBLICA_LABELS: Record<StatusCotacaoPublica, string> = {
  aguardando: 'Aguardando acesso',
  visualizado: 'Visualizado',
  uso_definido: 'Uso definido',
  plano_escolhido: 'Plano escolhido',
  proposta_aceita: 'Proposta aceita',
  documentos_ok: 'Documentos enviados',
  selfie_ok: 'Verificação facial OK',
  vistoria_ok: 'Vistoria concluída',
  termos_ok: 'Termos aceitos',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  pendente: 'Com pendência',
  recusado: 'Recusado',
  expirado: 'Expirado',
  cancelado: 'Cancelado',
};

export const STATUS_COTACAO_PUBLICA_COLORS: Record<StatusCotacaoPublica, string> = {
  aguardando: 'bg-gray-100 text-gray-700',
  visualizado: 'bg-blue-100 text-blue-700',
  uso_definido: 'bg-blue-100 text-blue-700',
  plano_escolhido: 'bg-indigo-100 text-indigo-700',
  proposta_aceita: 'bg-purple-100 text-purple-700',
  documentos_ok: 'bg-cyan-100 text-cyan-700',
  selfie_ok: 'bg-teal-100 text-teal-700',
  vistoria_ok: 'bg-emerald-100 text-emerald-700',
  termos_ok: 'bg-green-100 text-green-700',
  em_analise: 'bg-yellow-100 text-yellow-700',
  aprovado: 'bg-green-100 text-green-700',
  pendente: 'bg-orange-100 text-orange-700',
  recusado: 'bg-red-100 text-red-700',
  expirado: 'bg-gray-100 text-gray-500',
  cancelado: 'bg-gray-100 text-gray-500',
};

export const FOTOS_VISTORIA_CONFIG = [
  { tipo: 'frente', nome: 'Frente', descricao: 'Vista frontal do veículo' },
  { tipo: 'traseira', nome: 'Traseira', descricao: 'Vista traseira' },
  { tipo: 'lateral_esq', nome: 'Lateral Esquerda', descricao: 'Lado do motorista' },
  { tipo: 'lateral_dir', nome: 'Lateral Direita', descricao: 'Lado do passageiro' },
  { tipo: 'diagonal_frente_esq', nome: 'Diagonal Frontal Esq', descricao: 'Ângulo frontal esquerdo' },
  { tipo: 'diagonal_frente_dir', nome: 'Diagonal Frontal Dir', descricao: 'Ângulo frontal direito' },
  { tipo: 'diagonal_tras_esq', nome: 'Diagonal Traseira Esq', descricao: 'Ângulo traseiro esquerdo' },
  { tipo: 'diagonal_tras_dir', nome: 'Diagonal Traseira Dir', descricao: 'Ângulo traseiro direito' },
  { tipo: 'painel', nome: 'Painel', descricao: 'Painel de instrumentos' },
  { tipo: 'hodometro', nome: 'Hodômetro', descricao: 'Quilometragem atual' },
  { tipo: 'motor', nome: 'Motor', descricao: 'Compartimento do motor' },
  { tipo: 'chassi', nome: 'Chassi', descricao: 'Número do chassi' },
  { tipo: 'pneu_de', nome: 'Pneu Dianteiro Esq', descricao: 'Pneu dianteiro esquerdo' },
  { tipo: 'pneu_dd', nome: 'Pneu Dianteiro Dir', descricao: 'Pneu dianteiro direito' },
  { tipo: 'pneu_te', nome: 'Pneu Traseiro Esq', descricao: 'Pneu traseiro esquerdo' },
  { tipo: 'pneu_td', nome: 'Pneu Traseiro Dir', descricao: 'Pneu traseiro direito' },
  { tipo: 'etiqueta_porta', nome: 'Etiqueta Porta', descricao: 'Etiqueta na porta' },
  { tipo: 'documento', nome: 'CRLV no Veículo', descricao: 'CRLV sobre o painel' },
] as const;

export const DOCUMENTOS_CONFIG = [
  { tipo: 'cnh_frente', nome: 'CNH Frente', descricao: 'Foto da frente da CNH', obrigatorio: true },
  { tipo: 'cnh_verso', nome: 'CNH Verso', descricao: 'Foto do verso da CNH', obrigatorio: true },
  { tipo: 'crlv', nome: 'CRLV', descricao: 'Documento do veículo', obrigatorio: true },
  { tipo: 'comprovante', nome: 'Comprovante', descricao: 'Comprovante de residência', obrigatorio: true },
] as const;
