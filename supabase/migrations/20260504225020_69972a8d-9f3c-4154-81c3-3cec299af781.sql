
UPDATE public.contratos
SET aprovado_em = now(),
    observacao_aprovacao = COALESCE(observacao_aprovacao, '') || ' | Backfill inclusão JOAO VICTOR (RKL6I08) — aprovação automática para criar instalação',
    updated_at = now()
WHERE id = 'ae3e0ac3-0506-4998-a4d5-bd270b70eabc' AND aprovado_em IS NULL;
