-- Adicionar colunas para rastrear encaixe executado
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS encaixe_executado BOOLEAN DEFAULT FALSE;

ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS data_agendada_original DATE;

COMMENT ON COLUMN servicos.encaixe_executado IS 
  'Indica que este serviço foi antecipado via encaixe (puxado de data futura para hoje)';

COMMENT ON COLUMN servicos.data_agendada_original IS 
  'Data original do agendamento antes do encaixe ser executado';

-- Adicionar também nas tabelas de origem para sincronização
ALTER TABLE instalacoes 
ADD COLUMN IF NOT EXISTS encaixe_executado BOOLEAN DEFAULT FALSE;

ALTER TABLE instalacoes 
ADD COLUMN IF NOT EXISTS data_agendada_original DATE;

ALTER TABLE vistorias 
ADD COLUMN IF NOT EXISTS encaixe_executado BOOLEAN DEFAULT FALSE;

ALTER TABLE vistorias 
ADD COLUMN IF NOT EXISTS data_agendada_original DATE;