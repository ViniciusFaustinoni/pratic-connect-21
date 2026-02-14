// ============================================
// ENUMS E TIPOS BASE - SGA PRATIC 2.0
// ============================================

export type TipoSinistro = 
  | 'colisao' 
  | 'roubo' 
  | 'furto' 
  | 'incendio' 
  | 'fenomeno_natural' 
  | 'terceiros' 
  | 'vidros' 
  | 'vandalismo'
  | 'outro';

export type StatusSinistro = 
  // FASE 1: ENTRADA
  | 'comunicado'
  // FASE 2: ABERTURA/DOCUMENTAÇÃO
  | 'em_analise'
  | 'documentacao_pendente'
  // FASE 3: VISTORIA
  | 'aguardando_vistoria'
  | 'em_vistoria'
  | 'aguardando_parecer'
  // FASE 4: ANÁLISES ESPECIAIS
  | 'em_sindicancia'
  | 'em_pericia'
  | 'analise_interna'
  | 'suspenso'
  | 'aguardando_diretoria'
  | 'aguardando_juridico'
  // FASE 5: DECISÃO
  | 'aprovado'
  | 'negado'
  | 'reprovado'
  // FASE 6: EXECUÇÃO (REPAROS)
  | 'em_regulacao'
  | 'aguardando_termo'
  | 'aguardando_cota'
  | 'em_reparo'
  | 'em_garantia'
  | 'aguardando_confirmacoes'
  | 'pronto_para_oficina'
  | 'em_oficina'
  | 'aguardando_peca'
  | 'em_finalizacao'
  // FASE 6B: RECUPERAÇÃO (ROUBO/FURTO)
  | 'em_recuperacao'
  // FASE 7: PAGAMENTO
  | 'aguardando_pagamento'
  | 'pagamento_confirmado'
  | 'pago'
  | 'indenizado'
  | 'aguardando_indenizacao'
  // FINAIS
  | 'concluido'
  | 'entregue'
  | 'finalizado'
  | 'encerrado'
  | 'cancelado'
  | 'aguardando_analise';

export type CanalAbertura = 'app' | 'whatsapp' | 'telefone' | 'presencial';

export type TipoLocalEvento = 'rodovia_federal' | 'rodovia_estadual' | 'urbana' | 'sp_outros';

export type TipoDano = 'parcial' | 'perda_total';

export type ResultadoSindicancia = 'regular' | 'irregular' | 'carta_cancelamento' | 'juridico' | 'inconclusivo';

export const RESULTADO_SINDICANCIA_LABELS: Record<ResultadoSindicancia, string> = {
  regular: 'Regular (Sem Fraude)',
  irregular: 'Irregular (Fraude Comprovada)',
  carta_cancelamento: 'Carta de Cancelamento',
  juridico: 'Encaminhar ao Jurídico',
  inconclusivo: 'Inconclusivo (Diretoria)',
};

export const MOTIVOS_SINDICANCIA: Record<string, string[]> = {
  colisao: [
    'Relato inconsistente com os danos',
    'Fotos não conferem com B.O.',
    'Histórico de múltiplos sinistros',
    'Tempo suspeito entre evento e comunicado',
    'Condutor embriagado',
    'CNH vencida',
  ],
  roubo: [
    'Dados do rastreador suspeitos',
    'Locais suspeitos nos dias anteriores',
    'Mudança de rotina do veículo',
    'Rastreador obrigatório não instalado',
  ],
  furto: [
    'Dados do rastreador suspeitos',
    'Locais suspeitos nos dias anteriores',
    'Mudança de rotina do veículo',
    'Rastreador obrigatório não instalado',
  ],
  incendio: [
    'Suspeita de incêndio provocado',
    'GNV irregular',
    'Sobrecarga elétrica por modificações',
  ],
  fenomeno_natural: [
    'Entrada deliberada em área alagada',
    'Água salgada detectada',
    'Local notoriamente inadequado',
  ],
};

export type CondutorRelacao = 'associado' | 'terceiro_autorizado' | 'terceiro';

export type VeiculoRecuperadoEstado = 'sem_dano' | 'dano_parcial' | 'dano_total';

export type MotivoNegacao = 
  | 'fora_cobertura' 
  | 'documentacao_invalida' 
  | 'fraude_suspeita' 
  | 'prazo_expirado' 
  | 'carencia'
  | 'inadimplencia'
  | 'outro';

// ============================================
// LABELS E CORES
// ============================================

export const TIPO_SINISTRO_LABELS: Record<TipoSinistro, string> = {
  colisao: 'Colisão',
  roubo: 'Roubo',
  furto: 'Furto',
  incendio: 'Incêndio',
  fenomeno_natural: 'Fenômeno Natural',
  terceiros: 'Terceiros',
  vidros: 'Vidros',
  vandalismo: 'Vandalismo',
  outro: 'Outro',
};

export const TIPO_SINISTRO_ICONS: Record<TipoSinistro, string> = {
  colisao: 'Car',
  roubo: 'ShieldAlert',
  furto: 'ShieldOff',
  incendio: 'Flame',
  fenomeno_natural: 'CloudRain',
  terceiros: 'Users',
  vidros: 'Square',
  vandalismo: 'Hammer',
  outro: 'HelpCircle',
};

export const STATUS_SINISTRO_LABELS: Record<StatusSinistro, string> = {
  comunicado: 'Comunicado',
  em_analise: 'Em Análise',
  documentacao_pendente: 'Doc. Pendente',
  aguardando_vistoria: 'Aguard. Vistoria',
  em_vistoria: 'Em Vistoria',
  aguardando_parecer: 'Aguard. Parecer',
  em_sindicancia: 'Em Sindicância',
  em_pericia: 'Em Perícia',
  analise_interna: 'Análise Interna',
  suspenso: 'Suspenso',
  aguardando_diretoria: 'Aguard. Diretoria',
  aguardando_juridico: 'Aguard. Jurídico',
  aprovado: 'Aprovado',
  negado: 'Negado',
  reprovado: 'Reprovado',
  em_regulacao: 'Em Regulação',
  aguardando_termo: 'Aguard. Termo',
  aguardando_cota: 'Aguard. Cota',
  em_reparo: 'Em Reparo',
  em_garantia: 'Em Garantia',
  aguardando_confirmacoes: 'Aguard. Confirmações',
  pronto_para_oficina: 'Pronto p/ Oficina',
  em_oficina: 'Em Oficina',
  aguardando_peca: 'Aguard. Peça',
  em_finalizacao: 'Em Finalização',
  em_recuperacao: 'Em Recuperação',
  aguardando_pagamento: 'Aguard. Pagamento',
  pagamento_confirmado: 'Pgto Confirmado',
  pago: 'Pago',
  indenizado: 'Indenizado',
  aguardando_indenizacao: 'Aguard. Indenização',
  concluido: 'Concluído',
  entregue: 'Entregue',
  finalizado: 'Finalizado',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
  aguardando_analise: 'Aguard. Análise',
};

export const STATUS_SINISTRO_COLORS: Record<StatusSinistro, string> = {
  comunicado: 'bg-yellow-100 text-yellow-800',
  em_analise: 'bg-blue-100 text-blue-800',
  documentacao_pendente: 'bg-orange-100 text-orange-800',
  aguardando_vistoria: 'bg-purple-100 text-purple-800',
  em_vistoria: 'bg-indigo-100 text-indigo-800',
  aguardando_parecer: 'bg-cyan-100 text-cyan-800',
  em_sindicancia: 'bg-rose-100 text-rose-800',
  em_pericia: 'bg-pink-100 text-pink-800',
  analise_interna: 'bg-amber-100 text-amber-800',
  suspenso: 'bg-slate-200 text-slate-700',
  aguardando_diretoria: 'bg-amber-100 text-amber-800',
  aguardando_juridico: 'bg-purple-100 text-purple-800',
  aprovado: 'bg-green-100 text-green-800',
  negado: 'bg-red-100 text-red-800',
  reprovado: 'bg-red-100 text-red-800',
  em_regulacao: 'bg-teal-100 text-teal-800',
  aguardando_termo: 'bg-sky-100 text-sky-800',
  aguardando_cota: 'bg-lime-100 text-lime-800',
  em_reparo: 'bg-violet-100 text-violet-800',
  em_garantia: 'bg-emerald-100 text-emerald-800',
  aguardando_confirmacoes: 'bg-sky-100 text-sky-800',
  pronto_para_oficina: 'bg-lime-100 text-lime-800',
  em_oficina: 'bg-violet-100 text-violet-800',
  aguardando_peca: 'bg-orange-100 text-orange-800',
  em_finalizacao: 'bg-teal-100 text-teal-800',
  em_recuperacao: 'bg-fuchsia-100 text-fuchsia-800',
  aguardando_pagamento: 'bg-cyan-100 text-cyan-800',
  pagamento_confirmado: 'bg-green-100 text-green-800',
  pago: 'bg-emerald-100 text-emerald-800',
  indenizado: 'bg-green-100 text-green-800',
  aguardando_indenizacao: 'bg-pink-100 text-pink-800',
  concluido: 'bg-green-100 text-green-800',
  entregue: 'bg-emerald-100 text-emerald-800',
  finalizado: 'bg-gray-200 text-gray-800',
  encerrado: 'bg-gray-100 text-gray-800',
  cancelado: 'bg-gray-100 text-gray-500',
  aguardando_analise: 'bg-blue-100 text-blue-800',
};

export const CANAL_LABELS: Record<CanalAbertura, string> = {
  app: 'App',
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  presencial: 'Presencial',
};

export const TIPO_LOCAL_LABELS: Record<TipoLocalEvento, string> = {
  rodovia_federal: 'Rodovia Federal',
  rodovia_estadual: 'Rodovia Estadual RJ',
  urbana: 'Via Urbana RJ',
  sp_outros: 'SP e Demais Estados',
};

export const MOTIVO_NEGACAO_LABELS: Record<MotivoNegacao, string> = {
  fora_cobertura: 'Fora de Cobertura',
  documentacao_invalida: 'Documentação Inválida',
  fraude_suspeita: 'Suspeita de Fraude',
  prazo_expirado: 'Prazo Expirado',
  carencia: 'Período de Carência',
  inadimplencia: 'Inadimplência',
  outro: 'Outro Motivo',
};

// ============================================
// DOCUMENTOS POR LOCAL DO EVENTO
// ============================================

export const DOCUMENTOS_POR_LOCAL: Record<TipoLocalEvento, { sem_vitima: string[]; com_vitima: string[] }> = {
  rodovia_federal: {
    sem_vitima: ['CST (site PRF)'],
    com_vitima: ['LPST', 'RAPH', 'BAM', 'Certidão CBMERJ'],
  },
  rodovia_estadual: {
    sem_vitima: ['eBRAT (PMERJ)'],
    com_vitima: ['BRAT/BOPM', 'RAPH', 'BAM', 'Certidão CBMERJ'],
  },
  urbana: {
    sem_vitima: ['eBRAT'],
    com_vitima: ['BRAT', 'Documentos médicos'],
  },
  sp_outros: {
    sem_vitima: ['B.O.'],
    com_vitima: ['B.O.', 'Documentos médicos'],
  },
};

// ============================================
// WORKFLOW COMPLETO SGA PRATIC 2.0
// ============================================

export const WORKFLOW_SINISTRO: Record<StatusSinistro, StatusSinistro[]> = {
  comunicado: ['em_analise', 'cancelado'],
  em_analise: ['documentacao_pendente', 'aguardando_vistoria', 'em_sindicancia', 'analise_interna', 'aprovado', 'negado', 'cancelado'],
  documentacao_pendente: ['em_analise', 'cancelado'],
  aguardando_vistoria: ['em_vistoria', 'cancelado'],
  em_vistoria: ['aguardando_parecer', 'em_sindicancia', 'cancelado'],
  aguardando_parecer: ['aprovado', 'negado', 'em_sindicancia'],
  em_sindicancia: ['em_pericia', 'em_analise', 'aprovado', 'negado', 'suspenso', 'aguardando_diretoria', 'cancelado'],
  em_pericia: ['em_sindicancia', 'aprovado', 'negado', 'aguardando_diretoria'],
  analise_interna: ['em_analise', 'aprovado', 'negado'],
  suspenso: ['em_analise', 'em_sindicancia', 'cancelado'],
  aguardando_diretoria: ['em_analise', 'negado', 'em_sindicancia', 'aguardando_juridico'],
  aguardando_juridico: ['em_analise', 'negado', 'aprovado'],
  aprovado: ['em_regulacao', 'em_recuperacao', 'aguardando_pagamento'],
  negado: ['encerrado'],
  reprovado: ['encerrado'],
  em_regulacao: ['aguardando_termo', 'aguardando_cota', 'em_reparo', 'aguardando_pagamento'],
  aguardando_termo: ['aguardando_cota', 'cancelado'],
  aguardando_cota: ['em_reparo', 'cancelado'],
  em_reparo: ['em_garantia', 'pago', 'encerrado'],
  em_garantia: ['encerrado'],
  aguardando_confirmacoes: ['em_analise', 'aprovado'],
  pronto_para_oficina: ['em_oficina'],
  em_oficina: ['aguardando_peca', 'em_finalizacao', 'encerrado'],
  aguardando_peca: ['em_oficina'],
  em_finalizacao: ['concluido', 'entregue'],
  em_recuperacao: ['em_regulacao', 'aguardando_pagamento', 'encerrado'],
  aguardando_pagamento: ['pago', 'indenizado', 'pagamento_confirmado'],
  pagamento_confirmado: ['encerrado'],
  pago: ['encerrado'],
  indenizado: ['encerrado'],
  aguardando_indenizacao: ['indenizado', 'encerrado'],
  concluido: ['entregue', 'encerrado'],
  entregue: ['finalizado', 'encerrado'],
  finalizado: ['encerrado'],
  encerrado: [],
  cancelado: [],
  aguardando_analise: ['em_analise'],
};

// ============================================
// PRAZOS PADRÃO (em dias)
// ============================================

export const PRAZOS_SINISTRO = {
  comunicado_padrao: 30,
  comunicado_roubo_furto: 3,
  documentos_pendentes: 30,
  cota_pendente: 30,
  termo_pendente: 30,
  sindicancia: 30,
  reparo_oficina: 90, // dias úteis
  garantia: 90,
  indenizacao: 60, // dias úteis após docs completos
  carencia_vidros: 120,
};

// ============================================
// VALORES PADRÃO
// ============================================

export const VALORES_SINISTRO = {
  cota_participacao_padrao: 750.00,
  percentual_perda_total: 75, // >= 75% FIPE = Perda Total
};

// ============================================
// INTERFACES PRINCIPAIS
// ============================================

export interface Sinistro {
  id: string;
  associado_id: string;
  veiculo_id: string;
  contrato_id?: string;
  protocolo: string;
  tipo: TipoSinistro;
  status: StatusSinistro;
  data_ocorrencia: string;
  hora_ocorrencia?: string;
  local_ocorrencia: string;
  cidade_ocorrencia: string;
  estado_ocorrencia: string;
  descricao: string;
  
  // Condutor
  condutor_nome?: string;
  condutor_cnh?: string;
  condutor_relacao?: CondutorRelacao;
  condutor_embriaguez?: boolean;
  condutor_cnh_vencida?: boolean;
  
  // Local e documentação
  tipo_local_evento?: TipoLocalEvento;
  houve_vitima?: boolean;
  
  // B.O.
  bo_numero?: string;
  bo_arquivo_url?: string;
  
  // Valores
  valor_fipe_momento?: number;
  valor_orcamento?: number;
  valor_aprovado?: number;
  valor_participacao?: number;
  valor_pago?: number;
  valor_indenizacao?: number;
  
  // Cota
  valor_cota_participacao?: number;
  cota_paga?: boolean;
  cota_paga_em?: string;
  cobranca_cota_id?: string;
  
  // Termo
  termo_anuencia_assinado?: boolean;
  termo_anuencia_url?: string;
  termo_anuencia_assinado_em?: string;
  
  // Classificação
  tipo_dano?: TipoDano;
  percentual_fipe?: number;
  
  // Recuperação (Roubo/Furto)
  veiculo_recuperado?: boolean;
  veiculo_recuperado_em?: string;
  veiculo_recuperado_local?: string;
  veiculo_recuperado_estado?: VeiculoRecuperadoEstado;
  
  // Garantia
  data_garantia_inicio?: string;
  data_garantia_fim?: string;
  garantia_observacoes?: string;
  
  // Sindicância/Perícia
  sindicante_id?: string;
  perito_id?: string;
  resultado_sindicancia?: ResultadoSindicancia;
  resultado_pericia?: string;
  sindicancia_prazo_fim?: string;
  motivo_analise_interna?: string;
  motivo_suspensao?: string;
  
  // Negação
  motivo_negacao?: MotivoNegacao;
  justificativa_negacao?: string;
  parecer?: string;
  
  // Prazos
  prazo_comunicado_dias?: number;
  data_prazo_documentos?: string;
  data_prazo_cota?: string;
  data_prazo_termo?: string;
  
  // Vínculos
  analista_id?: string;
  oficina_id?: string;
  ordem_servico_id?: string;
  
  // Flags
  alerta_recem_ativado?: boolean;
  
  // Coordenadas
  latitude_informada?: number;
  longitude_informada?: number;
  
  canal: CanalAbertura;
  created_at: string;
  updated_at: string;
}

export interface SinistroComRelacoes extends Sinistro {
  associado?: {
    id: string;
    nome: string;
    cpf: string;
    telefone: string;
    whatsapp?: string;
    email: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    data_adesao?: string;
    data_ativacao?: string;
    status?: string;
    plano?: {
      id: string;
      nome: string;
    };
  };
  veiculo?: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    ano_modelo: number;
    cor: string;
    chassi?: string;
    renavam?: string;
    valor_fipe?: number;
    codigo_fipe?: string;
    data_ativacao?: string;
  };
  analista?: {
    id: string;
    nome: string;
  };
  sindicante?: {
    id: string;
    nome: string;
  };
  perito?: {
    id: string;
    nome: string;
  };
  documentos?: SinistroDocumento[];
  fotos?: SinistroFoto[];
  historico?: SinistroHistorico[];
}

// ============================================
// INTERFACES DE DOCUMENTOS E FOTOS
// ============================================

export interface SinistroDocumento {
  id: string;
  sinistro_id: string;
  tipo: 'bo' | 'cnh' | 'crlv' | 'laudo' | 'orcamento' | 'nf' | 'cst' | 'ebrat' | 'lpst' | 'raph' | 'bam' | 'termo' | 'outros';
  nome: string;
  nome_arquivo?: string;
  url: string;
  status?: string;
  uploaded_at: string;
  created_at?: string;
}

export interface SinistroFoto {
  id: string;
  sinistro_id: string;
  categoria: 'veiculo_geral' | 'dano_frontal' | 'dano_traseiro' | 'dano_lateral' | 'dano_interno' | 'local_ocorrencia' | 'outros';
  url: string;
  descricao?: string;
  uploaded_at: string;
}

// ============================================
// INTERFACES DE HISTÓRICO
// ============================================

export interface SinistroHistorico {
  id: string;
  sinistro_id: string;
  status_anterior?: StatusSinistro;
  status_novo: StatusSinistro;
  usuario_id: string;
  usuario_nome?: string;
  observacao?: string;
  created_at: string;
}

// ============================================
// INTERFACES DE FILTROS
// ============================================

export interface SinistroFilters {
  search?: string;
  status?: StatusSinistro | StatusSinistro[];
  tipo?: TipoSinistro | TipoSinistro[];
  analista_id?: string;
  data_inicio?: string;
  data_fim?: string;
  canal?: CanalAbertura;
  sem_analista?: boolean;
  tipo_dano?: TipoDano;
}

// ============================================
// PAYLOADS
// ============================================

export interface AbrirSinistroPayload {
  associado_id: string;
  veiculo_id: string;
  tipo: TipoSinistro;
  data_ocorrencia: string;
  hora_ocorrencia?: string;
  local_ocorrencia: string;
  cidade_ocorrencia: string;
  estado_ocorrencia: string;
  descricao: string;
  tipo_local_evento?: TipoLocalEvento;
  houve_vitima?: boolean;
  condutor_nome?: string;
  condutor_cnh?: string;
  condutor_relacao?: CondutorRelacao;
  bo_numero?: string;
  canal: CanalAbertura;
}

export interface AtualizarSinistroPayload {
  tipo?: TipoSinistro;
  data_ocorrencia?: string;
  local_ocorrencia?: string;
  cidade_ocorrencia?: string;
  estado_ocorrencia?: string;
  descricao?: string;
  bo_numero?: string;
  valor_fipe_momento?: number;
  valor_orcamento?: number;
  valor_aprovado?: number;
  valor_participacao?: number;
  tipo_dano?: TipoDano;
  percentual_fipe?: number;
}

export interface MudarStatusSinistroPayload {
  sinistro_id: string;
  novo_status: StatusSinistro;
  observacao?: string;
}

export interface AtribuirAnalistaPayload {
  sinistro_id: string;
  analista_id: string;
}

export interface EncaminharSindicanciaPayload {
  sinistro_id: string;
  sindicante_id: string;
  motivo: string;
}

export interface RegistrarRecuperacaoPayload {
  sinistro_id: string;
  recuperado: boolean;
  local?: string;
  estado?: VeiculoRecuperadoEstado;
  observacao?: string;
}

// ============================================
// ESTATÍSTICAS
// ============================================

export interface ContagemSinistros {
  total: number;
  comunicados: number;
  em_analise: number;
  documentacao_pendente: number;
  aprovados: number;
  negados: number;
  em_reparo: number;
  em_sindicancia: number;
  em_recuperacao: number;
  encerrados_mes: number;
}

export interface EstatisticasSinistros {
  total_mes: number;
  total_ano: number;
  valor_total_aprovado: number;
  valor_total_pago: number;
  tempo_medio_analise_dias: number;
  taxa_aprovacao: number;
  por_tipo: Record<TipoSinistro, number>;
  por_status: Record<StatusSinistro, number>;
}

// ============================================
// HELPERS
// ============================================

export function isRouboFurto(tipo: TipoSinistro): boolean {
  return tipo === 'roubo' || tipo === 'furto';
}

export function isPerdaTotal(percentual: number): boolean {
  return percentual >= VALORES_SINISTRO.percentual_perda_total;
}

export function calcularPercentualFipe(valorOrcamento: number, valorFipe: number): number {
  if (!valorFipe || valorFipe <= 0) return 0;
  return Math.round((valorOrcamento / valorFipe) * 100 * 100) / 100;
}

export function getStatusesPermitidos(statusAtual: StatusSinistro): StatusSinistro[] {
  return WORKFLOW_SINISTRO[statusAtual] || [];
}

export function getPrazoComunicado(tipo: TipoSinistro): number {
  return isRouboFurto(tipo) 
    ? PRAZOS_SINISTRO.comunicado_roubo_furto 
    : PRAZOS_SINISTRO.comunicado_padrao;
}

export function getDocumentosNecessarios(tipoLocal: TipoLocalEvento, houveVitima: boolean): string[] {
  const docs = DOCUMENTOS_POR_LOCAL[tipoLocal];
  if (!docs) return [];
  return houveVitima ? docs.com_vitima : docs.sem_vitima;
}
