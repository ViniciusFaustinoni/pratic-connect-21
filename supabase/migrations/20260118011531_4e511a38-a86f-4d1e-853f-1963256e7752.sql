-- Adicionar colunas de análise na tabela vistorias
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS protocolo VARCHAR(20);
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS observacoes_analise TEXT;
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS ressalvas TEXT;
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS motivo_reprovacao TEXT;
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS analisado_por UUID REFERENCES profiles(id);
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS analisado_em TIMESTAMPTZ;

-- Criar função para gerar protocolo automaticamente
CREATE OR REPLACE FUNCTION generate_vistoria_protocolo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.protocolo IS NULL THEN
    NEW.protocolo := 'VIS-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
      LPAD(COALESCE(
        (SELECT COUNT(*) + 1 FROM vistorias 
         WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW()))::TEXT, '1'), 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para gerar protocolo
DROP TRIGGER IF EXISTS set_vistoria_protocolo ON vistorias;
CREATE TRIGGER set_vistoria_protocolo
  BEFORE INSERT ON vistorias
  FOR EACH ROW
  EXECUTE FUNCTION generate_vistoria_protocolo();