-- Adicionar novos valores ao enum tipo_documento para suportar todos os tipos de documentos que o analista pode solicitar
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'selfie_veiculo';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'frente';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'traseira';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'lateral_direita';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'lateral_esquerda';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'odometro';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'chassi';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'motor';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'banco_dianteiro';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'banco_traseiro';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'pneu_dianteiro_direito';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'pneu_dianteiro_esquerdo';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'pneu_traseiro_direito';
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'pneu_traseiro_esquerdo';