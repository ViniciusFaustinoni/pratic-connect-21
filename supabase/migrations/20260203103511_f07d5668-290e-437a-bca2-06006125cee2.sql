-- Adicionar campos para persistir dados do CRLV extraídos via OCR
ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS veiculo_chassi VARCHAR(17),
ADD COLUMN IF NOT EXISTS veiculo_renavam VARCHAR(11);

COMMENT ON COLUMN cotacoes.veiculo_chassi IS 'Chassi extraído do CRLV via OCR';
COMMENT ON COLUMN cotacoes.veiculo_renavam IS 'Renavam extraído do CRLV via OCR';