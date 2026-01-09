import type { EtapaLead } from '@/types/database';

/**
 * Transições permitidas entre etapas do funil de vendas
 * Cada etapa só pode avançar para etapas específicas
 */
export const transicoesPermitidas: Record<EtapaLead, EtapaLead[]> = {
  'novo': ['contato_inicial', 'contato', 'perdido'],
  'contato_inicial': ['apresentacao', 'qualificado', 'perdido'],
  'contato': ['qualificado', 'perdido'],
  'apresentacao': ['cotacao_enviada', 'perdido'],
  'qualificado': ['cotacao_enviada', 'perdido'],
  'cotacao_enviada': ['negociacao', 'perdido'],
  'negociacao': ['vistoria_agendada', 'contrato_enviado', 'perdido'],
  'vistoria_agendada': ['contrato_enviado', 'perdido'],
  'contrato_enviado': ['contrato_assinado', 'perdido'],
  'contrato_assinado': ['instalacao_agendada'],
  'instalacao_agendada': ['ganho', 'perdido'],
  'ganho': [], // Estado final
  'perdido': ['novo'], // Pode reativar
};

/**
 * Verifica se uma transição de etapa é permitida
 */
export function canTransition(from: EtapaLead, to: EtapaLead): boolean {
  // Normaliza etapas antigas para novas
  const normalizedFrom = normalizeEtapa(from);
  const normalizedTo = normalizeEtapa(to);
  
  return transicoesPermitidas[normalizedFrom]?.includes(normalizedTo) ?? false;
}

/**
 * Normaliza etapas antigas para o novo padrão
 */
export function normalizeEtapa(etapa: EtapaLead): EtapaLead {
  if (etapa === 'contato_inicial') return 'contato';
  if (etapa === 'apresentacao') return 'qualificado';
  return etapa;
}

/**
 * Retorna as próximas etapas possíveis para uma etapa atual
 */
export function getNextStages(currentStage: EtapaLead): EtapaLead[] {
  const normalized = normalizeEtapa(currentStage);
  return transicoesPermitidas[normalized] || [];
}

/**
 * Verifica se a transição requer ação prévia
 */
export interface TransitionRequirement {
  canProceed: boolean;
  message?: string;
  requiresCotacao?: boolean;
  requiresContrato?: boolean;
  requiresInstalacao?: boolean;
  requiresMotivoPerda?: boolean;
  requiresVeiculo?: boolean;
}

export function getTransitionRequirements(
  from: EtapaLead,
  to: EtapaLead
): TransitionRequirement {
  // Verificar se transição é permitida
  if (!canTransition(from, to)) {
    return {
      canProceed: false,
      message: `Não é possível mover de "${from}" para "${to}"`,
    };
  }

  // Verificar requisitos específicos
  const normalizedFrom = normalizeEtapa(from);
  const normalizedTo = normalizeEtapa(to);

  // novo/contato → qualificado: precisa de dados do veículo
  if (
    (normalizedFrom === 'novo' || normalizedFrom === 'contato' || normalizedFrom === 'contato_inicial') &&
    normalizedTo === 'qualificado'
  ) {
    return {
      canProceed: true, // UI deve verificar veículo
      requiresVeiculo: true,
      message: 'É necessário preencher os dados do veículo antes de qualificar',
    };
  }

  // qualificado → cotacao_enviada: precisa de cotação
  if (
    (normalizedFrom === 'qualificado' || normalizedFrom === 'apresentacao') &&
    normalizedTo === 'cotacao_enviada'
  ) {
    return {
      canProceed: true, // UI deve verificar cotação
      requiresCotacao: true,
      message: 'É necessário criar uma cotação antes de avançar',
    };
  }

  // negociacao → contrato_enviado: precisa de contrato
  if (normalizedFrom === 'negociacao' && normalizedTo === 'contrato_enviado') {
    return {
      canProceed: true, // UI deve verificar contrato
      requiresContrato: true,
      message: 'É necessário criar um contrato antes de avançar',
    };
  }

  // qualquer → perdido: obrigatório informar motivo
  if (normalizedTo === 'perdido') {
    return {
      canProceed: true,
      requiresMotivoPerda: true,
      message: 'Informe o motivo da perda',
    };
  }

  // instalacao_agendada → ganho: precisa de instalação concluída
  if (normalizedFrom === 'instalacao_agendada' && normalizedTo === 'ganho') {
    return {
      canProceed: true,
      requiresInstalacao: true,
      message: 'A instalação deve estar concluída',
    };
  }

  return { canProceed: true };
}

/**
 * Cores por etapa para badges
 */
export const etapaColors: Record<EtapaLead, string> = {
  novo: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  contato_inicial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  contato: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  apresentacao: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  qualificado: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  cotacao_enviada: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  negociacao: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  vistoria_agendada: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  contrato_enviado: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  contrato_assinado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  instalacao_agendada: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ganho: 'bg-green-500 text-white',
  perdido: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

/**
 * Cores por origem para badges
 */
export const origemColors: Record<string, string> = {
  site: 'bg-blue-100 text-blue-800',
  whatsapp: 'bg-green-100 text-green-800',
  indicacao: 'bg-purple-100 text-purple-800',
  facebook: 'bg-indigo-100 text-indigo-800',
  instagram: 'bg-pink-100 text-pink-800',
  google: 'bg-red-100 text-red-800',
  telefone: 'bg-gray-100 text-gray-800',
  presencial: 'bg-yellow-100 text-yellow-800',
  parceiro: 'bg-teal-100 text-teal-800',
  api: 'bg-slate-100 text-slate-800',
  outro: 'bg-gray-100 text-gray-800',
};

/**
 * Etapas do funil na ordem correta (11 etapas)
 * Usando apenas as novas nomenclaturas
 */
export const ETAPAS_FUNIL: EtapaLead[] = [
  'novo',
  'contato',
  'qualificado',
  'cotacao_enviada',
  'negociacao',
  'vistoria_agendada',
  'contrato_enviado',
  'contrato_assinado',
  'instalacao_agendada',
  'ganho',
  'perdido',
];

/**
 * Etapas do Kanban de VENDAS (11 etapas oficiais conforme PRD)
 */
export const ETAPAS_KANBAN_VENDAS: EtapaLead[] = [
  'novo',
  'contato',
  'qualificado',
  'cotacao_enviada',
  'negociacao',
  'vistoria_agendada',
  'contrato_enviado',
  'contrato_assinado',
  'instalacao_agendada',
  'ganho',
  'perdido',
];

/**
 * Cores dos dots para headers das colunas Kanban
 */
export const etapaDotColors: Record<EtapaLead, string> = {
  novo: 'bg-blue-500',
  contato_inicial: 'bg-sky-500',
  contato: 'bg-cyan-500',
  apresentacao: 'bg-violet-500',
  qualificado: 'bg-purple-500',
  cotacao_enviada: 'bg-orange-500',
  negociacao: 'bg-pink-500',
  vistoria_agendada: 'bg-teal-500',
  contrato_enviado: 'bg-indigo-500',
  contrato_assinado: 'bg-emerald-500',
  instalacao_agendada: 'bg-lime-500',
  ganho: 'bg-green-500',
  perdido: 'bg-red-500',
};
