-- Adicionar 'recusado' ao enum status_associado
ALTER TYPE status_associado ADD VALUE IF NOT EXISTS 'recusado' AFTER 'bloqueado';