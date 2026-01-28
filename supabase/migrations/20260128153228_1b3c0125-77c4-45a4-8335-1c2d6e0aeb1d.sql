-- Adicionar colunas faltantes para elogios e registro manual
ALTER TABLE ouvidoria_manifestacoes
ADD COLUMN IF NOT EXISTS setor_elogio VARCHAR(50),
ADD COLUMN IF NOT EXISTS colaborador_elogiado VARCHAR(255),
ADD COLUMN IF NOT EXISTS data_atendimento DATE,
ADD COLUMN IF NOT EXISTS data_contato TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS registrado_por_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS registrado_por_nome VARCHAR(255),
ADD COLUMN IF NOT EXISTS observacao_interna TEXT;

-- Criar função para gerar protocolo automático
CREATE OR REPLACE FUNCTION generate_ouvidoria_protocolo()
RETURNS TRIGGER AS $$
DECLARE
  ano_atual TEXT;
  proximo_seq INTEGER;
BEGIN
  ano_atual := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(protocolo FROM 10) AS INTEGER)), 0) + 1
  INTO proximo_seq
  FROM ouvidoria_manifestacoes
  WHERE protocolo LIKE 'OUV-' || ano_atual || '-%';
  
  NEW.protocolo := 'OUV-' || ano_atual || '-' || LPAD(proximo_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para gerar protocolo automaticamente
DROP TRIGGER IF EXISTS trigger_generate_ouvidoria_protocolo ON ouvidoria_manifestacoes;
CREATE TRIGGER trigger_generate_ouvidoria_protocolo
BEFORE INSERT ON ouvidoria_manifestacoes
FOR EACH ROW
WHEN (NEW.protocolo IS NULL OR NEW.protocolo = '')
EXECUTE FUNCTION generate_ouvidoria_protocolo();