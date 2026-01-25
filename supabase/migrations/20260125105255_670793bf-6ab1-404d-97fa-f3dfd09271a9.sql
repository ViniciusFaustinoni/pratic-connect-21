-- Adicionar novo status 'pendente_vistoria' ao enum status_associado
ALTER TYPE status_associado ADD VALUE IF NOT EXISTS 'pendente_vistoria' AFTER 'em_analise';