-- Backfill: vincular servicos.instalacao_origem_id órfãos à instalacao aberta correspondente
-- e fechar instalacoes cujos servicos correspondentes já estão concluida.

-- 1. Para serviços de instalação sem instalacao_origem_id, amarrar à instalação aberta
--    mais recente do mesmo veículo (status NOT IN concluida, cancelada).
WITH candidatos AS (
  SELECT DISTINCT ON (s.id)
    s.id AS servico_id,
    i.id AS instalacao_id
  FROM public.servicos s
  JOIN public.instalacoes i ON i.veiculo_id = s.veiculo_id
  WHERE s.tipo = 'instalacao'
    AND s.instalacao_origem_id IS NULL
    AND s.created_at > now() - interval '90 days'
    AND i.status NOT IN ('concluida', 'cancelada')
  ORDER BY s.id, i.created_at DESC
)
UPDATE public.servicos s
SET instalacao_origem_id = c.instalacao_id,
    updated_at = now()
FROM candidatos c
WHERE s.id = c.servico_id;

-- 2. Concluir instalacoes cujos servicos correspondentes já estão concluida
--    (mas a instalação ficou aberta por causa do bug do instalacao_origem_id NULL).
UPDATE public.instalacoes i
SET status = 'concluida',
    concluida_em = COALESCE(i.concluida_em, s.concluida_em, now()),
    rastreador_id = COALESCE(i.rastreador_id, s.rastreador_id),
    updated_at = now()
FROM public.servicos s
WHERE s.instalacao_origem_id = i.id
  AND s.tipo = 'instalacao'
  AND s.status = 'concluida'
  AND i.status NOT IN ('concluida', 'cancelada');