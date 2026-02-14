
-- 1. Add marcas_atendidas to oficinas
ALTER TABLE public.oficinas ADD COLUMN IF NOT EXISTS marcas_atendidas text[] DEFAULT '{}';

-- 2. Expand auto_centers with full business fields
ALTER TABLE public.auto_centers
  ADD COLUMN IF NOT EXISTS razao_social varchar,
  ADD COLUMN IF NOT EXISTS nome_fantasia varchar,
  ADD COLUMN IF NOT EXISTS cnpj varchar,
  ADD COLUMN IF NOT EXISTS whatsapp varchar,
  ADD COLUMN IF NOT EXISTS telefone2 varchar,
  ADD COLUMN IF NOT EXISTS logradouro varchar,
  ADD COLUMN IF NOT EXISTS numero varchar,
  ADD COLUMN IF NOT EXISTS complemento varchar,
  ADD COLUMN IF NOT EXISTS bairro varchar,
  ADD COLUMN IF NOT EXISTS banco varchar,
  ADD COLUMN IF NOT EXISTS agencia varchar,
  ADD COLUMN IF NOT EXISTS conta varchar,
  ADD COLUMN IF NOT EXISTS pix_chave varchar,
  ADD COLUMN IF NOT EXISTS pix_tipo varchar,
  ADD COLUMN IF NOT EXISTS especialidades text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS marcas_atendidas text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status varchar DEFAULT 'ativo';

-- 3. Create prestadores_evento table
CREATE TABLE IF NOT EXISTS public.prestadores_evento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social varchar NOT NULL,
  nome_fantasia varchar,
  cnpj varchar,
  telefone varchar,
  whatsapp varchar,
  email varchar,
  logradouro varchar,
  numero varchar,
  complemento varchar,
  bairro varchar,
  cidade varchar,
  estado varchar,
  cep varchar,
  banco varchar,
  agencia varchar,
  conta varchar,
  pix_chave varchar,
  pix_tipo varchar,
  especialidades text[] DEFAULT '{}',
  marcas_atendidas text[] DEFAULT '{}',
  observacoes text,
  status varchar DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prestadores_evento ENABLE ROW LEVEL SECURITY;

-- RLS policies for prestadores_evento (same pattern as oficinas)
CREATE POLICY "Authenticated users can view prestadores_evento"
  ON public.prestadores_evento FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert prestadores_evento"
  ON public.prestadores_evento FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update prestadores_evento"
  ON public.prestadores_evento FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete prestadores_evento"
  ON public.prestadores_evento FOR DELETE
  USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_prestadores_evento_updated_at
  BEFORE UPDATE ON public.prestadores_evento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
