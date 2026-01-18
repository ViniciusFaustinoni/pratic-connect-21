// Tipos manuais para o SGA PRATIC 2.0
// Complementam os tipos gerados automaticamente pelo Supabase

// ============================================================
// ALIASES PARA COMPATIBILIDADE COM PRD
// profiles === usuarios (do PRD)
// user_roles === perfis_acesso (do PRD)
// ============================================================

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
  | 'associado'
  | 'analista_marketing'
  | 'analista_juridico';

export type TipoUsuario = 'funcionario' | 'associado' | 'prestador';

// Etapas do funil de vendas (11 etapas conforme PRD)
export type EtapaLead =
  | 'novo'
  | 'contato_inicial'      // Mantido para compatibilidade, mapeia para 'contato'
  | 'contato'
  | 'apresentacao'         // Mantido para compatibilidade, mapeia para 'qualificado'
  | 'qualificado'
  | 'cotacao_enviada'
  | 'negociacao'
  | 'vistoria_agendada'
  | 'contrato_enviado'
  | 'contrato_assinado'
  | 'instalacao_agendada'
  | 'ganho'
  | 'perdido';

export type OrigemLead =
  | 'indicacao'
  | 'site'
  | 'whatsapp'
  | 'facebook'
  | 'instagram'
  | 'google'
  | 'telefone'
  | 'presencial'
  | 'parceiro'
  | 'outro'
  | 'api'
  | 'cotador';

export type MotivoPerda =
  | 'preco'
  | 'concorrencia'
  | 'desistiu'
  | 'nao_qualificado'
  | 'veiculo_reprovado'
  | 'nao_respondeu'
  | 'outro';

export type StatusAssociado =
  | 'em_analise'
  | 'aprovado'
  | 'documentacao_pendente'
  | 'aguardando_instalacao'
  | 'ativo'
  | 'inadimplente'
  | 'suspenso'
  | 'cancelado'
  | 'bloqueado';

export type StatusDocumento = 'pendente' | 'em_analise' | 'aprovado' | 'reprovado' | 'expirado';

// Status do veículo
export type StatusVeiculo =
  | 'em_analise'
  | 'aprovado'
  | 'instalacao_pendente'
  | 'ativo'
  | 'suspenso'
  | 'cancelado'
  | 'sinistrado';

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

export type StatusContrato = 'rascunho' | 'pendente' | 'pendente_assinatura' | 'enviado' | 'visualizado' | 'assinado' | 'ativo' | 'suspenso' | 'cancelado' | 'expirado';

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
  bloqueado?: boolean;
  motivo_bloqueio?: string;
  avatar_url?: string;
  data_ultimo_acesso?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

// ============================================================
// ALIASES PARA COMPATIBILIDADE COM PRD
// ============================================================

/** Alias: profiles === usuarios (nomenclatura do PRD) */
export type Usuario = Profile;

/** Alias: user_roles === perfis_acesso (nomenclatura do PRD) */
export type PerfilAcesso = UserRole;

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
  fonte_id?: string;
  indicador_id?: string;
  observacoes?: string;
  motivo_perda?: MotivoPerda | string;
  observacao_perda?: string;
  data_primeiro_contato?: string;
  data_ultimo_contato?: string;
  data_proxima_acao?: string;
  data_perda?: string;
  data_conversao?: string;
  associado_id?: string;
  created_at: string;
  updated_at: string;
}

export interface LeadHistorico {
  id: string;
  lead_id: string;
  usuario_id?: string;
  etapa_anterior?: EtapaLead;
  etapa_nova?: EtapaLead;
  acao: string;
  descricao?: string;
  created_at: string;
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

// Labels para exibição - 11 etapas do funil
export const ETAPA_LABELS: Record<EtapaLead, string> = {
  novo: 'Novo',
  contato_inicial: 'Contato',      // Alias para compatibilidade
  contato: 'Contato',
  apresentacao: 'Qualificado',     // Alias para compatibilidade
  qualificado: 'Qualificado',
  cotacao_enviada: 'Cotação Enviada',
  negociacao: 'Negociação',
  vistoria_agendada: 'Vistoria Agendada',
  contrato_enviado: 'Contrato Enviado',
  contrato_assinado: 'Contrato Assinado',
  instalacao_agendada: 'Instalação Agendada',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

export const MOTIVO_PERDA_LABELS: Record<MotivoPerda, string> = {
  preco: 'Preço',
  concorrencia: 'Concorrência',
  desistiu: 'Desistiu',
  nao_qualificado: 'Não Qualificado',
  veiculo_reprovado: 'Veículo Reprovado',
  nao_respondeu: 'Não Respondeu',
  outro: 'Outro',
};

export const ORIGEM_LABELS: Record<OrigemLead, string> = {
  indicacao: 'Indicação',
  site: 'Site',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google',
  telefone: 'Telefone',
  presencial: 'Presencial',
  parceiro: 'Parceiro',
  outro: 'Outro',
  api: 'API',
  cotador: 'Cotador',
};

export const STATUS_ASSOCIADO_LABELS: Record<StatusAssociado, string> = {
  em_analise: 'Em Análise',
  aprovado: 'Aprovado',
  documentacao_pendente: 'Doc. Pendente',
  aguardando_instalacao: 'Aguard. Instalação',
  ativo: 'Ativo',
  inadimplente: 'Inadimplente',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
  bloqueado: 'Bloqueado',
};

export const STATUS_DOCUMENTO_LABELS: Record<StatusDocumento, string> = {
  pendente: 'Pendente',
  em_analise: 'Em Análise',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  expirado: 'Expirado',
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
  analista_marketing: 'Analista de Marketing',
  analista_juridico: 'Analista Jurídico',
};

export const STATUS_RASTREADOR_LABELS: Record<StatusRastreador, string> = {
  estoque: 'Em Estoque',
  instalado: 'Instalado',
  manutencao: 'Manutenção',
  baixado: 'Baixado',
};

export const STATUS_RASTREADOR_COLORS: Record<StatusRastreador, string> = {
  estoque: 'bg-gray-100 text-gray-800',
  instalado: 'bg-green-100 text-green-800',
  manutencao: 'bg-yellow-100 text-yellow-800',
  baixado: 'bg-red-100 text-red-800',
};

/**
 * @deprecated Use usePlataformasLabels() hook instead - busca dinamicamente do banco de dados
 */
export const PLATAFORMA_RASTREADOR_LABELS: Record<string, string> = {
  rede_veiculos: 'Rede Veículos',
  softruck: 'Softruck',
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

export const STATUS_INSTALACAO_COLORS: Record<StatusInstalacao, string> = {
  agendada: 'bg-blue-100 text-blue-800',
  em_rota: 'bg-purple-100 text-purple-800',
  em_andamento: 'bg-amber-100 text-amber-800',
  concluida: 'bg-green-100 text-green-800',
  reagendada: 'bg-orange-100 text-orange-800',
  cancelada: 'bg-red-100 text-red-800',
};

// Alias for PERIODO_INSTALACAO_LABELS
export const PERIODO_LABELS = {
  manha: 'Manhã (08h - 12h)',
  tarde: 'Tarde (13h - 17h)',
  noite: 'Noite (18h - 21h)',
} as const;

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

export const STATUS_CONTRATO_LABELS: Record<StatusContrato, string> = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  pendente_assinatura: 'Aguardando Assinatura',
  enviado: 'Enviado',
  visualizado: 'Visualizado',
  assinado: 'Assinado',
  ativo: 'Ativo',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
};

export const TIPO_VISTORIA_LABELS: Record<TipoVistoria, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  sinistro: 'Sinistro',
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

// Motivos de reprovação de documento
export type MotivoReprovacaoDocumento =
  | 'documento_ilegivel'
  | 'documento_vencido'
  | 'dados_nao_conferem'
  | 'foto_ma_qualidade'
  | 'documento_incompleto'
  | 'documento_terceiro'
  | 'outro';

export const MOTIVO_REPROVACAO_DOCUMENTO_LABELS: Record<MotivoReprovacaoDocumento, string> = {
  documento_ilegivel: 'Documento ilegível',
  documento_vencido: 'Documento vencido',
  dados_nao_conferem: 'Dados não conferem com cadastro',
  foto_ma_qualidade: 'Foto de má qualidade',
  documento_incompleto: 'Documento incompleto / cortado',
  documento_terceiro: 'Documento de terceiro',
  outro: 'Outro',
};

// Cores dos badges por tipo de documento
export const TIPO_DOCUMENTO_COLORS: Record<TipoDocumento, string> = {
  cnh: 'bg-blue-100 text-blue-800',
  crlv: 'bg-green-100 text-green-800',
  comprovante_residencia: 'bg-purple-100 text-purple-800',
  foto_frontal_veiculo: 'bg-orange-100 text-orange-800',
  foto_traseira_veiculo: 'bg-orange-100 text-orange-800',
  foto_lateral_esquerda: 'bg-orange-100 text-orange-800',
  foto_lateral_direita: 'bg-orange-100 text-orange-800',
  foto_painel: 'bg-orange-100 text-orange-800',
  foto_hodometro: 'bg-yellow-100 text-yellow-800',
  outro: 'bg-gray-100 text-gray-800',
};

// Cores dos badges por status de documento
export const STATUS_DOCUMENTO_COLORS: Record<StatusDocumento, string> = {
  pendente: 'bg-gray-100 text-gray-800',
  em_analise: 'bg-yellow-100 text-yellow-800',
  aprovado: 'bg-green-100 text-green-800',
  reprovado: 'bg-red-100 text-red-800',
  expirado: 'bg-gray-100 text-gray-600',
};

// ============================================================
// MÓDULO OFICINAS
// ============================================================

export type StatusOficina = 'ativo' | 'inativo' | 'suspenso' | 'bloqueado';

export type StatusOrdemServico =
  | 'rascunho'
  | 'aguardando_orcamento'
  | 'orcamento_enviado'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'em_execucao'
  | 'aguardando_peca'
  | 'concluido'
  | 'aguardando_pagamento'
  | 'pago'
  | 'cancelado';

export type TipoItemOS = 'peca' | 'mao_de_obra' | 'servico_terceiro';

export type TipoFotoOS = 'entrada' | 'execucao' | 'conclusao';

export type TipoPix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export type StatusPagamentoOficina = 'pendente' | 'processando' | 'pago' | 'cancelado';

export type FormaPagamentoOficina = 'pix' | 'transferencia' | 'boleto' | 'cheque';

export interface Oficina {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  inscricao_estadual?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  estado: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  pix_chave?: string;
  pix_tipo?: TipoPix;
  especialidades: string[];
  nota_media: number;
  total_avaliacoes: number;
  status: StatusOficina;
  created_at: string;
  updated_at: string;
}

export interface OrdemServico {
  id: string;
  numero: string;
  sinistro_id?: string;
  oficina_id: string;
  veiculo_id: string;
  associado_id: string;
  criado_por?: string;
  aprovado_por?: string;
  data_entrada?: string;
  data_previsao?: string;
  data_conclusao?: string;
  valor_orcamento: number;
  valor_aprovado?: number;
  valor_pago?: number;
  status: StatusOrdemServico;
  observacoes?: string;
  observacoes_internas?: string;
  created_at: string;
  updated_at: string;
  // Joins (partial for select queries)
  oficina?: Partial<Oficina>;
  veiculo?: Partial<Veiculo>;
  associado?: { id: string; nome: string; telefone?: string; email?: string };
}

export interface OrdemServicoItem {
  id: string;
  ordem_servico_id: string;
  tipo: TipoItemOS;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  aprovado: boolean;
  marca?: string;
  numero_peca?: string;
  created_at: string;
}

export interface OrdemServicoHistorico {
  id: string;
  ordem_servico_id: string;
  status_anterior?: string;
  status_novo: string;
  usuario_id?: string;
  observacao?: string;
  created_at: string;
  usuario?: { nome: string };
}

export interface OrdemServicoFoto {
  id: string;
  ordem_servico_id: string;
  tipo: TipoFotoOS;
  descricao?: string;
  arquivo_url: string;
  created_at: string;
}

export interface OficinaPagamento {
  id: string;
  oficina_id: string;
  ordem_servico_id?: string;
  valor: number;
  forma_pagamento?: FormaPagamentoOficina;
  comprovante_url?: string;
  status: StatusPagamentoOficina;
  data_pagamento?: string;
  pago_por?: string;
  observacao?: string;
  created_at: string;
}

// Labels para enums de Oficinas
export const STATUS_OFICINA_LABELS: Record<StatusOficina, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  suspenso: 'Suspenso',
  bloqueado: 'Bloqueado',
};

export const STATUS_ORDEM_SERVICO_LABELS: Record<StatusOrdemServico, string> = {
  rascunho: 'Rascunho',
  aguardando_orcamento: 'Aguardando Orçamento',
  orcamento_enviado: 'Orçamento Enviado',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado: 'Aprovado',
  em_execucao: 'Em Execução',
  aguardando_peca: 'Aguardando Peça',
  concluido: 'Concluído',
  aguardando_pagamento: 'Aguardando Pagamento',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

export const TIPO_ITEM_OS_LABELS: Record<TipoItemOS, string> = {
  peca: 'Peça',
  mao_de_obra: 'Mão de Obra',
  servico_terceiro: 'Serviço Terceiro',
};

export const TIPO_FOTO_OS_LABELS: Record<TipoFotoOS, string> = {
  entrada: 'Entrada',
  execucao: 'Execução',
  conclusao: 'Conclusão',
};

export const FORMA_PAGAMENTO_OFICINA_LABELS: Record<FormaPagamentoOficina, string> = {
  pix: 'PIX',
  transferencia: 'Transferência',
  boleto: 'Boleto',
  cheque: 'Cheque',
};

export const STATUS_PAGAMENTO_OFICINA_LABELS: Record<StatusPagamentoOficina, string> = {
  pendente: 'Pendente',
  processando: 'Processando',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

export const STATUS_PAGAMENTO_OFICINA_COLORS: Record<StatusPagamentoOficina, string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  processando: 'bg-blue-100 text-blue-800',
  pago: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
};

export const PIX_TIPO_LABELS: Record<TipoPix, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave Aleatória',
};

// Cores para badges
export const STATUS_OFICINA_COLORS: Record<StatusOficina, string> = {
  ativo: 'bg-green-100 text-green-800',
  inativo: 'bg-gray-100 text-gray-800',
  suspenso: 'bg-yellow-100 text-yellow-800',
  bloqueado: 'bg-red-100 text-red-800',
};

export const STATUS_ORDEM_SERVICO_COLORS: Record<StatusOrdemServico, string> = {
  rascunho: 'bg-gray-100 text-gray-800',
  aguardando_orcamento: 'bg-yellow-100 text-yellow-800',
  orcamento_enviado: 'bg-blue-100 text-blue-800',
  aguardando_aprovacao: 'bg-orange-100 text-orange-800',
  aprovado: 'bg-green-100 text-green-800',
  em_execucao: 'bg-purple-100 text-purple-800',
  aguardando_peca: 'bg-amber-100 text-amber-800',
  concluido: 'bg-teal-100 text-teal-800',
  aguardando_pagamento: 'bg-indigo-100 text-indigo-800',
  pago: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-red-100 text-red-800',
};

// Especialidades de oficinas
export const ESPECIALIDADES_OFICINA = [
  'funilaria',
  'pintura',
  'mecanica',
  'eletrica',
  'vidros',
  'ar_condicionado',
  'suspensao',
  'freios',
] as const;

export type EspecialidadeOficina = typeof ESPECIALIDADES_OFICINA[number];

export const ESPECIALIDADE_LABELS: Record<EspecialidadeOficina, string> = {
  funilaria: 'Funilaria',
  pintura: 'Pintura',
  mecanica: 'Mecânica',
  eletrica: 'Elétrica',
  vidros: 'Vidros',
  ar_condicionado: 'Ar Condicionado',
  suspensao: 'Suspensão',
  freios: 'Freios',
};

// Bancos brasileiros principais
export const BANCOS_BRASIL = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '104', nome: 'Caixa Econômica' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '341', nome: 'Itaú' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '077', nome: 'Inter' },
  { codigo: '260', nome: 'Nubank' },
  { codigo: '336', nome: 'C6 Bank' },
] as const;

// UFs brasileiras
export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

// ============================================================
// MÓDULO FINANCEIRO
// ============================================================

// Status Faturamento
export type StatusFaturamento = 'rascunho' | 'processando' | 'gerado' | 'enviado' | 'fechado' | 'cancelado';

// Status Conta a Pagar
export type StatusContaPagar = 'pendente' | 'aprovado' | 'pago' | 'cancelado' | 'vencido';

// Categoria Conta a Pagar
export type CategoriaContaPagar = 
  | 'prestador_assistencia' 
  | 'oficina' 
  | 'fornecedor' 
  | 'folha_pagamento' 
  | 'impostos' 
  | 'aluguel' 
  | 'servicos' 
  | 'marketing' 
  | 'outros';

// Tipo Movimentação Financeira
export type TipoMovimentacao = 'entrada' | 'saida';

// Labels
export const STATUS_FATURAMENTO_LABELS: Record<StatusFaturamento, string> = {
  rascunho: 'Rascunho',
  processando: 'Processando',
  gerado: 'Gerado',
  enviado: 'Enviado',
  fechado: 'Fechado',
  cancelado: 'Cancelado',
};

export const STATUS_CONTA_PAGAR_LABELS: Record<StatusContaPagar, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  pago: 'Pago',
  cancelado: 'Cancelado',
  vencido: 'Vencido',
};

export const CATEGORIA_CONTA_PAGAR_LABELS: Record<CategoriaContaPagar, string> = {
  prestador_assistencia: 'Prestador Assistência',
  oficina: 'Oficina',
  fornecedor: 'Fornecedor',
  folha_pagamento: 'Folha de Pagamento',
  impostos: 'Impostos',
  aluguel: 'Aluguel',
  servicos: 'Serviços',
  marketing: 'Marketing',
  outros: 'Outros',
};

export const TIPO_MOVIMENTACAO_LABELS: Record<TipoMovimentacao, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
};

// Interfaces
export interface Faturamento {
  id: string;
  referencia_mes: number;
  referencia_ano: number;
  total_associados: number;
  total_cobrancas: number;
  valor_total: number;
  valor_pago: number;
  valor_pendente: number;
  status: StatusFaturamento;
  data_vencimento?: string;
  data_geracao?: string;
  data_envio?: string;
  data_fechamento?: string;
  gerado_por?: string;
  created_at: string;
  updated_at: string;
}

export interface ContaPagar {
  id: string;
  fornecedor_nome: string;
  fornecedor_documento?: string;
  categoria: CategoriaContaPagar;
  subcategoria?: string;
  referencia_id?: string;
  referencia_tipo?: string;
  valor: number;
  valor_pago: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento?: string;
  forma_pagamento?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  pix_chave?: string;
  comprovante_url?: string;
  status: StatusContaPagar;
  aprovado_por?: string;
  aprovado_em?: string;
  pago_por?: string;
  observacao?: string;
  created_at: string;
  updated_at: string;
}

export interface MovimentacaoFinanceira {
  id: string;
  tipo: TipoMovimentacao;
  categoria: string;
  referencia_tipo?: string;
  referencia_id?: string;
  valor: number;
  data_movimentacao: string;
  data_competencia?: string;
  descricao: string;
  observacao?: string;
  registrado_por?: string;
  created_at: string;
}
