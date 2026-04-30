-- Tabela singleton de configuração de modelo de IA global
CREATE TABLE IF NOT EXISTS public.ai_model_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'lovable' CHECK (provider IN ('lovable','openai','anthropic')),
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_model_config ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado
DROP POLICY IF EXISTS "ai_model_config_select_authenticated" ON public.ai_model_config;
CREATE POLICY "ai_model_config_select_authenticated"
ON public.ai_model_config FOR SELECT
TO authenticated
USING (true);

-- INSERT/UPDATE: somente diretor ou desenvolvedor
DROP POLICY IF EXISTS "ai_model_config_modify_diretor_dev" ON public.ai_model_config;
CREATE POLICY "ai_model_config_modify_diretor_dev"
ON public.ai_model_config FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_ai_model_config_updated_at ON public.ai_model_config;
CREATE TRIGGER trg_ai_model_config_updated_at
BEFORE UPDATE ON public.ai_model_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial (uma única linha global)
INSERT INTO public.ai_model_config (provider, model)
SELECT 'lovable', 'google/gemini-3-flash-preview'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_model_config);