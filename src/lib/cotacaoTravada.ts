/**
 * Detecta se uma cotação está "travada" em alguma etapa do link público,
 * para sinalizar ao consultor (badge pulsante) que o cliente precisa de nudge.
 *
 * Cobre PRÉ-ASSINATURA (plano/docs/contrato) e PÓS-ASSINATURA (vistoria/instalação).
 * Antes só tratava pós-assinatura — agora o gate `contratoStatus in [assinado, ativo]`
 * foi removido para alinhar com a nova aba "Link Público Incompleto" do Cadastro.
 *
 * Fora de escopo (não aciona o flag): em_analise, associado_ativo,
 * vistoria_realizada, realizando_vistoria, veiculo_recusado, cancelado.
 *
 * Fonte do "tempo no passo atual": `cotacoes.updated_at`. É bumpado por
 * triggers e mutações relevantes; suficiente para SLAs em horas.
 */

import { getEtapaVenda, type EtapaVenda } from './cotacaoEtapa';
import { etapaVendaParaPendente, descreverEtapaPendente, type CodigoEtapaPendente } from './etapaPendentePublica';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';

export type NivelTravada = 'amarelo' | 'vermelho';

export interface CotacaoTravadaInfo {
  travada: boolean;
  nivel: NivelTravada | null;
  motivo: string | null;
  horasParada: number;
  etapa: EtapaVenda | null;
  /** Código canônico da etapa pendente (mesmo vocabulário do Cadastro). */
  codigoPendente: CodigoEtapaPendente;
}

interface SlaEtapa {
  amareloHoras: number;
  vermelhoHoras: number;
}

// SLA por etapa do funil (mesmas faixas amarelo/vermelho usadas pelo Cadastro).
const SLA_POR_ETAPA: Partial<Record<EtapaVenda, SlaEtapa>> = {
  // Pré-assinatura
  escolhendo_plano: { amareloHoras: 12, vermelhoHoras: 48 },
  enviando_documentos: { amareloHoras: 12, vermelhoHoras: 48 },
  assinando_contrato: { amareloHoras: 6, vermelhoHoras: 24 },
  // Pós-assinatura
  realizando_pagamento: { amareloHoras: 6, vermelhoHoras: 24 },
  escolha_vistoria: { amareloHoras: 12, vermelhoHoras: 36 },
  realizando_autovistoria: { amareloHoras: 12, vermelhoHoras: 48 },
  aguardando_vistoria: { amareloHoras: 24, vermelhoHoras: 48 },
};

const SEM_FLAG: ReadonlySet<EtapaVenda> = new Set<EtapaVenda>([
  'em_analise',
  'associado_ativo',
  'vistoria_realizada',
  'veiculo_recusado',
  'cancelado',
  'realizando_vistoria',
]);

function diffHoras(desde: string | Date, agora: Date): number {
  const t = typeof desde === 'string' ? new Date(desde).getTime() : desde.getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (agora.getTime() - t) / (1000 * 60 * 60));
}

export function getCotacaoTravada(
  cotacao: CotacaoWithRelations,
  agora: Date = new Date(),
): CotacaoTravadaInfo {
  const etapa = getEtapaVenda(cotacao);
  const codigoPendente = etapaVendaParaPendente(etapa);
  const vazio: CotacaoTravadaInfo = {
    travada: false,
    nivel: null,
    motivo: null,
    horasParada: 0,
    etapa,
    codigoPendente,
  };

  if (!etapa || SEM_FLAG.has(etapa)) return vazio;

  const labelCanonica = descreverEtapaPendente(codigoPendente).label;
  const desde = cotacao.updated_at || cotacao.created_at;
  if (!desde) return vazio;
  const horas = diffHoras(desde, agora);

  // Vistoria/instalação agendada com data no passado e não concluída.
  if (etapa === 'vistoria_agendada' || etapa === 'instalacao_agendada') {
    const inst = cotacao.instalacoes?.[0];
    const dataAg = inst?.data_agendada
      ? new Date(inst.data_agendada)
      : cotacao.vistoria_data_agendada
        ? new Date(cotacao.vistoria_data_agendada as any)
        : null;
    if (!dataAg) return vazio;
    const concluida = inst?.status === 'concluida';
    if (concluida) return vazio;
    const horasApos = diffHoras(dataAg, agora);
    if (horasApos <= 0) return vazio;
    return {
      travada: true,
      nivel: horasApos > 24 ? 'vermelho' : 'amarelo',
      motivo: `Agendamento de ${dataAg.toLocaleDateString('pt-BR')} sem conclusão`,
      horasParada: horasApos,
      etapa,
      codigoPendente,
    };
  }

  const sla = SLA_POR_ETAPA[etapa];
  if (!sla) return vazio;

  if (horas <= sla.amareloHoras) return vazio;

  const nivel: NivelTravada = horas > sla.vermelhoHoras ? 'vermelho' : 'amarelo';
  const horasInt = Math.round(horas);
  return {
    travada: true,
    nivel,
    motivo: `${labelCanonica} há ${horasInt}h`,
    horasParada: horas,
    etapa,
    codigoPendente,
  };
}
