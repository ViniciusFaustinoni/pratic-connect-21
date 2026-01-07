// ============================================
// ENUMS E TIPOS BASE
// ============================================

export type StatusBoleto = 'pendente' | 'pago' | 'vencido' | 'cancelado';

export type StatusVeiculo = 
  | 'em_analise' 
  | 'aprovado' 
  | 'instalacao_pendente' 
  | 'ativo' 
  | 'suspenso' 
  | 'cancelado' 
  | 'sinistrado';

export type StatusAssistencia = 
  | 'aberto' 
  | 'em_atendimento' 
  | 'em_deslocamento' 
  | 'concluido' 
  | 'cancelado'
  | 'aguardando_prestador'
  | 'prestador_despachado'
  | 'prestador_a_caminho'
  | 'cancelado_associado'
  | 'cancelado_sistema';

export type TipoAssistencia = 'guincho' | 'pane_seca' | 'troca_pneu' | 'chaveiro' | 'bateria' | 'outros';

export type StatusSinistro = 
  | 'comunicado'
  | 'documentacao_pendente'
  | 'aguardando_vistoria'
  | 'em_vistoria'
  | 'em_analise'
  | 'aguardando_parecer'
  | 'aprovado'
  | 'negado'
  | 'reprovado'
  | 'em_regulacao'
  | 'em_reparo'
  | 'indenizado'
  | 'pago'
  | 'encerrado'
  | 'cancelado';

export type TipoSinistro = 
  | 'roubo' 
  | 'furto' 
  | 'colisao' 
  | 'incendio' 
  | 'alagamento' 
  | 'outro'
  | 'fenomeno_natural'
  | 'vidros'
  | 'terceiros';

// ============================================
// LABELS E CORES
// ============================================

export const STATUS_BOLETO_LABELS: Record<StatusBoleto, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

export const STATUS_BOLETO_COLORS: Record<StatusBoleto, string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  pago: 'bg-green-100 text-green-800',
  vencido: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

export const STATUS_VEICULO_LABELS: Record<StatusVeiculo, string> = {
  em_analise: 'Em Análise',
  aprovado: 'Aprovado',
  instalacao_pendente: 'Instalação Pendente',
  ativo: 'Ativo',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
  sinistrado: 'Sinistrado',
};

export const STATUS_VEICULO_COLORS: Record<StatusVeiculo, string> = {
  em_analise: 'bg-yellow-100 text-yellow-800',
  aprovado: 'bg-blue-100 text-blue-800',
  instalacao_pendente: 'bg-orange-100 text-orange-800',
  ativo: 'bg-green-100 text-green-800',
  suspenso: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-800',
  sinistrado: 'bg-purple-100 text-purple-800',
};

export const STATUS_ASSISTENCIA_LABELS: Record<StatusAssistencia, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em Atendimento',
  em_deslocamento: 'Em Deslocamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  aguardando_prestador: 'Aguardando Prestador',
  prestador_despachado: 'Prestador Despachado',
  prestador_a_caminho: 'Prestador a Caminho',
  cancelado_associado: 'Cancelado pelo Associado',
  cancelado_sistema: 'Cancelado pelo Sistema',
};

export const STATUS_ASSISTENCIA_COLORS: Record<StatusAssistencia, string> = {
  aberto: 'bg-yellow-100 text-yellow-800',
  em_atendimento: 'bg-blue-100 text-blue-800',
  em_deslocamento: 'bg-indigo-100 text-indigo-800',
  concluido: 'bg-green-100 text-green-800',
  cancelado: 'bg-gray-100 text-gray-800',
  aguardando_prestador: 'bg-orange-100 text-orange-800',
  prestador_despachado: 'bg-cyan-100 text-cyan-800',
  prestador_a_caminho: 'bg-teal-100 text-teal-800',
  cancelado_associado: 'bg-gray-100 text-gray-800',
  cancelado_sistema: 'bg-gray-100 text-gray-800',
};

export const TIPO_ASSISTENCIA_LABELS: Record<TipoAssistencia, string> = {
  guincho: 'Guincho',
  pane_seca: 'Pane Seca',
  troca_pneu: 'Troca de Pneu',
  chaveiro: 'Chaveiro',
  bateria: 'Bateria',
  outros: 'Outros',
};

export const STATUS_SINISTRO_LABELS: Record<StatusSinistro, string> = {
  comunicado: 'Comunicado',
  documentacao_pendente: 'Documentação Pendente',
  aguardando_vistoria: 'Aguardando Vistoria',
  em_vistoria: 'Em Vistoria',
  em_analise: 'Em Análise',
  aguardando_parecer: 'Aguardando Parecer',
  aprovado: 'Aprovado',
  negado: 'Negado',
  reprovado: 'Reprovado',
  em_regulacao: 'Em Regulação',
  em_reparo: 'Em Reparo',
  indenizado: 'Indenizado',
  pago: 'Pago',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
};

export const STATUS_SINISTRO_COLORS: Record<StatusSinistro, string> = {
  comunicado: 'bg-yellow-100 text-yellow-800',
  documentacao_pendente: 'bg-orange-100 text-orange-800',
  aguardando_vistoria: 'bg-amber-100 text-amber-800',
  em_vistoria: 'bg-blue-100 text-blue-800',
  em_analise: 'bg-indigo-100 text-indigo-800',
  aguardando_parecer: 'bg-violet-100 text-violet-800',
  aprovado: 'bg-green-100 text-green-800',
  negado: 'bg-red-100 text-red-800',
  reprovado: 'bg-red-100 text-red-800',
  em_regulacao: 'bg-cyan-100 text-cyan-800',
  em_reparo: 'bg-purple-100 text-purple-800',
  indenizado: 'bg-emerald-100 text-emerald-800',
  pago: 'bg-green-100 text-green-800',
  encerrado: 'bg-gray-100 text-gray-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

export const TIPO_SINISTRO_LABELS: Record<TipoSinistro, string> = {
  colisao: 'Colisão',
  roubo: 'Roubo',
  furto: 'Furto',
  incendio: 'Incêndio',
  alagamento: 'Alagamento',
  outro: 'Outro',
  fenomeno_natural: 'Fenômeno Natural',
  vidros: 'Vidros',
  terceiros: 'Terceiros',
};

// ============================================
// INTERFACES — ASSOCIADO
// ============================================

export interface AssociadoApp {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  whatsapp?: string;
  foto_url?: string;
  plano_nome: string;
  status: 'ativo' | 'inadimplente' | 'suspenso' | 'bloqueado';
  data_adesao: string;
  dia_vencimento: number;
}

export interface VeiculoApp {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano_modelo: number;
  cor: string;
  status: StatusVeiculo;
  tem_rastreador: boolean;
  rastreador_ativo: boolean;
  ultima_posicao?: PosicaoVeiculo;
}

export interface PosicaoVeiculo {
  latitude: number;
  longitude: number;
  velocidade: number;
  ignicao: boolean;
  data_hora: string;
  endereco?: string;
}

// ============================================
// INTERFACES — BOLETOS
// ============================================

export interface BoletoApp {
  id: string;
  referencia_mes?: number;
  referencia_ano?: number;
  valor: number;
  valor_final: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: string;
  codigo_barras?: string;
  linha_digitavel?: string;
  pix_qrcode?: string;
  pix_copia_cola?: string;
  boleto_url?: string;
}

// ============================================
// INTERFACES — ASSISTÊNCIA 24H
// ============================================

export interface AssistenciaApp {
  id: string;
  protocolo: string;
  tipo_servico: string;
  status: StatusAssistencia;
  veiculo_id?: string;
  veiculo?: VeiculoApp;
  origem_endereco?: string;
  origem_lat?: number;
  origem_lng?: number;
  origem_cidade?: string;
  origem_uf?: string;
  destino_endereco?: string;
  destino_lat?: number;
  destino_lng?: number;
  descricao?: string;
  prestador_nome?: string;
  prestador_telefone?: string;
  data_abertura: string;
  data_conclusao?: string;
  avaliacao_nota?: number;
}

export interface SolicitarAssistenciaPayload {
  tipo: TipoAssistencia;
  veiculo_id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  descricao?: string;
}

// ============================================
// INTERFACES — SINISTROS
// ============================================

export interface SinistroApp {
  id: string;
  protocolo: string;
  tipo: TipoSinistro;
  status: StatusSinistro;
  veiculo_id: string;
  veiculo?: VeiculoApp;
  associado_id: string;
  data_ocorrencia: string;
  local_descricao?: string;
  descricao?: string;
  bo_numero?: string;
  bo_arquivo_url?: string;
  valor_fipe?: number;
  valor_indenizacao?: number;
  valor_pago?: number;
  created_at: string;
  updated_at: string;
}

export interface AbrirSinistroPayload {
  tipo: TipoSinistro;
  veiculo_id: string;
  data_ocorrencia: string;
  local_ocorrencia: string;
  descricao: string;
  boletim_ocorrencia?: string;
}

// ============================================
// INTERFACES — NOTIFICAÇÕES
// ============================================

export interface NotificacaoApp {
  id: string;
  tipo: 'boleto' | 'assistencia' | 'sinistro' | 'documento' | 'geral';
  titulo: string;
  mensagem: string;
  lida: boolean;
  data: string;
  link?: string;
}

// ============================================
// INTERFACES — RESUMO HOME
// ============================================

export interface ResumoAssociadoApp {
  associado: AssociadoApp;
  veiculos: VeiculoApp[];
  boleto_pendente?: BoletoApp;
  assistencias_ativas: number;
  sinistros_abertos: number;
  notificacoes_nao_lidas: number;
}

// ============================================
// ITENS DE NAVEGAÇÃO
// ============================================

export interface NavItemApp {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: number;
}
