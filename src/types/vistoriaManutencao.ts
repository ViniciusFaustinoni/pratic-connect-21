/**
 * Tipos e constantes para Vistoria de Manutenção de Rastreadores
 * Sistema de manutenção operacional de campo
 */

// ============================================
// ENUMS E TIPOS
// ============================================

/**
 * Motivos para abertura de vistoria de manutenção
 */
export type MotivoManutencao = 
  | 'sem_sinal'
  | 'bateria_baixa'
  | 'gps_incorreto'
  | 'alarme_desconexao'
  | 'verificacao_periodica'
  | 'suspeita_violacao'
  | 'outro';

/**
 * Tipo de local para atendimento
 */
export type LocalTipoManutencao = 'base' | 'ponto_instalacao' | 'rota';

/**
 * Resultado da manutenção (Processo 1 - Campo)
 */
export type ResultadoManutencao = 
  | 'resolvido'       // Consertou no local, rastreador continua instalado
  | 'substituicao'    // Trocou por outro rastreador
  | 'nao_resolvido';  // Não conseguiu resolver, precisa reagendar

/**
 * Destino do rastreador antigo quando há substituição
 */
export type DestinoRastreadorSubstituido = 'retorno_base' | 'baixado';

/**
 * Ação quando não resolvido no campo
 */
export type AcaoNaoResolvido = 'reagendar' | 'cancelar';

// ============================================
// LABELS PARA UI
// ============================================

export const MOTIVO_MANUTENCAO_LABELS: Record<MotivoManutencao, string> = {
  sem_sinal: 'Sem sinal',
  bateria_baixa: 'Bateria baixa',
  gps_incorreto: 'GPS incorreto',
  alarme_desconexao: 'Alarme de desconexão',
  verificacao_periodica: 'Verificação periódica',
  suspeita_violacao: 'Suspeita de violação',
  outro: 'Outro',
};

export const MOTIVO_MANUTENCAO_DESCRICOES: Record<MotivoManutencao, string> = {
  sem_sinal: 'Rastreador parou de transmitir posições',
  bateria_baixa: 'Tensão da bateria abaixo do normal',
  gps_incorreto: 'Posição GPS divergente da realidade',
  alarme_desconexao: 'Sistema disparou alerta de desconexão',
  verificacao_periodica: 'Manutenção preventiva de rotina',
  suspeita_violacao: 'Possível adulteração do equipamento',
  outro: 'Outro motivo não listado',
};

export const LOCAL_TIPO_LABELS: Record<LocalTipoManutencao, string> = {
  base: 'Base',
  ponto_instalacao: 'Ponto de Instalação',
  rota: 'Rota',
};

export const LOCAL_TIPO_DESCRICOES: Record<LocalTipoManutencao, string> = {
  base: 'Associado deve comparecer à sede da empresa',
  ponto_instalacao: 'Associado vai a um ponto de instalação autorizado',
  rota: 'Técnico vai até o local do associado',
};

export const RESULTADO_MANUTENCAO_LABELS: Record<ResultadoManutencao, string> = {
  resolvido: 'Problema resolvido',
  substituicao: 'Substituição de rastreador',
  nao_resolvido: 'Não resolvido',
};

export const DESTINO_RASTREADOR_LABELS: Record<DestinoRastreadorSubstituido, string> = {
  retorno_base: 'Enviar para Triagem (Base)',
  baixado: 'Baixar Definitivamente',
};

export const ACAO_NAO_RESOLVIDO_LABELS: Record<AcaoNaoResolvido, string> = {
  reagendar: 'Reagendar manutenção',
  cancelar: 'Cancelar manutenção',
};

// ============================================
// CORES PARA UI (BADGES)
// ============================================

export const MOTIVO_MANUTENCAO_COLORS: Record<MotivoManutencao, string> = {
  sem_sinal: 'bg-red-100 text-red-800',
  bateria_baixa: 'bg-orange-100 text-orange-800',
  gps_incorreto: 'bg-yellow-100 text-yellow-800',
  alarme_desconexao: 'bg-purple-100 text-purple-800',
  verificacao_periodica: 'bg-blue-100 text-blue-800',
  suspeita_violacao: 'bg-rose-100 text-rose-800',
  outro: 'bg-gray-100 text-gray-800',
};

export const LOCAL_TIPO_COLORS: Record<LocalTipoManutencao, string> = {
  base: 'bg-indigo-100 text-indigo-800',
  ponto_instalacao: 'bg-cyan-100 text-cyan-800',
  rota: 'bg-emerald-100 text-emerald-800',
};

// ============================================
// OPÇÕES PARA SELECTS
// ============================================

export const MOTIVOS_MANUTENCAO_OPTIONS = Object.entries(MOTIVO_MANUTENCAO_LABELS).map(
  ([value, label]) => ({
    value: value as MotivoManutencao,
    label,
    description: MOTIVO_MANUTENCAO_DESCRICOES[value as MotivoManutencao],
  })
);

export const LOCAL_TIPO_OPTIONS = Object.entries(LOCAL_TIPO_LABELS).map(
  ([value, label]) => ({
    value: value as LocalTipoManutencao,
    label,
    description: LOCAL_TIPO_DESCRICOES[value as LocalTipoManutencao],
  })
);

// ============================================
// INTERFACES
// ============================================

/**
 * Dados específicos de manutenção em um serviço
 */
export interface ServicoManutencaoExtras {
  motivo_manutencao: MotivoManutencao | null;
  motivo_detalhe: string | null;
  local_tipo_manutencao: LocalTipoManutencao | null;
  protecao_suspensa: boolean;
  data_suspensao: string | null;
  rastreador_substituto_id: string | null;
  resultado_manutencao: ResultadoManutencao | null;
}

/**
 * Serviço de manutenção com relacionamentos expandidos
 */
export interface VistoriaManutencao {
  id: string;
  protocolo: string | null;
  tipo: 'vistoria_manutencao';
  status: string;
  data_agendada: string;
  periodo: string;
  
  // Campos específicos de manutenção
  motivo_manutencao: MotivoManutencao | null;
  motivo_detalhe: string | null;
  local_tipo_manutencao: LocalTipoManutencao | null;
  protecao_suspensa: boolean;
  data_suspensao: string | null;
  rastreador_substituto_id: string | null;
  resultado_manutencao: ResultadoManutencao | null;
  
  // Endereço
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  concluida_em: string | null;
  
  // Observações
  observacoes: string | null;
  observacoes_analise: string | null;
  
  // Relacionamentos
  associado_id: string | null;
  veiculo_id: string | null;
  rastreador_id: string | null;
  profissional_id: string | null;
  
  // Joins expandidos
  associado?: {
    id: string;
    nome: string;
    telefone: string;
    whatsapp: string | null;
    cpf: string;
    email: string;
  } | null;
  veiculo?: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    cor: string | null;
    ano_fabricacao: number | null;
  } | null;
  rastreador?: {
    id: string;
    codigo: string;
    imei: string | null;
    plataforma: string | null;
  } | null;
  rastreador_substituto?: {
    id: string;
    codigo: string;
    imei: string | null;
  } | null;
  profissional?: {
    id: string;
    nome: string;
    telefone: string | null;
  } | null;
}

/**
 * Métricas para cards de resumo
 */
export interface ManutencaoMetricas {
  pendentes: number;
  agendadas: number;
  emAndamento: number;
  naoCompareceu: number;
  concluidasHoje: number;
  total: number;
}

/**
 * Filtros para listagem de manutenções
 */
export interface ManutencaoFiltros {
  status?: string | string[];
  motivo?: MotivoManutencao | MotivoManutencao[];
  localTipo?: LocalTipoManutencao | LocalTipoManutencao[];
  profissionalId?: string;
  dataInicio?: string;
  dataFim?: string;
  busca?: string; // Busca por nome, placa, código rastreador
  protecaoSuspensa?: boolean;
}

/**
 * Parâmetros para abrir uma manutenção
 */
export interface AbrirManutencaoParams {
  rastreadorId: string;
  motivo: MotivoManutencao;
  motivoDetalhe?: string;
}

/**
 * Parâmetros para agendar uma manutenção
 */
export interface AgendarManutencaoParams {
  servicoId: string;
  dataAgendada: string;
  periodo: 'manha' | 'tarde';
  localTipo: LocalTipoManutencao;
  localEndereco?: string;
  profissionalId: string;
  notificarWhatsApp?: boolean;
}

/**
 * Parâmetros para registrar resultado
 */
export interface RegistrarResultadoParams {
  servicoId: string;
  resultado: ResultadoManutencao;
  descricao: string;
  // Se resultado = 'substituicao'
  rastreadorNovoId?: string;
  idPlataforma?: string;
  destinoRastreadorAntigo?: DestinoRastreadorSubstituido;
  // Se resultado = 'nao_resolvido'
  acaoNaoResolvido?: AcaoNaoResolvido;
}

/**
 * Parâmetros para marcar não comparecimento
 */
export interface MarcarNaoCompareceuParams {
  servicoId: string;
  observacao?: string;
}

// ============================================
// HELPERS
// ============================================

/**
 * Verifica se um serviço é do tipo manutenção
 */
export function isVistoriaManutencao(tipo: string): boolean {
  return tipo === 'vistoria_manutencao';
}

/**
 * Verifica se pode suspender proteção (apenas tipo BASE após 48h)
 */
export function podeSuspenderProtecao(
  localTipo: LocalTipoManutencao | null,
  dataAgendada: string
): boolean {
  if (localTipo !== 'base') return false;
  
  const agendada = new Date(dataAgendada);
  const agora = new Date();
  const diffHoras = (agora.getTime() - agendada.getTime()) / (1000 * 60 * 60);
  
  return diffHoras >= 48;
}

/**
 * Verifica se pode marcar como não compareceu (apenas tipo BASE)
 */
export function podeMarcarNaoCompareceu(localTipo: LocalTipoManutencao | null): boolean {
  return localTipo === 'base';
}

/**
 * Retorna o ícone apropriado para o motivo
 */
export function getMotivoIcon(motivo: MotivoManutencao): string {
  const icons: Record<MotivoManutencao, string> = {
    sem_sinal: 'signal-slash',
    bateria_baixa: 'battery-low',
    gps_incorreto: 'map-pin-off',
    alarme_desconexao: 'bell-ring',
    verificacao_periodica: 'calendar-check',
    suspeita_violacao: 'shield-alert',
    outro: 'help-circle',
  };
  return icons[motivo] || 'help-circle';
}
