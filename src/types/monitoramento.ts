// ============================================
// ENUMS E TIPOS BASE
// ============================================

export type StatusInstalacao = 
  | 'pendente' 
  | 'agendada' 
  | 'em_rota' 
  | 'em_andamento' 
  | 'concluida' 
  | 'reagendada' 
  | 'cancelada' 
  | 'nao_realizada';

export type PeriodoInstalacao = 'manha' | 'tarde' | 'noite';

export type StatusRota = 'planejada' | 'em_andamento' | 'concluida' | 'cancelada';

export type StatusRastreador = 
  | 'disponivel' 
  | 'reservado' 
  | 'instalado' 
  | 'manutencao' 
  | 'defeito' 
  | 'perdido';

export type PlataformaRastreador = 'rede_veiculos' | 'soft_truck' | 'nenhum';

// ============================================
// LABELS E CORES
// ============================================

export const STATUS_INSTALACAO_LABELS: Record<StatusInstalacao, string> = {
  pendente: 'Pendente',
  agendada: 'Agendada',
  em_rota: 'Em Rota',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  reagendada: 'Reagendada',
  cancelada: 'Cancelada',
  nao_realizada: 'Não Realizada',
};

export const STATUS_INSTALACAO_COLORS: Record<StatusInstalacao, string> = {
  pendente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  agendada: 'bg-blue-100 text-blue-800 border-blue-300',
  em_rota: 'bg-purple-100 text-purple-800 border-purple-300',
  em_andamento: 'bg-orange-100 text-orange-800 border-orange-300',
  concluida: 'bg-green-100 text-green-800 border-green-300',
  reagendada: 'bg-gray-100 text-gray-800 border-gray-300',
  cancelada: 'bg-red-100 text-red-800 border-red-300',
  nao_realizada: 'bg-red-100 text-red-800 border-red-300',
};

export const PERIODO_LABELS: Record<PeriodoInstalacao, string> = {
  manha: 'Manhã (08h-12h)',
  tarde: 'Tarde (13h-17h)',
  noite: 'Noite (18h-21h)',
};

export const STATUS_ROTA_LABELS: Record<StatusRota, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const STATUS_ROTA_COLORS: Record<StatusRota, string> = {
  planejada: 'bg-blue-100 text-blue-800',
  em_andamento: 'bg-orange-100 text-orange-800',
  concluida: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-800',
};

export const STATUS_RASTREADOR_LABELS: Record<StatusRastreador, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  instalado: 'Instalado',
  manutencao: 'Em Manutenção',
  defeito: 'Com Defeito',
  perdido: 'Perdido',
};

export const STATUS_RASTREADOR_COLORS: Record<StatusRastreador, string> = {
  disponivel: 'bg-green-100 text-green-800',
  reservado: 'bg-blue-100 text-blue-800',
  instalado: 'bg-purple-100 text-purple-800',
  manutencao: 'bg-yellow-100 text-yellow-800',
  defeito: 'bg-red-100 text-red-800',
  perdido: 'bg-gray-100 text-gray-800',
};

// ============================================
// INTERFACES PRINCIPAIS
// ============================================

export interface Instalador {
  id: string;
  usuario_id: string;
  nome: string;
  telefone: string;
  email?: string;
  ativo: boolean;
  regioes_atendimento: string[];
  created_at: string;
  updated_at: string;
}

export interface Rastreador {
  id: string;
  codigo: string;
  numero_serie: string;
  modelo: string;
  imei: string;
  plataforma: PlataformaRastreador;
  status: StatusRastreador;
  veiculo_id?: string;
  instalacao_id?: string;
  data_compra?: string;
  garantia_ate?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface Instalacao {
  id: string;
  associado_id: string;
  veiculo_id: string;
  rastreador_id?: string;
  instalador_id?: string;
  rota_id?: string;
  status: StatusInstalacao;
  data_agendada: string;
  periodo: PeriodoInstalacao;
  endereco_cep: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento?: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  observacoes?: string;
  motivo_cancelamento?: string;
  motivo_reagendamento?: string;
  data_realizada?: string;
  hora_inicio?: string;
  hora_fim?: string;
  foto_instalacao_url?: string;
  assinatura_cliente_url?: string;
  created_at: string;
  updated_at: string;
}

export interface InstalacaoComRelacoes extends Instalacao {
  associado?: {
    id: string;
    nome: string;
    telefone: string;
    email?: string;
  };
  veiculo?: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    ano_modelo: number;
    cor: string;
  };
  rastreador?: {
    id: string;
    codigo: string;
    modelo: string;
    imei: string;
  };
  instalador?: {
    id: string;
    nome: string;
    telefone: string;
  };
}

export interface Rota {
  id: string;
  codigo: string;
  data: string;
  instalador_id: string;
  regiao: string;
  status: StatusRota;
  ordem_instalacoes: string[];
  km_estimado?: number;
  km_realizado?: number;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface RotaComRelacoes extends Rota {
  instalador?: Instalador;
  instalacoes?: InstalacaoResumo[];
  total_instalacoes?: number;
  concluidas?: number;
}

export interface InstalacaoResumo {
  id: string;
  cliente: string;
  placa: string;
  endereco: string;
  periodo: PeriodoInstalacao;
  status: StatusInstalacao;
}

// ============================================
// FILTROS
// ============================================

export interface InstalacaoFilters {
  search?: string;
  status?: StatusInstalacao | StatusInstalacao[];
  periodo?: PeriodoInstalacao;
  instalador_id?: string;
  data_inicio?: string;
  data_fim?: string;
  regiao?: string;
  sem_instalador?: boolean;
}

export interface RotaFilters {
  data?: string;
  instalador_id?: string;
  status?: StatusRota;
  regiao?: string;
}

export interface RastreadorFilters {
  search?: string;
  status?: StatusRastreador;
  plataforma?: PlataformaRastreador;
  disponivel?: boolean;
}

// ============================================
// PAYLOADS E AÇÕES
// ============================================

export interface AgendarInstalacaoPayload {
  associado_id: string;
  veiculo_id: string;
  data_agendada: string;
  periodo: PeriodoInstalacao;
  endereco_cep: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento?: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  observacoes?: string;
}

export interface AtribuirInstaladorPayload {
  instalacao_id: string;
  instalador_id: string;
  rastreador_id?: string;
}

export interface ReagendarInstalacaoPayload {
  instalacao_id: string;
  nova_data: string;
  novo_periodo: PeriodoInstalacao;
  motivo: string;
}

export interface ConcluirInstalacaoPayload {
  instalacao_id: string;
  rastreador_id: string;
  hora_inicio: string;
  hora_fim: string;
  foto_instalacao_url?: string;
  assinatura_cliente_url?: string;
  observacoes?: string;
}

export interface CriarRotaPayload {
  data: string;
  instalador_id: string;
  regiao: string;
  instalacoes_ids: string[];
}

// ============================================
// CONTAGENS E ESTATÍSTICAS
// ============================================

export interface ContagemInstalacoes {
  total: number;
  pendentes: number;
  agendadas: number;
  em_andamento: number;
  concluidas_hoje: number;
}

export interface ContagemRastreadores {
  total: number;
  disponiveis: number;
  reservados: number;
  instalados: number;
  manutencao: number;
}

export interface EstatisticasInstalador {
  instalador_id: string;
  nome: string;
  total_mes: number;
  concluidas_mes: number;
  taxa_sucesso: number;
  tempo_medio_minutos: number;
}

// ============================================
// REGIÕES
// ============================================

export const REGIOES_ATENDIMENTO = [
  { value: 'sp_centro', label: 'São Paulo - Centro' },
  { value: 'sp_zona_sul', label: 'São Paulo - Zona Sul' },
  { value: 'sp_zona_norte', label: 'São Paulo - Zona Norte' },
  { value: 'sp_zona_leste', label: 'São Paulo - Zona Leste' },
  { value: 'sp_zona_oeste', label: 'São Paulo - Zona Oeste' },
  { value: 'abc', label: 'ABC Paulista' },
  { value: 'campinas', label: 'Campinas e Região' },
  { value: 'santos', label: 'Santos e Baixada' },
  { value: 'sorocaba', label: 'Sorocaba e Região' },
  { value: 'outros', label: 'Outras Regiões' },
];
