UPDATE error_reports
SET status = 'concluido',
    concluido_em = now(),
    observacao_diretor = COALESCE(observacao_diretor, '') ||
      E'\n[2026-04-27] Correção raiz do OCR: unpdf + retry no gateway + timeout no front. Pronto para testar.',
    updated_at = now()
WHERE status IN ('aberto','em_tratamento')
  AND (descricao ILIKE '%ocr%' OR descricao ILIKE '%leitura de documento%'
       OR descricao ILIKE '%trava%documento%' OR descricao ILIKE '%comprovante%resid%');