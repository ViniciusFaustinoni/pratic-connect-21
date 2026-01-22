-- Adicionar campo permite_encaixe na tabela cotacoes
ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS vistoria_permite_encaixe BOOLEAN DEFAULT false;

COMMENT ON COLUMN cotacoes.vistoria_permite_encaixe IS 
  'Se o cliente permite encaixe de horários antes do agendado';