/**
 * FONTE ÚNICA DE VERDADE para a "Etapa da Venda" exibida no Kanban/Cards/Tabela de cotações.
 *
 * IMPORTANTE: Não duplicar essa lógica em componentes. Sempre importar daqui.
 *
 * Ordem de prioridade (top-down) — a primeira condição satisfeita vence:
 *  1. Cancelamento
 *  2. Veículo recusado
 *  3. Associado já ativo (jornada completa)
 *  4. Associado em análise
 *  5. Vistoria/instalação concluída ou em andamento
 *  6. Contrato assinado MAS pagamento ainda pendente → realizando_pagamento
 *  7. Pagamento OK + instalação agendada → vistoria/instalação_agendada
 *  8. Pagamento OK + sem instalação ainda → aguardando_vistoria   (NOVO)
 *  9. Contrato em fase de assinatura → assinando_contrato
 * 10. Etapas anteriores derivadas de status_contratacao
 *     (documentos_ok / dados_preenchidos / plano_escolhido / autovistoria)
 * 11. Fallbacks para cotação aceita/enviada → cotacao_realizada
 */

import {
  FileText, Send, Check, X, Eye, Clock, FileSignature,
  CreditCard, Camera, Calendar, MapPin, Wrench, CheckCircle2,
  ListChecks, FileUp, AlertCircle, Trophy, XCircle, Hourglass,
} from 'lucide-react';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';

export type EtapaVenda =
  | 'cotacao_realizada'
  | 'escolhendo_plano'
  | 'enviando_documentos'
  | 'escolha_vistoria'
  | 'realizando_autovistoria'
  | 'assinando_contrato'
  | 'realizando_pagamento'
  | 'aguardando_vistoria'
  | 'vistoria_agendada'
  | 'instalacao_agendada'
  | 'realizando_vistoria'
  | 'vistoria_realizada'
  | 'em_analise'
  | 'associado_ativo'
  | 'veiculo_recusado'
  | 'cancelado';

export interface EtapaConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof FileText;
}

export const etapaVendaConfig: Record<EtapaVenda, EtapaConfig> = {
  cotacao_realizada: {
    label: 'Cotação Realizada',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-500/20',
    icon: FileText,
  },
  escolhendo_plano: {
    label: 'Escolhendo Plano',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-500/20',
    icon: ListChecks,
  },
  enviando_documentos: {
    label: 'Enviando Documentos',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: FileUp,
  },
  escolha_vistoria: {
    label: 'Escolha de Vistoria',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    icon: ListChecks,
  },
  realizando_autovistoria: {
    label: 'Realizando Autovistoria',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/20',
    icon: Camera,
  },
  assinando_contrato: {
    label: 'Assinando Contrato',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/20',
    icon: FileSignature,
  },
  realizando_pagamento: {
    label: 'Realizando Pagamento',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/20',
    icon: CreditCard,
  },
  aguardando_vistoria: {
    label: 'Aguardando Vistoria',
    color: 'text-fuchsia-600 dark:text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/20',
    icon: Hourglass,
  },
  vistoria_agendada: {
    label: 'Vistoria Agendada',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-500/20',
    icon: Calendar,
  },
  instalacao_agendada: {
    label: 'Instalação Agendada',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/20',
    icon: Wrench,
  },
  realizando_vistoria: {
    label: 'Realizando Vistoria',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    icon: MapPin,
  },
  vistoria_realizada: {
    label: 'Vistoria Realizada',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-500/20',
    icon: CheckCircle2,
  },
  em_analise: {
    label: 'Em Análise',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    icon: AlertCircle,
  },
  associado_ativo: {
    label: 'Associado Ativo',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    icon: Trophy,
  },
  veiculo_recusado: {
    label: 'Veículo Recusado',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/20',
    icon: XCircle,
  },
  cancelado: {
    label: 'Cancelado',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/20',
    icon: X,
  },
};

/**
 * Determina a etapa atual da venda. Retorna null se a cotação ainda é só rascunho
 * sem qualquer indicador de contratação.
 */
export const getEtapaVenda = (cotacao: CotacaoWithRelations): EtapaVenda | null => {
  const associadoStatus = cotacao.contrato?.associados?.status;
  const contratoStatus = cotacao.contrato?.status;
  const adesaoPaga = cotacao.contrato?.adesao_paga;
  const statusContratacao = cotacao.status_contratacao;
  const instalacao = cotacao.instalacoes?.[0];
  const tipoVistoria = cotacao.tipo_vistoria;

  // 1. Cancelamento (prioridade máxima)
  if (
    associadoStatus === 'cancelado' ||
    contratoStatus === 'cancelado' ||
    statusContratacao === 'cancelado'
  ) return 'cancelado';

  // 2. Veículo recusado
  if (cotacao.status === 'recusada' || statusContratacao === 'veiculo_recusado') {
    return 'veiculo_recusado';
  }

  // 3. Associado já ativo → jornada concluída
  if (
    associadoStatus === 'ativo' &&
    contratoStatus &&
    ['assinado', 'ativo'].includes(contratoStatus)
  ) return 'associado_ativo';

  // 4. Associado em análise (pós-vistoria, aguardando aprovação humana)
  if (associadoStatus === 'em_analise') return 'em_analise';

  // 5. Vistoria/instalação concluída ou em andamento
  if (instalacao) {
    if (instalacao.status === 'concluida') return 'vistoria_realizada';
    if (instalacao.status === 'em_andamento' || instalacao.status === 'em_rota') {
      return 'realizando_vistoria';
    }
  }

  // 6. Contrato assinado MAS pagamento ainda não confirmado → pagamento
  //    (vale ANTES de qualquer etapa pós-pagamento)
  if (
    (contratoStatus === 'assinado' || contratoStatus === 'ativo') &&
    adesaoPaga === false
  ) {
    return 'realizando_pagamento';
  }

  // Autovistoria escolhida + pagamento pendente
  if (tipoVistoria === 'autovistoria' && adesaoPaga === false) {
    return 'realizando_autovistoria';
  }

  // 7. Pagamento OK + instalação já agendada
  if (
    adesaoPaga === true &&
    instalacao &&
    (instalacao.status === 'agendada' || instalacao.status === 'reagendada')
  ) {
    return tipoVistoria === 'autovistoria' ? 'instalacao_agendada' : 'vistoria_agendada';
  }

  // 8. Pagamento OK MAS sem instalação ainda criada → aguardando vistoria
  //    (NOVA ETAPA — preenche o vácuo entre "Realizando Pagamento" e "Vistoria Agendada")
  if (adesaoPaga === true) {
    if (
      statusContratacao === 'pagamento_ok' ||
      statusContratacao === 'contrato_assinado' ||
      statusContratacao === 'documentos_ok' ||
      contratoStatus === 'assinado' ||
      contratoStatus === 'ativo' ||
      associadoStatus === 'pendente_vistoria' ||
      associadoStatus === 'aguardando_instalacao'
    ) {
      return 'aguardando_vistoria';
    }
  }

  // 9. Contrato em fase de assinatura
  if (contratoStatus && ['pendente_assinatura', 'enviado', 'visualizado'].includes(contratoStatus)) {
    return 'assinando_contrato';
  }

  // 10. Etapas pré-contrato derivadas de status_contratacao
  if (statusContratacao === 'vistoria_ok') {
    // vistoria pré-contrato concluída, agora paga
    if (tipoVistoria === 'agendada' && cotacao.vistoria_data_agendada) {
      return 'vistoria_agendada';
    }
    return 'realizando_pagamento';
  }
  if (statusContratacao === 'contrato_gerado') return 'assinando_contrato';
  if (statusContratacao === 'contrato_assinado') {
    return adesaoPaga === false ? 'realizando_pagamento' : 'aguardando_vistoria';
  }
  if (statusContratacao === 'autovistoria_ok') return 'realizando_pagamento';
  if (statusContratacao === 'documentos_ok') return 'escolha_vistoria';
  if (statusContratacao === 'dados_preenchidos') return 'enviando_documentos';
  if (statusContratacao === 'plano_escolhido') return 'escolhendo_plano';

  // Rascunho puro sem contratação iniciada
  const temContratacaoAtiva =
    statusContratacao && statusContratacao !== 'aguardando' && statusContratacao !== null;
  if (cotacao.status === 'rascunho' && !temContratacaoAtiva && !cotacao.contrato) return null;

  // 11. Fallbacks
  if (cotacao.status === 'enviada' || cotacao.status === 'aceita') return 'cotacao_realizada';
  if (temContratacaoAtiva) return 'cotacao_realizada';
  return null;
};
