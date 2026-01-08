// Tipos do módulo Ouvidoria

export type TipoManifestacao = 'reclamacao' | 'sugestao' | 'elogio' | 'denuncia' | 'duvida';

export type CategoriaManifestacao = 
  | 'atendimento' 
  | 'financeiro' 
  | 'sinistro' 
  | 'assistencia'
  | 'rastreamento' 
  | 'contrato' 
  | 'instalacao' 
  | 'app' 
  | 'outro';

export type CanalManifestacao = 'app' | 'whatsapp' | 'telefone' | 'email' | 'presencial';

export type PrioridadeManifestacao = 'baixa' | 'normal' | 'alta' | 'urgente';

export type StatusManifestacao = 
  | 'aberto' 
  | 'em_analise' 
  | 'aguardando_resposta' 
  | 'respondido' 
  | 'encerrado' 
  | 'reaberto';

export type TipoInteracao = 
  | 'mensagem_associado' 
  | 'resposta_interna' 
  | 'nota_interna' 
  | 'encaminhamento' 
  | 'anexo' 
  | 'status_change' 
  | 'resposta_ia';

export type TipoAcaoIA = 
  | 'resposta_inicial' 
  | 'follow_up' 
  | 'triagem' 
  | 'analise_sentimento' 
  | 'escalacao' 
  | 'notificacao';

export type SentimentoIA = 
  | 'muito_negativo' 
  | 'negativo' 
  | 'neutro' 
  | 'positivo' 
  | 'muito_positivo';

export interface Manifestacao {
  id: string;
  associado_id: string | null;
  protocolo: string;
  tipo: TipoManifestacao;
  categoria: CategoriaManifestacao | null;
  assunto: string;
  descricao: string;
  anonimo: boolean;
  canal: CanalManifestacao;
  prioridade: PrioridadeManifestacao;
  status: StatusManifestacao;
  responsavel_id: string | null;
  departamento: string | null;
  data_limite: string | null;
  data_primeira_resposta: string | null;
  data_encerramento: string | null;
  avaliacao_nota: number | null;
  avaliacao_comentario: string | null;
  vinculo_juridico_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManifestacaoWithRelations extends Manifestacao {
  associado?: {
    id: string;
    nome: string;
    telefone: string;
    email: string;
    cpf: string;
  } | null;
  responsavel?: {
    id: string;
    nome: string;
    email: string;
  } | null;
}

export interface Interacao {
  id: string;
  manifestacao_id: string;
  usuario_id: string | null;
  tipo: TipoInteracao;
  mensagem: string;
  visivel_associado: boolean;
  anexo_url: string | null;
  created_at: string;
  usuario?: {
    id: string;
    nome: string;
  } | null;
}

export interface Anexo {
  id: string;
  manifestacao_id: string;
  nome_arquivo: string;
  url: string;
  tipo_arquivo: string | null;
  tamanho_bytes: number | null;
  created_at: string;
}

export interface IALog {
  id: string;
  manifestacao_id: string;
  tipo_acao: TipoAcaoIA;
  entrada: string | null;
  saida: string | null;
  sentimento: SentimentoIA | null;
  palavras_chave_detectadas: string[] | null;
  prioridade_sugerida: string | null;
  departamento_sugerido: string | null;
  confianca: number | null;
  tokens_entrada: number | null;
  tokens_saida: number | null;
  tempo_resposta_ms: number | null;
  created_at: string;
}

export interface OuvidoriaConfig {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
  updated_at: string;
}

export interface ManifestacaoFilters {
  tipo?: TipoManifestacao;
  status?: StatusManifestacao;
  prioridade?: PrioridadeManifestacao;
  responsavel_id?: string;
  categoria?: CategoriaManifestacao;
  data_inicio?: string;
  data_fim?: string;
  search?: string;
}

export interface EstatisticasOuvidoria {
  total: number;
  abertas: number;
  em_analise: number;
  respondidas: number;
  encerradas: number;
  sla_em_risco: number;
  tempo_medio_resposta_horas: number;
  nps: number;
  por_tipo: Record<TipoManifestacao, number>;
  por_prioridade: Record<PrioridadeManifestacao, number>;
}

// Labels para exibição
export const TIPO_MANIFESTACAO_LABELS: Record<TipoManifestacao, string> = {
  reclamacao: 'Reclamação',
  sugestao: 'Sugestão',
  elogio: 'Elogio',
  denuncia: 'Denúncia',
  duvida: 'Dúvida',
};

export const CATEGORIA_LABELS: Record<CategoriaManifestacao, string> = {
  atendimento: 'Atendimento',
  financeiro: 'Financeiro',
  sinistro: 'Sinistro',
  assistencia: 'Assistência',
  rastreamento: 'Rastreamento',
  contrato: 'Contrato',
  instalacao: 'Instalação',
  app: 'Aplicativo',
  outro: 'Outro',
};

export const CANAL_LABELS: Record<CanalManifestacao, string> = {
  app: 'Aplicativo',
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  email: 'E-mail',
  presencial: 'Presencial',
};

export const PRIORIDADE_LABELS: Record<PrioridadeManifestacao, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const STATUS_LABELS: Record<StatusManifestacao, string> = {
  aberto: 'Aberto',
  em_analise: 'Em Análise',
  aguardando_resposta: 'Aguardando Resposta',
  respondido: 'Respondido',
  encerrado: 'Encerrado',
  reaberto: 'Reaberto',
};

export const TIPO_INTERACAO_LABELS: Record<TipoInteracao, string> = {
  mensagem_associado: 'Mensagem do Associado',
  resposta_interna: 'Resposta',
  nota_interna: 'Nota Interna',
  encaminhamento: 'Encaminhamento',
  anexo: 'Anexo',
  status_change: 'Mudança de Status',
  resposta_ia: 'Resposta Automática (IA)',
};
