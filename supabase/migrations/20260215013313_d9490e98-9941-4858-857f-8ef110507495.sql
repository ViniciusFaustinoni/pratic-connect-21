-- Gap 2: Campo alerta_inadimplente na tabela sinistros
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS alerta_inadimplente boolean DEFAULT false;

-- Gap 3: Campo fluxo_simplificado na tabela sinistros
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS fluxo_simplificado boolean DEFAULT false;