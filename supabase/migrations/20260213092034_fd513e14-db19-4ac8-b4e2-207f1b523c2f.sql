
-- Etapa 1: Remover duplicatas existentes, mantendo apenas o mais antigo de cada (sinistro_id, tipo)
DELETE FROM sinistro_documentos 
WHERE id NOT IN (
  SELECT DISTINCT ON (sinistro_id, tipo) id 
  FROM sinistro_documentos 
  ORDER BY sinistro_id, tipo, created_at ASC
);

-- Etapa 2: Criar índice UNIQUE para impedir futuras duplicatas
CREATE UNIQUE INDEX idx_sinistro_documentos_unique_tipo 
ON sinistro_documentos (sinistro_id, tipo);
