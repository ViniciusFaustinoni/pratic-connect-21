-- Adicionar coluna portador_id na tabela rastreadores
ALTER TABLE rastreadores
ADD COLUMN portador_id UUID REFERENCES profiles(id);

-- Criar índice para performance
CREATE INDEX idx_rastreadores_portador_id ON rastreadores(portador_id);

-- Comentário para documentação
COMMENT ON COLUMN rastreadores.portador_id IS 'ID do profissional responsável/portador do rastreador em estoque';