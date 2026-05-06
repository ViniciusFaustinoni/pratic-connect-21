-- Fase 4.1: RPC cacheável para configurações
CREATE OR REPLACE FUNCTION public.get_app_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(chave, valor), '{}'::jsonb)
  FROM public.configuracoes;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_config() TO anon, authenticated;

-- Fase 4.2: Índice composto para filtro de cotações por vendedor + status
CREATE INDEX IF NOT EXISTS idx_cotacoes_status_vendedor
  ON public.cotacoes(status, vendedor_id);
