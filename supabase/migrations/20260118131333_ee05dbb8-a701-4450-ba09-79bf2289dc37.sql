-- Adicionar campos extras para melhor gestão de plataformas
ALTER TABLE rastreadores_config_plataformas 
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icone VARCHAR(50) DEFAULT 'server';

-- Atualizar plataformas existentes com descrições
UPDATE rastreadores_config_plataformas 
SET descricao = 'Plataforma Rede Veículos para rastreamento veicular', icone = 'satellite', ordem = 1
WHERE plataforma = 'rede_veiculos';

UPDATE rastreadores_config_plataformas 
SET descricao = 'Plataforma Softruck para gestão de frotas', icone = 'truck', ordem = 2
WHERE plataforma = 'softruck';

-- Criar índice para ordenação
CREATE INDEX IF NOT EXISTS idx_rastreadores_config_plataformas_ordem 
ON rastreadores_config_plataformas(ordem, nome_exibicao);