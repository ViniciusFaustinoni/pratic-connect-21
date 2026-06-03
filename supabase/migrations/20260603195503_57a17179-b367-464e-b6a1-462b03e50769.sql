UPDATE public.cotacoes
SET status_contratacao = 'pagamento_ok', updated_at = now()
WHERE id = 'a56fa86e-9544-4f78-84c0-25fd829a1fbd'
  AND status_contratacao = 'contrato_assinado';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, dados_anteriores, dados_novos)
VALUES (
  'criar', 'cotacoes', 'cotacoes', 'a56fa86e-9544-4f78-84c0-25fd829a1fbd',
  '[FALHA_LOG_AUDITORIA] [SANEAMENTO_ADESAO_ZERADA] Promoção manual contrato_assinado -> pagamento_ok. COT-20260603-160247087-295 destravada para etapa de agendamento (valor_adesao=0, contrato já assinado/pago, handoff confirmar-adesao-zerada não promoveu status).',
  jsonb_build_object('status_contratacao','contrato_assinado'),
  jsonb_build_object('status_contratacao','pagamento_ok','motivo','adesao_zerada_handoff_falhou','acao_real','atualizar')
);