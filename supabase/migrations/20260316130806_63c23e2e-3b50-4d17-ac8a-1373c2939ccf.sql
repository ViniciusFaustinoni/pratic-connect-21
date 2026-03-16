-- Add supports_app column to product_lines
ALTER TABLE public.product_lines 
ADD COLUMN supports_app boolean NOT NULL DEFAULT false;

-- Set supports_app = true for lines that support app usage
UPDATE public.product_lines 
SET supports_app = true 
WHERE slug IN ('select', 'select-one', 'lancamento');