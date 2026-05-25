UPDATE cotacoes
SET status_contratacao = 'contrato_assinado', updated_at = now()
WHERE id = 'f020bc1a-adb8-4dfb-a690-160ceaea49c4'
  AND status_contratacao = 'ativo';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, dados_anteriores, dados_novos)
VALUES (
  'criar',
  'cotacoes',
  'cotacoes',
  'f020bc1a-adb8-4dfb-a690-160ceaea49c4',
  '[FALHA_LOG_AUDITORIA] [BACKFILL] COT-20260525-141428960-119 (substituicao KOU6D37->LTB4J74) revertida de status_contratacao=ativo para contrato_assinado. Atalho associado.status=ativo removido de recompute_cotacao_status_contratacao + guard trg_guard_cotacao_ativo_exige_caminho_canonico aplicado.',
  jsonb_build_object('status_contratacao','ativo'),
  jsonb_build_object('status_contratacao','contrato_assinado','motivo','patch_recompute_caminho_canonico')
);