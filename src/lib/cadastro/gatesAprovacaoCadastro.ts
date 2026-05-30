/**
 * FONTE ÚNICA — Gates do stepper de aprovação do Cadastro
 * ========================================================
 * Centraliza TODOS os motivos que impedem o analista de clicar
 * em "Aprovar Documentos" (sub-etapa 1) ou "Aprovar Proposta"
 * (sub-etapa 2). Cada gate carrega:
 *   - id            : chave estável p/ telemetria
 *   - label         : motivo curto exibido no banner
 *   - comoDestravar : ação concreta pro analista
 *   - subEtapa      : 1 (documentos) | 2 (vistoria/finalização) | 'ambas'
 *
 * Antes desta consolidação, cada gate era avaliado em ponto diferente
 * do JSX (`disabled={...}`, `pointer-events-none`, banners ad-hoc).
 * Resultado: clique sumia silenciosamente e analista ficava no escuro
 * (caso LUIZ FERNANDO / RVP0I41 — vistorias.video_360_url desincronizado
 * → autovistoriaCompleta=false → tipo_etapa_analise='agendamento_confirmado'
 * → aguardandoExecucao=true → podeAprovar=false sem feedback visível).
 *
 * Memória relacionada:
 *   mem://logic/operations/cadastro-duas-subetapas
 *   mem://logic/operations/cadastro-escopo-canonico
 */

export type GateSubEtapa = 1 | 2 | 'ambas';

export interface GateAprovacao {
  id: string;
  label: string;
  comoDestravar: string;
  subEtapa: GateSubEtapa;
}

export interface EntradaGates {
  /** status atual do contrato (`assinado`, `ativo`, `reprovado`, `cancelado`...) */
  statusContrato?: string | null;
  /** SGA › Situação Financeira liberada pelo gate. */
  sgaLiberado: boolean;
  /** Há documento solicitado pendente de reenvio pelo cliente. */
  temDocumentoPendente: boolean;
  /** Sub-etapa 1 já fechada (contratos.documentos_aprovados_em). */
  documentosAprovadosEm: string | null | undefined;
  /** tipo_etapa_analise === 'agendamento_confirmado' (vistoria/instalação pendente de execução). */
  aguardandoExecucao: boolean;
  /** Cadastro avalia só docs (sub-etapa 2 = só botão "Aprovar Proposta"). */
  aprovarApenasDocumentos: boolean;
  /** Existe ao menos 1 documento anexado pendente/reprovado (impede fechar sub-etapa 1). */
  haDocPendenteOuReprovado: boolean;
}

export interface ResultadoGates {
  /** Todos os gates ativos, na ordem de prioridade pro analista. */
  ativos: GateAprovacao[];
  /** Pode clicar em "Aprovar Documentos" (sub-etapa 1)? */
  podeAprovarDocumentos: boolean;
  /** Pode clicar em "Aprovar Proposta" (sub-etapa 2)? */
  podeAprovarProposta: boolean;
}

export function resolverGatesAprovacaoCadastro(input: EntradaGates): ResultadoGates {
  const ativos: GateAprovacao[] = [];

  // --- Gates universais (afetam ambas sub-etapas) ---
  if (input.statusContrato && input.statusContrato !== 'assinado') {
    ativos.push({
      id: 'contrato_nao_assinado',
      label: `Contrato em status "${input.statusContrato}" — fluxo de aprovação não está mais disponível`,
      comoDestravar:
        'Status só permite ação quando contrato está em "assinado". Verifique se a proposta já foi aprovada, reprovada ou cancelada.',
      subEtapa: 'ambas',
    });
  }

  if (!input.sgaLiberado) {
    ativos.push({
      id: 'sga_nao_liberado',
      label: 'Gate SGA › Situação Financeira não confirmado',
      comoDestravar:
        'Abra o card "Situação Financeira (SGA)" acima e confirme a liberação (ou registre o bypass auditado).',
      subEtapa: 'ambas',
    });
  }

  if (input.temDocumentoPendente) {
    ativos.push({
      id: 'documento_solicitado_pendente',
      label: 'Há documento(s) solicitado(s) ao cliente aguardando reenvio',
      comoDestravar:
        'Aguarde o cliente reenviar ou cancele as solicitações pendentes no painel de documentos.',
      subEtapa: 'ambas',
    });
  }

  // --- Sub-etapa 1 (documentos) ---
  if (input.haDocPendenteOuReprovado) {
    ativos.push({
      id: 'doc_anexado_pendente_ou_reprovado',
      label: 'Existem documentos anexados ainda pendentes ou reprovados',
      comoDestravar:
        'Aprove ou reprove cada documento listado na etapa "Documentos" antes de avançar.',
      subEtapa: 1,
    });
  }

  // --- Sub-etapa 2 (vistoria/finalização) ---
  if (!input.documentosAprovadosEm) {
    ativos.push({
      id: 'sub_etapa_1_pendente',
      label: 'Sub-etapa 1 (Aprovar Documentos) ainda não foi concluída',
      comoDestravar: 'Finalize a sub-etapa 1 clicando em "Aprovar Documentos".',
      subEtapa: 2,
    });
  }

  if (input.aguardandoExecucao && !input.aprovarApenasDocumentos) {
    ativos.push({
      id: 'aguardando_execucao_vistoria',
      label:
        'Vistoria/instalação ainda não foi executada — aprovação final bloqueada',
      comoDestravar:
        'Verifique se a vistoria do técnico já foi concluída ou se o cliente concluiu a autovistoria enxuta (chassi + motor + vídeo 360°). Se a vistoria parece concluída no link público, há provável dessincronia entre `cotacoes_vistoria_fotos` e `vistorias.video_360_url` — acione o time técnico para investigar o trigger de sync.',
      subEtapa: 2,
    });
  }

  const gatesUniversaisAtivos = ativos.some((g) => g.subEtapa === 'ambas');
  const podeAprovarDocumentos =
    !gatesUniversaisAtivos &&
    !ativos.some((g) => g.subEtapa === 1) &&
    !input.documentosAprovadosEm; // botão sub-etapa 1 só aparece quando ainda não fechou
  const podeAprovarProposta =
    !gatesUniversaisAtivos &&
    !ativos.some((g) => g.subEtapa === 2);

  return { ativos, podeAprovarDocumentos, podeAprovarProposta };
}

/** Filtra gates relevantes para um botão específico (sub-etapa 1 ou 2). */
export function gatesParaBotao(
  gates: GateAprovacao[],
  subEtapa: 1 | 2,
): GateAprovacao[] {
  return gates.filter((g) => g.subEtapa === 'ambas' || g.subEtapa === subEtapa);
}
