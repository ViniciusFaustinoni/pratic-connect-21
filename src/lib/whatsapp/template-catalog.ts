/**
 * Catálogo de templates WhatsApp Meta — fonte única de verdade sobre
 * "qual template é enviado em qual momento".
 *
 * Usado pela tela `Configurações › Integrações › WhatsApp › Templates Meta`
 * para mostrar tooltip explicativo em cada linha da tabela.
 *
 * Mantenha sincronizado quando criar/renomear templates ou mudar gatilhos.
 */

export interface TemplateCatalogEntry {
  /** Em qual momento do fluxo o template é disparado (linguagem de negócio) */
  momento: string;
  /** Edge function ou cron responsável pelo envio */
  gatilho: string;
  /** Variáveis esperadas, na ordem dos {{N}} do corpo */
  variaveis: string[];
  /** true quando substituído por uma versão mais nova (não usar em código novo) */
  deprecated?: string;
}

export const TEMPLATE_CATALOG: Record<string, TemplateCatalogEntry> = {
  // ── Cadastro / Vendas ───────────────────────────────────────────────
  cadastro_aprovado_botao: {
    momento: 'Após aprovação do cadastro do associado, antes de iniciar instalação/vistoria',
    gatilho: 'notificar-cliente · efetivar-troca-titularidade',
    variaveis: ['nome', 'placa', 'modelo', 'cidade', 'link'],
  },
  boas_vindas_agencia_v1: {
    momento: 'Quando uma nova agência é cadastrada como vendedor',
    gatilho: 'create-user',
    variaveis: ['nome_agencia'],
  },
  documentacao_pendente: {
    momento: 'Quando faltam documentos do associado para liberar a aprovação',
    gatilho: 'notificar-cliente',
    variaveis: ['nome', 'lista_documentos'],
  },

  // ── Agendamento de instalação / vistoria ────────────────────────────
  confirmacao_agendamento_v1: {
    momento: 'Logo após criar o agendamento de instalação ou vistoria',
    gatilho: 'agendar-vistoria-completa · criar-instalacao-pos-pagamento · solicitar-encaixe · atribuir-proxima-tarefa',
    variaveis: ['nome', 'tipo_servico', 'periodo'],
  },
  confirmacao_vespera_v1: {
    momento: 'Véspera do agendamento (D-1) pedindo confirmação do cliente',
    gatilho: 'enviar-confirmacao-manual · confirmar-vistorias-manha-cron',
    variaveis: ['nome', 'tipo_servico', 'data_hora'],
  },
  confirmacao_manha_v1: {
    momento: 'Manhã do dia agendado pedindo confirmação final',
    gatilho: 'confirmar-vistorias-manha-cron',
    variaveis: ['nome', 'tipo_servico', 'horario'],
  },
  reagendamento_servico: {
    momento: 'Quando cliente não confirma e precisa reagendar',
    gatilho: 'enviar-link-reagendamento · cron-followup-reagendamento',
    variaveis: ['nome', 'tipo_servico'],
  },

  // ── Execução do serviço de campo ────────────────────────────────────
  servico_atribuido_v1: {
    momento: 'Quando uma tarefa é atribuída ao técnico/vistoriador',
    gatilho: 'cron-atribuir-tarefas · notificar-inicio-rota',
    variaveis: ['tecnico', 'tipo_servico', 'cliente'],
  },
  tarefa_vistoriador_v2: {
    momento: 'Quando vistoriador externo recebe nova tarefa via link',
    gatilho: 'gerar-link-vistoriador-prestador',
    variaveis: ['vistoriador', 'cliente', 'endereco', 'data'],
  },
  prestador_nova_instalacao_v2: {
    momento: 'Quando prestador externo recebe nova instalação via link',
    gatilho: 'gerar-link-prestador',
    variaveis: ['prestador', 'cliente', 'cidade', 'endereco', 'data', 'link'],
  },
  tecnico_a_caminho_1: {
    momento: 'Quando o técnico inicia rota até o cliente',
    gatilho: 'notificar-cliente (etapa "tecnico_a_caminho")',
    variaveis: ['nome', 'funcao', 'telefone1', 'telefone2', 'endereco', 'periodo'],
  },

  // ── Coberturas ativadas (pós-instalação) ─────────────────────────────
  cobertura_360_ativada_v3: {
    momento: 'Após aprovação final da instalação — Plano 360',
    gatilho: 'notificar-cliente',
    variaveis: ['nome', 'placa', 'modelo', 'plano'],
  },
  cobertura_total_ativada: {
    momento: 'Após aprovação final da instalação — Plano Total',
    gatilho: 'notificar-cliente',
    variaveis: ['nome', 'placa', 'modelo'],
  },
  cobertura_360_ativada: {
    momento: 'Versão antiga — substituída por cobertura_360_ativada_v3',
    gatilho: '(legado)',
    variaveis: ['nome', 'placa', 'modelo'],
    deprecated: 'Use cobertura_360_ativada_v3',
  },

  // ── Cobrança ────────────────────────────────────────────────────────
  cobranca_mensalidade: {
    momento: 'Geração mensal de boletos (envio padrão SGA)',
    gatilho: 'gerar-cobrancas-mensais · gerar-faturas-mensais · disparar-boletos-lote · enviar-lembretes-vencimento',
    variaveis: ['nome', 'mes_ano', 'vencimento'],
  },
  emissao_boleto_gerado_v2: {
    momento: 'Quando um boleto avulso é emitido com linha digitável',
    gatilho: 'asaas-cobrancas · executar-regua-cobranca',
    variaveis: ['nome', 'modelo', 'placa', 'vencimento', 'valor', 'linha_digitavel'],
  },
  cobranca_inadimplencia_pratic: {
    momento: 'Importação de CSV SGA — agrupa boletos vencidos por matrícula',
    gatilho: 'disparar-cobranca-csv-meta',
    variaveis: ['nome', 'lista_boletos'],
  },
  d_6_lembrete_desconto_v1: {
    momento: 'D-6 do vencimento — lembrete com desconto',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome', 'vencimento', 'linha_digitavel'],
  },
  d0_boleto_vence_hoje_v1: {
    momento: 'D-0 — boleto vence hoje',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome', 'valor', 'vencimento', 'modelo', 'placa', 'linha_digitavel'],
  },
  d1_a_d4_boleto_vencido_v1: {
    momento: 'D+1 a D+4 — boleto vencido (cobrança leve)',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome', 'vencimento'],
  },
  d5_ultimo_dia_sem_revistoria_v1: {
    momento: 'D+5 — alerta de início de processo de revistoria',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['vencimento'],
  },
  d6_impedimento_pagamento_v1: {
    momento: 'D+6 — pergunta motivo do não pagamento',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome', 'vencimento', 'valor', 'placa'],
  },
  d7_reforco_contato_v1: {
    momento: 'D+7 — reforço de contato',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome', 'vencimento'],
  },
  d8_urgencia_revistoria_v1: {
    momento: 'D+8 — urgência de revistoria',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome'],
  },
  d9_alerta_retirada_v1: {
    momento: 'D+9 — alerta de retirada de rastreador',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome', 'vencimento'],
  },
  d10_ultima_tentativa_v1: {
    momento: 'D+10 — última tentativa antes da negativação',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome'],
  },
  d11_aviso_negativacao_v1: {
    momento: 'D+11 — aviso de negativação iminente',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome', 'vencimento', 'valor', 'placa'],
  },
  d12_debito_com_multa_v1: {
    momento: 'D+12 — débito com multa aplicada',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome', 'vencimento', 'valor', 'placa'],
  },
  d13_regularize_cadastro_v1: {
    momento: 'D+13 — pedido de regularização cadastral',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome', 'vencimento'],
  },
  d14_d61_reativacao_protecao_v1: {
    momento: 'D+14 a D+61 — convite para reativar a proteção',
    gatilho: 'executar-regua-cobranca',
    variaveis: ['nome'],
  },

  // ── Sinistros ───────────────────────────────────────────────────────
  sinistro_aberto: {
    momento: 'Abertura de novo sinistro pelo associado',
    gatilho: 'criar-chamado-assistencia',
    variaveis: ['nome', 'protocolo'],
  },
  sinistro_atualizado: {
    momento: 'Atualização de status do sinistro (genérico, usado em vários fluxos)',
    gatilho: 'aprovar-sinistro · reprovar-sinistro · autentique-webhook · cron-contato-sinistro · enviar-documento-sinistro · processar-termo-evento · etc.',
    variaveis: ['nome', 'protocolo', 'status'],
  },
  comunicacao_sinistro: {
    momento: 'Comunicação detalhada do andamento do sinistro com valores',
    gatilho: 'aprovar-solicitacao-ia · cron-contato-sinistro',
    variaveis: ['nome', 'tipo_sinistro', 'protocolo', 'plano', 'desagio', 'fipe', 'valor_pago', 'link'],
  },
  orcamento_oficina: {
    momento: 'Quando oficina envia orçamento para análise',
    gatilho: 'enviar-cotacao-pecas',
    variaveis: ['oficina', 'modelo_ano', 'placa', 'descricao'],
  },

  // ── Reboque / Assistência ───────────────────────────────────────────
  despacho_reboque_novo: {
    momento: 'Reboque acionado para novo chamado',
    gatilho: 'despacho-reboque-disparar',
    variaveis: ['veiculo', 'placa', 'endereco', 'data_hora', 'link'],
  },
  reboque_a_caminho: {
    momento: 'Reboquista atribuído e a caminho do local',
    gatilho: 'despacho-reboque-atribuir',
    variaveis: ['reboquista', 'distancia', 'eta', 'link', 'telefone'],
  },
  reboque_chegou_local: {
    momento: 'Reboquista chegou no local do sinistro',
    gatilho: 'despacho-reboque-status',
    variaveis: ['reboquista', 'link'],
  },
  reboque_veiculo_carregado: {
    momento: 'Veículo carregado no guincho, a caminho do destino',
    gatilho: 'despacho-reboque-status',
    variaveis: ['reboquista', 'placa', 'destino', 'link'],
  },
  reboque_entregue: {
    momento: 'Veículo entregue no destino',
    gatilho: 'despacho-reboque-status',
    variaveis: ['destino', 'horario'],
  },
  assistencia_confirmada: {
    momento: 'Confirmação de chamado de assistência 24h',
    gatilho: 'notificar-cliente',
    variaveis: ['nome', 'prestador', 'eta_min'],
  },

  // ── Assinatura de documentos (Autentique) ───────────────────────────
  assinatura_documento_v2: {
    momento: 'Envio de qualquer documento para assinatura via Autentique (genérico)',
    gatilho: 'enviar-termo-cancelamento-substituicao · autentique-create',
    variaveis: ['nome', 'documento'],
  },
  assinatura_instalacao_v1: {
    momento: 'Termo de instalação pronto para assinatura',
    gatilho: 'autentique-create (instalação)',
    variaveis: ['nome', 'veiculo'],
  },
  termo_filiacao_assinatura_v2: {
    momento: 'Termo de filiação pronto para assinatura',
    gatilho: 'enviar-termo-filiacao-whatsapp',
    variaveis: ['nome', 'veiculo', 'protocolo'],
  },

  // ── Diretoria / Aprovações ──────────────────────────────────────────
  autorizacao_fipe_diretoria_v4: {
    momento: 'Solicitação de autorização da diretoria para FIPE acima do limite',
    gatilho: 'notificar-diretoria-fipe',
    variaveis: ['diretor', 'modelo', 'ano', 'placa', 'fipe', 'valor_pago', 'solicitante'],
  },
  autorizacao_fipe_diretoria: {
    momento: 'Versão antiga — substituída por autorizacao_fipe_diretoria_v4',
    gatilho: '(legado)',
    variaveis: [],
    deprecated: 'Use autorizacao_fipe_diretoria_v4',
  },

  // ── Suspensão / Cobertura ───────────────────────────────────────────
  suspensao_cobertura_nao_instalacao_v1: {
    momento: '48h sem instalação do rastreador — suspensão automática da cobertura',
    gatilho: 'cron-expirar-confirmacoes',
    variaveis: ['nome', 'placa', 'horas'],
  },

  // ── Notificação genérica (fallback) ─────────────────────────────────
  notificacao_geral_v1: {
    momento: 'Notificação genérica usada quando não existe template específico para o evento',
    gatilho: 'notificar-cliente · confirmar-retirada · concluir-instalacao-prestador · concluir-vistoria-prestador · cron-expirar-confirmacoes · notificar-manutencao-whatsapp · asaas-webhook',
    variaveis: ['nome', 'mensagem'],
  },

  // ── Troca de titularidade ───────────────────────────────────────────
  troca_titularidade_solicitada: {
    momento: 'Quando uma troca de titularidade é solicitada',
    gatilho: 'fluxo-troca-titularidade',
    variaveis: ['nome', 'veiculo'],
  },
  troca_titularidade_aprovada: {
    momento: 'Quando a troca de titularidade é aprovada',
    gatilho: 'aprovar-troca-cadastro',
    variaveis: ['nome', 'veiculo'],
  },
  troca_titularidade_reprovada: {
    momento: 'Quando a troca de titularidade é reprovada',
    gatilho: 'fluxo-troca-titularidade',
    variaveis: ['nome', 'veiculo', 'motivo'],
  },
  troca_titularidade_termo_pendente: {
    momento: 'Quando termo de troca aguarda assinatura',
    gatilho: 'efetivar-troca-titularidade',
    variaveis: ['nome', 'veiculo'],
  },
};

export function getCatalogEntry(nome: string): TemplateCatalogEntry | null {
  return TEMPLATE_CATALOG[nome] ?? null;
}
