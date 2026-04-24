-- Normalizar strings vazias para NULL (NULL não conflita em índice único)
UPDATE public.cobrancas
SET nosso_numero = NULL
WHERE nosso_numero = '';

-- Remover índice parcial antigo (não pode ser referenciado por ON CONFLICT sem o WHERE)
DROP INDEX IF EXISTS public.cobrancas_nosso_numero_uniq;

-- Criar índice único total (NULLs são distintos por padrão no Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_nosso_numero_uniq
  ON public.cobrancas (nosso_numero);