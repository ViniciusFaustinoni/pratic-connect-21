INSERT INTO public.associados_historico
  (associado_id, tipo, descricao, dados_novos, created_at)
VALUES
  (
    '05a31afc-77d9-4456-938d-190710394f94',
    'troca_titularidade_saida',
    'Veículo transferido para VInicius Faustinoni por troca de titularidade. [Backfill em 23/05/2026 — evento original em 22/05/2026 23:38, recuperado após correção do CHECK constraint que silenciava INSERTs deste tipo]',
    jsonb_build_object(
      'novo_associado_id','d71b1327-774b-47f0-bfab-af96d9e01246',
      'solicitacao_id','87b49126-16cb-4052-900c-bd6bb16f1ed0',
      'backfill', true,
      'backfill_em', now()
    ),
    '2026-05-23 02:38:10.313+00'::timestamptz
  ),
  (
    'd71b1327-774b-47f0-bfab-af96d9e01246',
    'troca_titularidade_entrada',
    'Veículo recebido de MARCOS VINICIUS DATIVO MACHADO por troca de titularidade. [Backfill em 23/05/2026 — evento original em 22/05/2026 23:38, recuperado após correção do CHECK constraint que silenciava INSERTs deste tipo]',
    jsonb_build_object(
      'associado_anterior_id','05a31afc-77d9-4456-938d-190710394f94',
      'solicitacao_id','87b49126-16cb-4052-900c-bd6bb16f1ed0',
      'backfill', true,
      'backfill_em', now()
    ),
    '2026-05-23 02:38:10.313+00'::timestamptz
  );

INSERT INTO public.logs_auditoria
  (acao, modulo, descricao, dados_novos)
VALUES (
  'criar',
  'solicitacoes',
  '[BACKFILL_HISTORICO_TROCA] Backfill manual dos eventos troca_titularidade_saida/entrada da solicitação 87b49126 (perdidos por CHECK constraint restritivo na época da efetivação 22/05/2026 23:38).',
  jsonb_build_object(
    'tipo_operacao','backfill_historico_troca',
    'solicitacao_id','87b49126-16cb-4052-900c-bd6bb16f1ed0',
    'associado_antigo_id','05a31afc-77d9-4456-938d-190710394f94',
    'novo_associado_id','d71b1327-774b-47f0-bfab-af96d9e01246',
    'efetivada_em','2026-05-23 02:38:10.313+00',
    'eventos_inseridos', 2
  )
);