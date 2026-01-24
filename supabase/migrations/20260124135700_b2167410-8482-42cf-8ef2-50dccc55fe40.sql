-- Adicionar valor 'laudo_vistoria' ao enum tipo_documento para permitir salvar PDFs de laudo
ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'laudo_vistoria';