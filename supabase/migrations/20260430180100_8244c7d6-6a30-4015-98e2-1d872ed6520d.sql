-- Reduz DPI default da rasterização de PDF de 200 para 144.
-- 200dpi gera PNGs de ~15MB que estouram o limite de 5MB/imagem do Anthropic.
-- 144dpi mantém legibilidade para OCR e gera ~1.5MB JPEG após compressão.
ALTER TABLE public.ocr_engine_config ALTER COLUMN pdf_dpi SET DEFAULT 144;
UPDATE public.ocr_engine_config SET pdf_dpi = 144 WHERE pdf_dpi >= 200;