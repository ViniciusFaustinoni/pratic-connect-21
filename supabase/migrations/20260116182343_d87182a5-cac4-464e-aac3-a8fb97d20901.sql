-- Adicionar campo valor_adicional para equipamentos/agregados
ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS valor_adicional DECIMAL(10,2) DEFAULT 0;

-- Comentário para documentação
COMMENT ON COLUMN cotacoes.valor_adicional IS 'Valor de equipamentos, acessórios ou agregados somados ao FIPE';