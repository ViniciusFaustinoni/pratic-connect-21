-- Migrar tipo_entrada 'nova' para 'adesao' (valor padrão para novas adesões)
UPDATE contratos SET tipo_entrada = 'adesao' WHERE tipo_entrada = 'nova' OR tipo_entrada IS NULL;

-- Adicionar comentário com valores válidos
COMMENT ON COLUMN contratos.tipo_entrada IS 'Tipo de operação: adesao, migracao, inclusao, troca_titularidade, reativacao, substituicao_placa';

-- Definir valor padrão para novos registros
ALTER TABLE contratos ALTER COLUMN tipo_entrada SET DEFAULT 'adesao';