
UPDATE servicos
SET status = 'em_analise',
    observacoes = concat(
      '[SANEAMENTO 20/05/2026 KRF8B74] Revertido de status=concluida para em_analise — vistoria de origem 6dc38141 está em_analise (sub-FIPE moto, aguarda decisão Monitoramento). Conclusão prévia era inconsistente e bloqueava realocação. ',
      coalesce(observacoes, '')
    ),
    updated_at = now()
WHERE id = 'bc4507de-c486-41c2-afd1-0abbb9bcce3e'
  AND status = 'concluida';

INSERT INTO logs_auditoria (tabela, registro_id, acao, descricao, dados_novos, created_at)
VALUES (
  'servicos',
  'bc4507de-c486-41c2-afd1-0abbb9bcce3e',
  'editar',
  'SANEAMENTO KRF8B74: serviço revertido de concluida para em_analise para permitir realocação. Vistoria de origem ainda em análise pelo Monitoramento.',
  jsonb_build_object('lote', 'krf8b74-realocar-20260520', 'de', 'concluida', 'para', 'em_analise'),
  now()
);
