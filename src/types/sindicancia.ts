/**
 * @file Tipos do módulo de Sindicância
 * @module sindicancia
 * @description Interfaces e constantes para o fluxo de sindicância (investigação de sinistros)
 */

// ============================================================
// EMPRESA DE SINDICÂNCIA
// ============================================================

export interface EmpresaSindicancia {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  responsavel_nome: string;
  responsavel_cpf: string | null;
  responsavel_telefone: string | null;
  responsavel_email: string | null;
  especialidades: string[];
  regioes_atuacao: string[];
  valor_por_sindicancia: number | null;
  observacoes: string | null;
  ativo: boolean;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export const ESPECIALIDADES_LABELS: Record<string, string> = {
  fraude_veicular: 'Fraude Veicular',
  roubo_furto: 'Roubo/Furto',
  incendio: 'Incêndio',
  colisao_suspeita: 'Colisão Suspeita',
  geral: 'Geral',
};

export const REGIOES_LABELS: Record<string, string> = {
  rj_capital: 'RJ Capital',
  rj_baixada: 'RJ Baixada',
  rj_interior: 'RJ Interior',
  sp_capital: 'SP Capital',
  sp_interior: 'SP Interior',
  mg: 'MG',
  outros: 'Outros',
};

// ============================================================
// SINDICÂNCIA (CASO DE INVESTIGAÇÃO)
// ============================================================

export type StatusSindicancia =
  | 'aguardando_atribuicao'
  | 'atribuido'
  | 'em_andamento'
  | 'laudo_emitido'
  | 'encerrado'
  | 'cancelado';

export const STATUS_SINDICANCIA_LABELS: Record<StatusSindicancia, string> = {
  aguardando_atribuicao: 'Aguardando Atribuição',
  atribuido: 'Atribuído',
  em_andamento: 'Em Andamento',
  laudo_emitido: 'Laudo Emitido',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
};

export const STATUS_SINDICANCIA_COLORS: Record<StatusSindicancia, string> = {
  aguardando_atribuicao: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  atribuido: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  em_andamento: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  laudo_emitido: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  encerrado: 'bg-muted text-muted-foreground',
  cancelado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export type ConclusaoLaudo =
  | 'regular'
  | 'irregular_comprovada'
  | 'irregular_suspeita'
  | 'inconclusivo';

export const CONCLUSAO_LAUDO_LABELS: Record<ConclusaoLaudo, string> = {
  regular: 'Regular',
  irregular_comprovada: 'Irregular — Fraude Comprovada',
  irregular_suspeita: 'Irregular — Fraude Suspeita',
  inconclusivo: 'Inconclusivo',
};

export type RecomendacaoLaudo =
  | 'aprovar'
  | 'negar'
  | 'encaminhar_juridico'
  | 'encaminhar_diretoria'
  | 'solicitar_pericia';

export const RECOMENDACAO_LABELS: Record<RecomendacaoLaudo, string> = {
  aprovar: 'Aprovar',
  negar: 'Negar',
  encaminhar_juridico: 'Encaminhar Jurídico',
  encaminhar_diretoria: 'Encaminhar Diretoria',
  solicitar_pericia: 'Solicitar Perícia',
};

export const MOTIVOS_PADRONIZADOS = [
  { value: 'inconsistencia_relato', label: 'Inconsistência no relato' },
  { value: 'distancia_gps', label: 'Distância GPS suspeita' },
  { value: 'historico_sinistros', label: 'Histórico de sinistros' },
  { value: 'documentos_suspeitos', label: 'Documentos suspeitos' },
  { value: 'valor_elevado', label: 'Valor elevado' },
  { value: 'testemunhas_divergentes', label: 'Testemunhas divergentes' },
  { value: 'fraude_conhecida', label: 'Padrão de fraude conhecido' },
  { value: 'outro', label: 'Outro' },
];

export interface Sindicancia {
  id: string;
  numero: string;
  sinistro_id: string;
  empresa_sindicancia_id: string | null;
  sindicante_profile_id: string | null;
  motivo: string;
  motivos_padronizados: string[];
  descricao: string | null;
  status: StatusSindicancia;
  data_abertura: string;
  data_atribuicao: string | null;
  data_limite: string;
  data_laudo: string | null;
  data_encerramento: string | null;
  laudo_conclusao: ConclusaoLaudo | null;
  laudo_resumo: string | null;
  laudo_irregularidades: string | null;
  laudo_recomendacao: RecomendacaoLaudo | null;
  laudo_arquivo_url: string | null;
  decisao_analista: string | null;
  decisao_observacao: string | null;
  decisao_por: string | null;
  decisao_em: string | null;
  aberto_por: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// DILIGÊNCIAS
// ============================================================

export type TipoDiligencia =
  | 'visita_local'
  | 'entrevista_associado'
  | 'entrevista_testemunha'
  | 'analise_cameras'
  | 'consulta_bases'
  | 'pesquisa_redes'
  | 'vistoria_complementar'
  | 'analise_documental'
  | 'pesquisa_judicial'
  | 'outro';

export const TIPO_DILIGENCIA_LABELS: Record<TipoDiligencia, string> = {
  visita_local: 'Visita ao Local',
  entrevista_associado: 'Entrevista com Associado',
  entrevista_testemunha: 'Entrevista com Testemunha',
  analise_cameras: 'Análise de Câmeras',
  consulta_bases: 'Consulta a Bases',
  pesquisa_redes: 'Pesquisa em Redes Sociais',
  vistoria_complementar: 'Vistoria Complementar',
  analise_documental: 'Análise Documental',
  pesquisa_judicial: 'Pesquisa Judicial',
  outro: 'Outro',
};

export interface SindicanciaDiligencia {
  id: string;
  sindicancia_id: string;
  tipo: TipoDiligencia;
  data_diligencia: string;
  descricao: string;
  resultado: string | null;
  local: string | null;
  registrado_por: string;
  created_at: string;
}

// ============================================================
// SOLICITAÇÕES DE INFORMAÇÃO
// ============================================================

export type TipoSolicitacao = 'informacao' | 'documento' | 'acesso';

export const TIPO_SOLICITACAO_LABELS: Record<TipoSolicitacao, string> = {
  informacao: 'Informação',
  documento: 'Documento',
  acesso: 'Acesso',
};

export type StatusSolicitacao = 'pendente' | 'respondida' | 'cancelada';

export const STATUS_SOLICITACAO_LABELS: Record<StatusSolicitacao, string> = {
  pendente: 'Pendente',
  respondida: 'Respondida',
  cancelada: 'Cancelada',
};

export interface SindicanciaSolicitacao {
  id: string;
  sindicancia_id: string;
  tipo: TipoSolicitacao;
  descricao: string;
  status: StatusSolicitacao;
  resposta: string | null;
  resposta_anexo_url: string | null;
  solicitado_por: string | null;
  respondido_por: string | null;
  solicitado_em: string;
  respondido_em: string | null;
}
