// ===== MÓDULO JURÍDICO - TIPOS =====

export type TipoAdvogado = 'interno' | 'externo' | 'escritorio';
export type TipoContratoAdvogado = 'fixo' | 'por_processo' | 'hibrido';

export type TipoProcesso = 'civel' | 'trabalhista' | 'criminal' | 'consumidor' | 'transito' | 'administrativo' | 'tributario' | 'outros';
export type NaturezaProcesso = 'autor' | 'reu' | 'terceiro_interessado' | 'assistente';
export type RitoProcesso = 'ordinario' | 'sumario' | 'sumarissimo' | 'especial' | 'juizado';
export type StatusProcesso = 'ativo' | 'suspenso' | 'arquivado' | 'encerrado_procedente' | 'encerrado_improcedente' | 'acordo' | 'desistencia' | 'extinto';
export type FaseProcesso = 'inicial' | 'citacao' | 'contestacao' | 'instrucao' | 'alegacoes_finais' | 'sentenca' | 'recurso' | 'execucao' | 'cumprimento_sentenca' | 'encerrado';

export type TipoAndamento = 'despacho' | 'decisao' | 'sentenca' | 'acordao' | 'peticao' | 'audiencia' | 'pericia' | 'citacao' | 'intimacao' | 'publicacao' | 'outros';

export type PrioridadePrazo = 'baixa' | 'normal' | 'alta' | 'urgente';
export type StatusPrazo = 'pendente' | 'em_andamento' | 'cumprido' | 'perdido' | 'cancelado';

export type TipoDocumentoProcesso = 'peticao_inicial' | 'contestacao' | 'replica' | 'recurso' | 'contrarrazoes' | 'sentenca' | 'acordao' | 'procuracao' | 'substabelecimento' | 'laudo' | 'ata_audiencia' | 'comprovante' | 'notificacao' | 'outros';

export type TipoAudiencia = 'conciliacao' | 'instrucao' | 'julgamento' | 'una' | 'especial';
export type StatusAudiencia = 'agendada' | 'realizada' | 'adiada' | 'cancelada' | 'redesignada';

export type TipoCusta = 'custas_iniciais' | 'custas_finais' | 'honorarios_advocaticios' | 'honorarios_sucumbencia' | 'honorarios_pericia' | 'diligencia' | 'taxa_judiciaria' | 'deposito_recursal' | 'multa' | 'outros';
export type StatusCusta = 'pendente' | 'pago' | 'vencido' | 'cancelado';

export type StatusConsultaJuridica = 'pendente' | 'em_analise' | 'respondida' | 'arquivada';

// Interfaces
export interface Advogado {
  id: string;
  tipo: TipoAdvogado;
  nome: string;
  cpf_cnpj?: string;
  oab?: string;
  oab_estado?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  especialidades?: string[];
  banco?: string;
  agencia?: string;
  conta?: string;
  pix_chave?: string;
  pix_tipo?: string;
  tipo_contrato?: TipoContratoAdvogado;
  valor_fixo?: number;
  percentual_exito?: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Processo {
  id: string;
  numero: string;
  numero_processo?: string;
  tipo: TipoProcesso;
  natureza: NaturezaProcesso;
  rito?: RitoProcesso;
  parte_contraria_nome: string;
  parte_contraria_cpf_cnpj?: string;
  parte_contraria_advogado?: string;
  parte_contraria_oab?: string;
  associado_id?: string;
  sinistro_id?: string;
  advogado_id?: string;
  tribunal?: string;
  comarca?: string;
  vara?: string;
  valor_causa?: number;
  valor_condenacao?: number;
  valor_acordo?: number;
  data_distribuicao?: string;
  data_citacao?: string;
  data_audiencia?: string;
  data_sentenca?: string;
  data_transito_julgado?: string;
  data_encerramento?: string;
  status: StatusProcesso;
  fase: FaseProcesso;
  objeto: string;
  observacoes?: string;
  responsavel_id?: string;
  criado_por?: string;
  created_at: string;
  updated_at: string;
  // Joins
  advogado?: Advogado;
  associado?: { id: string; nome: string; cpf: string };
  sinistro?: { id: string; protocolo: string };
  responsavel?: { id: string; nome: string };
}

export interface ProcessoAndamento {
  id: string;
  processo_id: string;
  data: string;
  descricao: string;
  tipo?: TipoAndamento;
  gera_prazo: boolean;
  prazo_dias?: number;
  prazo_data?: string;
  prazo_descricao?: string;
  prazo_cumprido: boolean;
  prazo_cumprido_em?: string;
  registrado_por?: string;
  created_at: string;
  // Joins
  usuario?: { id: string; nome: string };
}

export interface ProcessoPrazo {
  id: string;
  processo_id: string;
  andamento_id?: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  dias_uteis: boolean;
  prioridade: PrioridadePrazo;
  status: StatusPrazo;
  cumprido_em?: string;
  cumprido_por?: string;
  observacao_cumprimento?: string;
  responsavel_id?: string;
  created_at: string;
  updated_at: string;
  // Joins
  processo?: Processo;
  responsavel?: { id: string; nome: string };
}

export interface ProcessoDocumento {
  id: string;
  processo_id: string;
  andamento_id?: string;
  tipo: TipoDocumentoProcesso;
  nome: string;
  descricao?: string;
  arquivo_url?: string;
  arquivo_tamanho?: number;
  enviado_por?: string;
  created_at: string;
}

export interface ProcessoAudiencia {
  id: string;
  processo_id: string;
  tipo: TipoAudiencia;
  data_hora: string;
  local?: string;
  link_videoconferencia?: string;
  pauta?: string;
  status: StatusAudiencia;
  resultado?: string;
  advogado_presente?: boolean;
  parte_presente?: boolean;
  testemunhas?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  // Joins
  processo?: Processo;
}

export interface ProcessoCusta {
  id: string;
  processo_id: string;
  tipo: TipoCusta;
  descricao: string;
  valor: number;
  data_vencimento?: string;
  data_pagamento?: string;
  status: StatusCusta;
  comprovante_url?: string;
  pago_por?: string;
  created_at: string;
}

export interface ConsultaJuridica {
  id: string;
  numero: string;
  solicitante_id?: string;
  departamento?: string;
  assunto: string;
  descricao: string;
  associado_id?: string;
  sinistro_id?: string;
  processo_id?: string;
  parecer?: string;
  respondido_por?: string;
  respondido_em?: string;
  status: StatusConsultaJuridica;
  prioridade: PrioridadePrazo;
  created_at: string;
  updated_at: string;
  // Joins
  solicitante?: { id: string; nome: string };
  respondido_usuario?: { id: string; nome: string };
}

// Labels
export const TIPO_ADVOGADO_LABELS: Record<TipoAdvogado, string> = {
  interno: 'Interno',
  externo: 'Externo',
  escritorio: 'Escritório',
};

export const TIPO_PROCESSO_LABELS: Record<TipoProcesso, string> = {
  civel: 'Cível',
  trabalhista: 'Trabalhista',
  criminal: 'Criminal',
  consumidor: 'Consumidor',
  transito: 'Trânsito',
  administrativo: 'Administrativo',
  tributario: 'Tributário',
  outros: 'Outros',
};

export const NATUREZA_PROCESSO_LABELS: Record<NaturezaProcesso, string> = {
  autor: 'Autor',
  reu: 'Réu',
  terceiro_interessado: 'Terceiro Interessado',
  assistente: 'Assistente',
};

export const RITO_PROCESSO_LABELS: Record<RitoProcesso, string> = {
  ordinario: 'Ordinário',
  sumario: 'Sumário',
  sumarissimo: 'Sumaríssimo',
  especial: 'Especial',
  juizado: 'Juizado Especial',
};

export const STATUS_PROCESSO_LABELS: Record<StatusProcesso, string> = {
  ativo: 'Ativo',
  suspenso: 'Suspenso',
  arquivado: 'Arquivado',
  encerrado_procedente: 'Procedente',
  encerrado_improcedente: 'Improcedente',
  acordo: 'Acordo',
  desistencia: 'Desistência',
  extinto: 'Extinto',
};

export const FASE_PROCESSO_LABELS: Record<FaseProcesso, string> = {
  inicial: 'Inicial',
  citacao: 'Citação',
  contestacao: 'Contestação',
  instrucao: 'Instrução',
  alegacoes_finais: 'Alegações Finais',
  sentenca: 'Sentença',
  recurso: 'Recurso',
  execucao: 'Execução',
  cumprimento_sentenca: 'Cumprimento de Sentença',
  encerrado: 'Encerrado',
};

export const TIPO_ANDAMENTO_LABELS: Record<TipoAndamento, string> = {
  despacho: 'Despacho',
  decisao: 'Decisão',
  sentenca: 'Sentença',
  acordao: 'Acórdão',
  peticao: 'Petição',
  audiencia: 'Audiência',
  pericia: 'Perícia',
  citacao: 'Citação',
  intimacao: 'Intimação',
  publicacao: 'Publicação',
  outros: 'Outros',
};

export const PRIORIDADE_LABELS: Record<PrioridadePrazo, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const STATUS_PRAZO_LABELS: Record<StatusPrazo, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  cumprido: 'Cumprido',
  perdido: 'Perdido',
  cancelado: 'Cancelado',
};

export const TIPO_AUDIENCIA_LABELS: Record<TipoAudiencia, string> = {
  conciliacao: 'Conciliação',
  instrucao: 'Instrução',
  julgamento: 'Julgamento',
  una: 'Una',
  especial: 'Especial',
};

export const STATUS_AUDIENCIA_LABELS: Record<StatusAudiencia, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  adiada: 'Adiada',
  cancelada: 'Cancelada',
  redesignada: 'Redesignada',
};

export const TIPO_CUSTA_LABELS: Record<TipoCusta, string> = {
  custas_iniciais: 'Custas Iniciais',
  custas_finais: 'Custas Finais',
  honorarios_advocaticios: 'Honorários Advocatícios',
  honorarios_sucumbencia: 'Honorários Sucumbenciais',
  honorarios_pericia: 'Honorários Periciais',
  diligencia: 'Diligência',
  taxa_judiciaria: 'Taxa Judiciária',
  deposito_recursal: 'Depósito Recursal',
  multa: 'Multa',
  outros: 'Outros',
};

export const STATUS_CUSTA_LABELS: Record<StatusCusta, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

export const STATUS_CONSULTA_LABELS: Record<StatusConsultaJuridica, string> = {
  pendente: 'Pendente',
  em_analise: 'Em Análise',
  respondida: 'Respondida',
  arquivada: 'Arquivada',
};

export const TIPO_DOCUMENTO_PROCESSO_LABELS: Record<TipoDocumentoProcesso, string> = {
  peticao_inicial: 'Petição Inicial',
  contestacao: 'Contestação',
  replica: 'Réplica',
  recurso: 'Recurso',
  contrarrazoes: 'Contrarrazões',
  sentenca: 'Sentença',
  acordao: 'Acórdão',
  procuracao: 'Procuração',
  substabelecimento: 'Substabelecimento',
  laudo: 'Laudo',
  ata_audiencia: 'Ata de Audiência',
  comprovante: 'Comprovante',
  notificacao: 'Notificação',
  outros: 'Outros',
};

// Colors
export const STATUS_PROCESSO_COLORS: Record<StatusProcesso, string> = {
  ativo: 'bg-blue-100 text-blue-800',
  suspenso: 'bg-yellow-100 text-yellow-800',
  arquivado: 'bg-gray-100 text-gray-800',
  encerrado_procedente: 'bg-green-100 text-green-800',
  encerrado_improcedente: 'bg-red-100 text-red-800',
  acordo: 'bg-purple-100 text-purple-800',
  desistencia: 'bg-orange-100 text-orange-800',
  extinto: 'bg-gray-100 text-gray-800',
};

export const PRIORIDADE_COLORS: Record<PrioridadePrazo, string> = {
  baixa: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  alta: 'bg-orange-100 text-orange-800',
  urgente: 'bg-red-100 text-red-800',
};

export const STATUS_PRAZO_COLORS: Record<StatusPrazo, string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  em_andamento: 'bg-blue-100 text-blue-800',
  cumprido: 'bg-green-100 text-green-800',
  perdido: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

export const STATUS_AUDIENCIA_COLORS: Record<StatusAudiencia, string> = {
  agendada: 'bg-blue-100 text-blue-800',
  realizada: 'bg-green-100 text-green-800',
  adiada: 'bg-yellow-100 text-yellow-800',
  cancelada: 'bg-red-100 text-red-800',
  redesignada: 'bg-purple-100 text-purple-800',
};

export const STATUS_CUSTA_COLORS: Record<StatusCusta, string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  pago: 'bg-green-100 text-green-800',
  vencido: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

export const STATUS_CONSULTA_COLORS: Record<StatusConsultaJuridica, string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  em_analise: 'bg-blue-100 text-blue-800',
  respondida: 'bg-green-100 text-green-800',
  arquivada: 'bg-gray-100 text-gray-800',
};

// Especialidades disponíveis
export const ESPECIALIDADES_ADVOGADO = [
  'civel',
  'trabalhista',
  'criminal',
  'consumidor',
  'transito',
  'administrativo',
  'tributario',
  'empresarial',
  'familia',
  'previdenciario',
] as const;

export const ESPECIALIDADE_LABELS: Record<string, string> = {
  civel: 'Cível',
  trabalhista: 'Trabalhista',
  criminal: 'Criminal',
  consumidor: 'Consumidor',
  transito: 'Trânsito',
  administrativo: 'Administrativo',
  tributario: 'Tributário',
  empresarial: 'Empresarial',
  familia: 'Família',
  previdenciario: 'Previdenciário',
};
