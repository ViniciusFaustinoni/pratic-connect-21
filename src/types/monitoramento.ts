// ============================================
// ENUMS E TIPOS BASE (alinhados com o banco)
// ============================================

// Usar os tipos do banco diretamente para status de instalação
export type StatusInstalacao = 
  | 'agendada' 
  | 'em_rota' 
  | 'em_andamento' 
  | 'concluida' 
  | 'reagendada' 
  | 'cancelada';

export type PeriodoInstalacao = 'manha' | 'tarde' | 'noite';

export type StatusRota = 'planejada' | 'em_andamento' | 'concluida' | 'cancelada';

export type StatusRastreador = 'estoque' | 'instalado' | 'manutencao' | 'baixado';

export type PlataformaRastreador = 'rede_veiculos' | 'soft_truck' | 'nenhum';

// ============================================
// LABELS E CORES
// ============================================

export const STATUS_INSTALACAO_LABELS: Record<StatusInstalacao, string> = {
  agendada: 'Agendada',
  em_rota: 'Em Rota',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  reagendada: 'Reagendada',
  cancelada: 'Cancelada',
};

export const STATUS_INSTALACAO_COLORS: Record<StatusInstalacao, string> = {
  agendada: 'bg-blue-100 text-blue-800 border-blue-300',
  em_rota: 'bg-purple-100 text-purple-800 border-purple-300',
  em_andamento: 'bg-orange-100 text-orange-800 border-orange-300',
  concluida: 'bg-green-100 text-green-800 border-green-300',
  reagendada: 'bg-gray-100 text-gray-800 border-gray-300',
  cancelada: 'bg-red-100 text-red-800 border-red-300',
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
  estoque: 'Em Estoque',
  instalado: 'Instalado',
  manutencao: 'Em Manutenção',
  baixado: 'Baixado',
};

export const STATUS_RASTREADOR_COLORS: Record<StatusRastreador, string> = {
  estoque: 'bg-green-100 text-green-800',
  instalado: 'bg-purple-100 text-purple-800',
  manutencao: 'bg-yellow-100 text-yellow-800',
  baixado: 'bg-gray-100 text-gray-800',
};

// ============================================
// INTERFACES PRINCIPAIS
// ============================================

export interface Instalador {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
}

export interface Rastreador {
  id: string;
  codigo: string;
  numero_serie?: string | null;
  imei?: string | null;
  status: StatusRastreador;
  veiculo_id?: string | null;
}

export interface Instalacao {
  id: string;
  associado_id: string;
  veiculo_id: string;
  rastreador_id?: string | null;
  instalador_id?: string | null;
  status: StatusInstalacao;
  data_agendada: string;
  periodo: PeriodoInstalacao;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  observacoes?: string | null;
  motivo_cancelamento?: string | null;
  motivo_reagendamento?: string | null;
  data_realizada?: string | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  foto_instalacao_url?: string | null;
  assinatura_cliente_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstalacaoComRelacoes extends Instalacao {
  // Nomes usados pelo banco (join padrão)
  associados?: {
    id: string;
    nome: string;
    telefone?: string | null;
    email?: string | null;
    cpf?: string | null;
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
  } | null;
  veiculos?: {
    id: string;
    placa: string;
    marca?: string | null;
    modelo?: string | null;
    ano_modelo?: number | null;
    cor?: string | null;
    chassi?: string | null;
    renavam?: string | null;
  } | null;
  rastreadores?: {
    id: string;
    codigo: string;
    numero_serie?: string | null;
    imei?: string | null;
  } | null;
  // Profile do instalador (join com alias)
  profiles?: {
    id: string;
    nome: string;
    telefone?: string | null;
    email?: string | null;
  } | null;
}

export interface Rota {
  id: string;
  codigo: string;
  data_rota: string;
  instalador_id: string;
  regiao?: string | null;
  status: StatusRota;
  km_estimado?: number | null;
  km_realizado?: number | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RotaComRelacoes extends Rota {
  instalador?: Instalador | null;
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
  status?: StatusInstalacao[];
  periodo?: PeriodoInstalacao;
  instaladorId?: string;
  dataInicio?: Date;
  dataFim?: Date;
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
}

// ============================================
// PAYLOADS E AÇÕES
// ============================================

export interface AgendarInstalacaoPayload {
  associado_id: string;
  veiculo_id: string;
  data_agendada: string;
  periodo: PeriodoInstalacao;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  observacoes?: string | null;
  rastreador_id?: string | null;
  instalador_id?: string | null;
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

// Métricas
export interface InstalacoesMetricas {
  agendadas: number;
  emRota: number;
  concluidasHoje: number;
  reagendadas: number;
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
