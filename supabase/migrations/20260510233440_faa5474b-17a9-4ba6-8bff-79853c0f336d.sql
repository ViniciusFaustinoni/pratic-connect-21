-- Backfill: preencher coluna tipo_entrada quando só existe em dados_extras
UPDATE public.cotacoes
SET tipo_entrada = dados_extras->>'tipo_entrada'
WHERE tipo_entrada IS NULL
  AND dados_extras ? 'tipo_entrada'
  AND (dados_extras->>'tipo_entrada') IS NOT NULL
  AND (dados_extras->>'tipo_entrada') <> '';

-- Trigger para manter sincronia em INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.fn_sync_cotacao_tipo_entrada()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_entrada IS NULL
     AND NEW.dados_extras IS NOT NULL
     AND NEW.dados_extras ? 'tipo_entrada'
     AND COALESCE(NEW.dados_extras->>'tipo_entrada', '') <> '' THEN
    NEW.tipo_entrada := NEW.dados_extras->>'tipo_entrada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cotacao_tipo_entrada ON public.cotacoes;
CREATE TRIGGER trg_sync_cotacao_tipo_entrada
BEFORE INSERT OR UPDATE OF dados_extras, tipo_entrada
ON public.cotacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_cotacao_tipo_entrada();