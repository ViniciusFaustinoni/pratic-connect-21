-- Adicionar FK de lead_id na tabela cotacoes (correção 4.1.3)
-- Verificar se a constraint já existe antes de criar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_cotacoes_lead_id' 
        AND table_name = 'cotacoes'
    ) THEN
        ALTER TABLE cotacoes 
        ADD CONSTRAINT fk_cotacoes_lead_id 
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
    END IF;
END $$;