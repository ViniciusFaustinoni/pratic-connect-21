-- Correção 7.1.4: Adicionar CHECK constraint na tabela cobrancas para status
-- Primeiro verificar se já existe e remover se necessário
DO $$ 
BEGIN
  -- Tentar adicionar a constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'cobrancas'::regclass 
    AND conname = 'cobrancas_status_check'
  ) THEN
    ALTER TABLE cobrancas 
    ADD CONSTRAINT cobrancas_status_check 
    CHECK (status IN ('aguardando_pagamento', 'pago', 'vencido', 'cancelado', 'estornado'));
  END IF;
END $$;