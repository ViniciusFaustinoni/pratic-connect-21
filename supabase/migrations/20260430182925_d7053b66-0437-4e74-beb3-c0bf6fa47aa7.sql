ALTER TABLE public.ocr_engine_config ALTER COLUMN pdf_dpi SET DEFAULT 150;
UPDATE public.ocr_engine_config SET pdf_dpi = 150 WHERE pdf_dpi = 144;