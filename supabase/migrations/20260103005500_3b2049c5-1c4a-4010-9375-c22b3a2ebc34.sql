-- Add 'rascunho' to status_contrato enum
ALTER TYPE status_contrato ADD VALUE IF NOT EXISTS 'rascunho' BEFORE 'pendente';