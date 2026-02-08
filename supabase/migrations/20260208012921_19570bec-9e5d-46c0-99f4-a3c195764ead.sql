-- Adicionar novo status 'reagendar_manutencao' ao enum status_rastreador
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'reagendar_manutencao' AFTER 'manutencao';