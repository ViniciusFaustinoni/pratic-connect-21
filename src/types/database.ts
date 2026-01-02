// Tipos manuais para o SGA PRATIC 2.0
// Complementam os tipos gerados automaticamente pelo Supabase

export type AppRole =
  | 'diretor'
  | 'gerente_comercial'
  | 'supervisor_vendas'
  | 'vendedor_clt'
  | 'vendedor_externo'
  | 'analista_cadastro'
  | 'coordenador_monitoramento'
  | 'analista_plataforma'
  | 'instalador_vistoriador'
  | 'associado';

export type TipoUsuario = 'funcionario' | 'associado' | 'prestador';

export type EtapaLead =
  | 'novo'
  | 'contato_inicial'
  | 'apresentacao'
  | 'cotacao_enviada'
  | 'negociacao'
  | 'ganho'
  | 'perdido';

export type OrigemLead =
  | 'indicacao'
  | 'site'
  | 'facebook'
  | 'instagram'
  | 'google'
  | 'telefone'
  | 'presencial'
  | 'parceiro'
  | 'outro'
  | 'api';

export type StatusAssociado =
  | 'em_analise'
  | 'documentacao_pendente'
  | 'aguardando_instalacao'
  | 'ativo'
  | 'inadimplente'
  | 'suspenso'
  | 'cancelado';

export type StatusDocumento = 'pendente' | 'em_analise' | 'aprovado' | 'reprovado';

export type TipoDocumento =
  | 'cnh'
  | 'crlv'
  | 'comprovante_residencia'
  | 'foto_frontal_veiculo'
  | 'foto_traseira_veiculo'
  | 'foto_lateral_esquerda'
  | 'foto_lateral_direita'
  | 'foto_painel'
  | 'foto_hodometro'
  | 'outro';

export type StatusCotacao = 'rascunho' | 'enviada' | 'aceita' | 'recusada' | 'expirada';

export type StatusContrato = 'pendente' | 'ativo' | 'suspenso' | 'cancelado';

// Novos tipos para as tabelas adicionadas
export type StatusRastreador = 'estoque' | 'instalado' | 'manutencao' | 'baixado';

export type StatusRota = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

export type StatusInstalacao = 'agendada' | 'em_rota' | 'em_andamento' | 'concluida' | 'reagendada' | 'cancelada';

export type StatusVistoria = 'pendente' | 'aprovada' | 'reprovada' | 'em_analise';

export type StatusChamado = 'aberto' | 'em_atendimento' | 'em_deslocamento' | 'concluido' | 'cancelado';

export type StatusSinistro = 'em_analise' | 'aprovado' | 'reprovado' | 'indenizado' | 'cancelado';

export type TipoVistoria = 'entrada' | 'saida' | 'sinistro';

export type TipoSinistro = 'roubo' | 'furto' | 'colisao' | 'incendio' | 'alagamento' | 'outro';

export type PeriodoInstalacao = 'manha' | 'tarde' | 'noite';

// Interfaces para as tabelas existentes
export interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone?: string;
  cpf?: string;
  tipo: TipoUsuario;
  ativo: boolean;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_ano?: number;
  veiculo_placa?: string;
  veiculo_fipe?: number;
  origem: OrigemLead;
  etapa: EtapaLead;
  vendedor_id?: string;
  observacoes?: string;
  motivo_perda?: string;
  fonte_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  nome: string;
  key_hash: string;
  key_prefix: string;
  ativa: boolean;
  created_by?: string;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface LeadFonte {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  vendedor_padrao_id?: string;
  etapa_inicial: EtapaLead;
  ativa: boolean;
  total_leads: number;
  created_at: string;
  updated_at: string;
}

export interface Plano {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  tipo_uso: string;
  fipe_minima?: number;
  fipe_maxima?: number;
  valor_adesao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TabelaPreco {
  id: string;
  plano_id: string;
  nome?: string;
  tipo_uso?: string;
  fipe_de: number;
  fipe_ate: number;
  valor_cota: number;
  taxa_administrativa: number;
  valor_rastreamento: number;
  valor_assistencia?: number;
  vigencia_inicio?: string;
  vigencia_fim?: string;
  ativo: boolean;
  created_at: string;
}

export interface Cotacao {
  id: string;
  numero: string;
  lead_id?: string;
  plano_id: string;
  valor_fipe: number;
  valor_cota: number;
  taxa_administrativa: number;
  valor_rastreamento: number;
  valor_adesao: number;
  valor_total_mensal: number;
  status: StatusCotacao;
  validade_dias: number;
  vendedor_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Contrato {
  id: string;
  numero: string;
  cotacao_id?: string;
  plano_id: string;
  associado_id?: string;
  valor_adesao: number;
  valor_mensal: number;
  data_inicio: string;
  data_fim?: string;
  status: StatusContrato;
  vendedor_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Associado {
  id: string;
  user_id?: string;
  contrato_id?: string;
  nome: string;
  cpf: string;
  rg?: string;
  data_nascimento?: string;
  sexo?: string;
  estado_civil?: string;
  profissao?: string;
  email: string;
  telefone: string;
  telefone_secundario?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  status: StatusAssociado;
  plano_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Veiculo {
  id: string;
  associado_id: string;
  placa: string;
  chassi?: string;
  renavam?: string;
  marca: string;
  modelo: string;
  ano_fabricacao: number;
  ano_modelo: number;
  cor?: string;
  combustivel?: string;
  valor_fipe?: number;
  codigo_fipe?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Documento {
  id: string;
  associado_id: string;
  veiculo_id?: string;
  tipo: TipoDocumento;
  nome_arquivo: string;
  arquivo_url: string;
  tamanho_bytes?: number;
  status: StatusDocumento;
  analista_id?: string;
  data_analise?: string;
  motivo_reprovacao?: string;
  created_at: string;
}

export interface Notificacao {
  id: string;
  user_id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  link?: string;
  created_at: string;
}

// Novas interfaces para tabelas adicionadas
export interface Rastreador {
  id: string;
  codigo: string;
  numero_serie?: string;
  imei?: string;
  chip_iccid?: string;
  plataforma: string;
  id_plataforma?: string;
  status: StatusRastreador;
  veiculo_id?: string;
  ultima_comunicacao?: string;
  ultima_posicao_lat?: number;
  ultima_posicao_lng?: number;
  created_at: string;
  updated_at: string;
}

export interface Rota {
  id: string;
  codigo: string;
  data_rota: string;
  instalador_id?: string;
  coordenador_id?: string;
  regiao?: string;
  cidade?: string;
  status: StatusRota;
  total_servicos: number;
  total_concluidos: number;
  created_at: string;
  updated_at: string;
}

export interface Instalacao {
  id: string;
  associado_id: string;
  veiculo_id: string;
  rastreador_id?: string;
  rota_id?: string;
  instalador_id?: string;
  data_agendada: string;
  periodo: PeriodoInstalacao;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  status: StatusInstalacao;
  observacoes?: string;
  assinatura_cliente_url?: string;
  created_at: string;
  updated_at: string;
}

export interface InstalacaoFoto {
  id: string;
  instalacao_id: string;
  tipo: string;
  arquivo_url: string;
  created_at: string;
}

export interface Vistoria {
  id: string;
  associado_id: string;
  veiculo_id: string;
  instalacao_id?: string;
  vistoriador_id?: string;
  tipo: TipoVistoria;
  km_atual?: number;
  avarias?: string;
  status: StatusVistoria;
  created_at: string;
  updated_at: string;
}

export interface VistoriaFoto {
  id: string;
  vistoria_id: string;
  tipo: string;
  arquivo_url: string;
  created_at: string;
}

export interface ChamadoAssistencia {
  id: string;
  associado_id: string;
  veiculo_id?: string;
  atendente_id?: string;
  protocolo: string;
  tipo_servico: string;
  descricao?: string;
  origem_cep?: string;
  origem_logradouro?: string;
  origem_cidade?: string;
  origem_uf?: string;
  origem_lat?: number;
  origem_lng?: number;
  destino_cep?: string;
  destino_logradouro?: string;
  destino_cidade?: string;
  destino_uf?: string;
  destino_lat?: number;
  destino_lng?: number;
  prestador_nome?: string;
  prestador_telefone?: string;
  status: StatusChamado;
  data_abertura: string;
  data_conclusao?: string;
  avaliacao_nota?: number;
  canal: string;
  created_at: string;
  updated_at: string;
}

export interface Sinistro {
  id: string;
  associado_id: string;
  veiculo_id: string;
  protocolo: string;
  tipo: TipoSinistro;
  data_ocorrencia: string;
  local_descricao?: string;
  descricao?: string;
  bo_numero?: string;
  bo_arquivo_url?: string;
  valor_fipe?: number;
  valor_indenizacao?: number;
  status: StatusSinistro;
  analista_id?: string;
  canal: string;
  created_at: string;
  updated_at: string;
}

// Labels para exibição
export const ETAPA_LABELS: Record<EtapaLead, string> = {
  novo: 'Novo',
  contato_inicial: 'Contato Inicial',
  apresentacao: 'Apresentação',
  cotacao_enviada: 'Cotação Enviada',
  negociacao: 'Negociação',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

export const ORIGEM_LABELS: Record<OrigemLead, string> = {
  indicacao: 'Indicação',
  site: 'Site',
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google',
  telefone: 'Telefone',
  presencial: 'Presencial',
  parceiro: 'Parceiro',
  outro: 'Outro',
  api: 'API',
};

export const STATUS_ASSOCIADO_LABELS: Record<StatusAssociado, string> = {
  em_analise: 'Em Análise',
  documentacao_pendente: 'Doc. Pendente',
  aguardando_instalacao: 'Aguard. Instalação',
  ativo: 'Ativo',
  inadimplente: 'Inadimplente',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
};

export const STATUS_DOCUMENTO_LABELS: Record<StatusDocumento, string> = {
  pendente: 'Pendente',
  em_analise: 'Em Análise',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
};

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  cnh: 'CNH',
  crlv: 'CRLV',
  comprovante_residencia: 'Comprovante de Residência',
  foto_frontal_veiculo: 'Foto Frontal',
  foto_traseira_veiculo: 'Foto Traseira',
  foto_lateral_esquerda: 'Foto Lateral Esquerda',
  foto_lateral_direita: 'Foto Lateral Direita',
  foto_painel: 'Foto do Painel',
  foto_hodometro: 'Foto do Hodômetro',
  outro: 'Outro',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  diretor: 'Diretor',
  gerente_comercial: 'Gerente Comercial',
  supervisor_vendas: 'Supervisor de Vendas',
  vendedor_clt: 'Vendedor CLT',
  vendedor_externo: 'Vendedor Externo',
  analista_cadastro: 'Analista de Cadastro',
  coordenador_monitoramento: 'Coord. Monitoramento',
  analista_plataforma: 'Analista de Plataforma',
  instalador_vistoriador: 'Instalador/Vistoriador',
  associado: 'Associado',
};

export const STATUS_RASTREADOR_LABELS: Record<StatusRastreador, string> = {
  estoque: 'Em Estoque',
  instalado: 'Instalado',
  manutencao: 'Manutenção',
  baixado: 'Baixado',
};

export const STATUS_ROTA_LABELS: Record<StatusRota, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const STATUS_INSTALACAO_LABELS: Record<StatusInstalacao, string> = {
  agendada: 'Agendada',
  em_rota: 'Em Rota',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  reagendada: 'Reagendada',
  cancelada: 'Cancelada',
};

export const STATUS_VISTORIA_LABELS: Record<StatusVistoria, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
  em_analise: 'Em Análise',
};

export const STATUS_CHAMADO_LABELS: Record<StatusChamado, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em Atendimento',
  em_deslocamento: 'Em Deslocamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const STATUS_SINISTRO_LABELS: Record<StatusSinistro, string> = {
  em_analise: 'Em Análise',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  indenizado: 'Indenizado',
  cancelado: 'Cancelado',
};

export const TIPO_SINISTRO_LABELS: Record<TipoSinistro, string> = {
  roubo: 'Roubo',
  furto: 'Furto',
  colisao: 'Colisão',
  incendio: 'Incêndio',
  alagamento: 'Alagamento',
  outro: 'Outro',
};

export const PERIODO_INSTALACAO_LABELS: Record<PeriodoInstalacao, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};
