-- Garante que cada vistoria tenha no máximo 1 foto por tipo (permite upsert)
ALTER TABLE public.vistoria_fotos
DROP CONSTRAINT IF EXISTS vistoria_fotos_vistoria_id_tipo_unique;

ALTER TABLE public.vistoria_fotos
ADD CONSTRAINT vistoria_fotos_vistoria_id_tipo_unique UNIQUE (vistoria_id, tipo);