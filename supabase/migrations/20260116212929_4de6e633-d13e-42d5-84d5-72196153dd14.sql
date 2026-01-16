-- Adicionar coluna de perfis permitidos na tabela de templates
ALTER TABLE documento_templates 
ADD COLUMN IF NOT EXISTS perfis_permitidos TEXT[] DEFAULT ARRAY['diretor', 'gerente_comercial'];

-- Comentário para documentação
COMMENT ON COLUMN documento_templates.perfis_permitidos IS 'Lista de perfis que podem editar este template específico';