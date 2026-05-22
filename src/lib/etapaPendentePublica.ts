/**
 * FONTE ÚNICA DE VOCABULÁRIO para "etapa pendente do link público".
 *
 * Usada nas três telas para que Consultor, Cadastro e Monitoramento falem
 * a mesma língua sobre o que falta o associado fazer:
 *  - Consultor: tooltip da FlagTravada (src/components/cotacoes/FlagTravada.tsx)
 *  - Cadastro: aba "Link Público Incompleto" em /cadastro/propostas-pendentes
 *  - Monitoramento: tradução dos motivos do guard `caminho_publico_incompleto`
 *    em /monitoramento/aprovacao-instalacao-detalhe
 *
 * NUNCA criar labels paralelas para o mesmo conceito — sempre importar daqui.
 */

import { getEtapaVenda, type EtapaVenda } from './cotacaoEtapa';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';

export type CodigoEtapaPendente =
  | 'aguardando_escolha_plano'
  | 'aguardando_documentos'
  | 'aguardando_assinatura_contrato'
  | 'aguardando_pagamento_adesao'
  | 'aguardando_escolha_vistoria'
  | 'aguardando_autovistoria'
  | 'aguardando_agendamento_instalacao'
  | 'aguardando_execucao_agendada'
  | 'nenhuma';

export interface EtapaPendenteInfo {
  codigo: CodigoEtapaPendente;
  /** Label curto (badge/coluna). Usar exatamente este texto em qualquer UI. */
  label: string;
  /** Texto para exibir ao operador, contextualizando o que o associado precisa fazer. */
  descricaoAssociado: string;
  /** Quem é o responsável por destravar (cobrar). */
  cobrar: 'associado' | 'operacao';
}

const CATALOGO: Record<CodigoEtapaPendente, Omit<EtapaPendenteInfo, 'codigo'>> = {
  aguardando_escolha_plano: {
    label: 'Aguardando escolha do plano',
    descricaoAssociado: 'O associado ainda não escolheu o plano no link público.',
    cobrar: 'associado',
  },
  aguardando_documentos: {
    label: 'Aguardando documentos',
    descricaoAssociado: 'O associado ainda não enviou todos os documentos exigidos.',
    cobrar: 'associado',
  },
  aguardando_assinatura_contrato: {
    label: 'Aguardando assinatura do contrato',
    descricaoAssociado: 'Contrato gerado, falta o associado assinar via Autentique.',
    cobrar: 'associado',
  },
  aguardando_pagamento_adesao: {
    label: 'Aguardando pagamento da adesão',
    descricaoAssociado: 'O associado ainda não pagou a adesão.',
    cobrar: 'associado',
  },
  aguardando_escolha_vistoria: {
    label: 'Aguardando escolha de vistoria',
    descricaoAssociado: 'O associado ainda não escolheu a modalidade de vistoria.',
    cobrar: 'associado',
  },
  aguardando_autovistoria: {
    label: 'Aguardando autovistoria',
    descricaoAssociado: 'O associado precisa concluir a autovistoria pelo link público (fotos + vídeo 360°).',
    cobrar: 'associado',
  },
  aguardando_agendamento_instalacao: {
    label: 'Aguardando agendamento da instalação',
    descricaoAssociado: 'O associado ainda não escolheu data/hora da instalação no link público.',
    cobrar: 'associado',
  },
  aguardando_execucao_agendada: {
    label: 'Aguardando execução do agendamento',
    descricaoAssociado: 'Agendamento marcado — falta a vistoria/instalação acontecer.',
    cobrar: 'operacao',
  },
  nenhuma: {
    label: 'Sem pendência no link público',
    descricaoAssociado: '',
    cobrar: 'operacao',
  },
};

export function descreverEtapaPendente(codigo: CodigoEtapaPendente): EtapaPendenteInfo {
  return { codigo, ...CATALOGO[codigo] };
}

/**
 * Mapeia a `EtapaVenda` (já calculada por getEtapaVenda) para o código canônico
 * de etapa pendente do link público. Etapas onde a bola está fora do cliente
 * (em_analise, associado_ativo, vistoria_realizada, recusado, cancelado)
 * devolvem `nenhuma`.
 */
export function etapaVendaParaPendente(etapa: EtapaVenda | null): CodigoEtapaPendente {
  if (!etapa) return 'aguardando_escolha_plano';
  switch (etapa) {
    case 'cotacao_realizada':
    case 'escolhendo_plano':
      return 'aguardando_escolha_plano';
    case 'enviando_documentos':
      return 'aguardando_documentos';
    case 'assinando_contrato':
      return 'aguardando_assinatura_contrato';
    case 'realizando_pagamento':
      return 'aguardando_pagamento_adesao';
    case 'escolha_vistoria':
      return 'aguardando_escolha_vistoria';
    case 'realizando_autovistoria':
      return 'aguardando_autovistoria';
    case 'aguardando_vistoria':
      return 'aguardando_agendamento_instalacao';
    case 'vistoria_agendada':
    case 'instalacao_agendada':
      return 'aguardando_execucao_agendada';
    default:
      return 'nenhuma';
  }
}

/**
 * Atalho: cotação → etapa pendente canônica.
 */
export function getEtapaPendentePublica(cotacao: CotacaoWithRelations): EtapaPendenteInfo {
  const etapa = getEtapaVenda(cotacao);
  const codigo = etapaVendaParaPendente(etapa);
  return descreverEtapaPendente(codigo);
}

/**
 * Mapeia os motivos canônicos retornados pelo guard backend
 * `aprovar-proposta` (caminho_publico_incompleto) para o código canônico.
 * Aceita uma string de motivos separada por vírgula (formato do edge).
 */
export function motivoGuardParaEtapaPendente(motivos: string | null | undefined): CodigoEtapaPendente {
  if (!motivos) return 'nenhuma';
  const lista = motivos.split(',').map((m) => m.trim().toLowerCase());

  // Prioridade: vistoria > agendamento (mais específico vence)
  if (lista.includes('vistoria_incompleta')) return 'aguardando_autovistoria';
  if (lista.includes('sem_vistoria')) return 'aguardando_autovistoria';
  if (lista.includes('sem_agendamento')) return 'aguardando_agendamento_instalacao';
  if (lista.includes('agendamento_base')) return 'aguardando_agendamento_instalacao';
  return 'aguardando_agendamento_instalacao';
}

/**
 * Conjunto de códigos que indicam pendência ativa do lado do associado
 * (usado em filtros e SLAs). `aguardando_execucao_agendada` fica fora porque
 * a bola está com a operação, não com o cliente.
 */
export const CODIGOS_PENDENCIA_ASSOCIADO: ReadonlySet<CodigoEtapaPendente> = new Set([
  'aguardando_escolha_plano',
  'aguardando_documentos',
  'aguardando_assinatura_contrato',
  'aguardando_pagamento_adesao',
  'aguardando_escolha_vistoria',
  'aguardando_autovistoria',
  'aguardando_agendamento_instalacao',
]);
