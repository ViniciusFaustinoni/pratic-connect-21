/**
 * Detecta se uma cotação está "travada" num passo após a assinatura do termo,
 * para sinalizar ao consultor (badge pulsante) que o cliente provavelmente
 * precisa de um nudge.
 *
 * Regra principal: só considera travada cotações cujo CONTRATO já está
 * `assinado` ou `ativo`. Antes da assinatura o consultor já tem o funil normal.
 *
 * Fora de escopo (não aciona o flag): em_analise, associado_ativo,
 * vistoria_realizada, veiculo_recusado, cancelado — nesses casos a bola
 * está fora do cliente.
 *
 * Fonte do "tempo no passo atual": `cotacoes.updated_at`. É bumpado por
 * triggers e mutações relevantes; suficiente para SLAs em horas.
 */

import { getEtapaVenda, type EtapaVenda } from './cotacaoEtapa';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';

export type NivelTravada = 'amarelo' | 'vermelho';

export interface CotacaoTravadaInfo {
  travada: boolean;
  nivel: NivelTravada | null;
  motivo: string | null;
  horasParada: number;
  etapa: EtapaVenda | null;
}

interface SlaEtapa {
  amareloHoras: number;
  vermelhoHoras: number;
  label: string;
}

const SLA_POR_ETAPA: Partial<Record<EtapaVenda, SlaEtapa>> = {
  realizando_pagamento: { amareloHoras: 6, vermelhoHoras: 24, label: 'Realizando Pagamento' },
  escolha_vistoria: { amareloHoras: 12, vermelhoHoras: 36, label: 'Escolha de Vistoria' },
  realizando_autovistoria: { amareloHoras: 12, vermelhoHoras: 48, label: 'Realizando Autovistoria' },
  aguardando_vistoria: { amareloHoras: 24, vermelhoHoras: 48, label: 'Aguardando Vistoria' },
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
  const vazio: CotacaoTravadaInfo = {
    travada: false,
    nivel: null,
    motivo: null,
    horasParada: 0,
    etapa: null,
  };

  const contratoStatus = cotacao.contrato?.status;
  if (!contratoStatus || !['assinado', 'ativo'].includes(contratoStatus)) {
    return vazio;
  }

  const etapa = getEtapaVenda(cotacao);
  if (!etapa || SEM_FLAG.has(etapa)) return vazio;

  const desde = cotacao.updated_at || cotacao.created_at;
  if (!desde) return { ...vazio, etapa };
  const horas = diffHoras(desde, agora);

  // Vistoria/instalação agendada com data no passado e não concluída.
  if (etapa === 'vistoria_agendada' || etapa === 'instalacao_agendada') {
    const inst = cotacao.instalacoes?.[0];
    const dataAg = inst?.data_agendada
      ? new Date(inst.data_agendada)
      : cotacao.vistoria_data_agendada
        ? new Date(cotacao.vistoria_data_agendada as any)
        : null;
    if (!dataAg) return { ...vazio, etapa };
    const concluida = inst?.status === 'concluida';
    if (concluida) return { ...vazio, etapa };
    const horasApos = diffHoras(dataAg, agora);
    if (horasApos <= 0) return { ...vazio, etapa };
    return {
      travada: true,
      nivel: horasApos > 24 ? 'vermelho' : 'amarelo',
      motivo: `Vistoria agendada para ${dataAg.toLocaleDateString('pt-BR')} sem conclusão`,
      horasParada: horasApos,
      etapa,
    };
  }

  const sla = SLA_POR_ETAPA[etapa];
  if (!sla) return { ...vazio, etapa };

  if (horas <= sla.amareloHoras) return { ...vazio, etapa };

  const nivel: NivelTravada = horas > sla.vermelhoHoras ? 'vermelho' : 'amarelo';
  const horasInt = Math.round(horas);
  return {
    travada: true,
    nivel,
    motivo: `Cliente parado em "${sla.label}" há ${horasInt}h`,
    horasParada: horas,
    etapa,
  };
}
