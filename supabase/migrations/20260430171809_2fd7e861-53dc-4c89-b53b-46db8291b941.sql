ALTER TABLE public.ocr_engine_config DROP CONSTRAINT IF EXISTS ocr_engine_config_engine_check;
ALTER TABLE public.ocr_engine_config ADD CONSTRAINT ocr_engine_config_engine_check
  CHECK (engine IN ('auto','global','mistral','anthropic','google'));
UPDATE public.ocr_engine_config SET engine = 'auto' WHERE engine = 'global';
ALTER TABLE public.ocr_engine_config ALTER COLUMN engine SET DEFAULT 'auto';