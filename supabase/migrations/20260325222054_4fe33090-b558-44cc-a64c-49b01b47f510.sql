-- Add visual columns to coberturas table (previously only in main_coverages)
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE coberturas ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;