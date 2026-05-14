-- Trigger: ao mudar tipo_vistoria de 'autovistoria' para outro valor,
-- apaga as fotos parciais em cotacoes_vistoria_fotos para evitar que
-- o Cadastro confunda fotos abandonadas com vistoria entregue.
CREATE OR REPLACE FUNCTION public.fn_limpar_fotos_autovistoria_abandonada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.tipo_vistoria, '') = 'autovistoria'
     AND COALESCE(NEW.tipo_vistoria, '') <> 'autovistoria' THEN
    DELETE FROM public.cotacoes_vistoria_fotos
    WHERE cotacao_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_cotacoes_limpar_fotos_autovistoria_abandonada ON public.cotacoes;
CREATE TRIGGER tg_cotacoes_limpar_fotos_autovistoria_abandonada
AFTER UPDATE OF tipo_vistoria ON public.cotacoes
FOR EACH ROW
WHEN (OLD.tipo_vistoria IS DISTINCT FROM NEW.tipo_vistoria)
EXECUTE FUNCTION public.fn_limpar_fotos_autovistoria_abandonada();

-- One-shot: limpar fotos órfãs históricas (cotações que NÃO estão mais
-- em modo autovistoria mas ainda têm linhas em cotacoes_vistoria_fotos).
DELETE FROM public.cotacoes_vistoria_fotos f
USING public.cotacoes c
WHERE f.cotacao_id = c.id
  AND COALESCE(c.tipo_vistoria, '') <> 'autovistoria';