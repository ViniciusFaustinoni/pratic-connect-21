ALTER TABLE benefits DROP CONSTRAINT IF EXISTS benefits_category_check;
ALTER TABLE benefits ADD CONSTRAINT benefits_category_check CHECK (category IN ('cobertura', 'assistencia', 'extra', 'geral'));