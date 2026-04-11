ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS laudo_autentique_id text;
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS laudo_autentique_url text;
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS laudo_assinado boolean DEFAULT false;
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS laudo_assinado_em timestamptz;
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS laudo_pdf_url text;
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS laudo_pdf_assinado_url text;

CREATE INDEX IF NOT EXISTS idx_servicos_laudo_autentique_id ON public.servicos(laudo_autentique_id) WHERE laudo_autentique_id IS NOT NULL;