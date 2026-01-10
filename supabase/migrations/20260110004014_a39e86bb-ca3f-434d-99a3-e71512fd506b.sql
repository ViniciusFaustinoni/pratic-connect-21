-- PARTE 1: Adicionar novos valores ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'desenvolvedor';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'admin_master';