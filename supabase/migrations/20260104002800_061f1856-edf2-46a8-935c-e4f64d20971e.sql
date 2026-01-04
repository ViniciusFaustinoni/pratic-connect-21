
-- PARTE 1: Adicionar role de analista_juridico ao enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'analista_juridico';
