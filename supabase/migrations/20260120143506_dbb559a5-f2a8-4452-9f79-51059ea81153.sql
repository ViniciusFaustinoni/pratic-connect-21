-- 1. Remover constraint antiga de status
ALTER TABLE asaas_cobrancas DROP CONSTRAINT IF EXISTS asaas_cobrancas_status_check;

-- 2. Adicionar nova constraint com CANCELLED incluído
ALTER TABLE asaas_cobrancas ADD CONSTRAINT asaas_cobrancas_status_check 
CHECK (status IN (
  'PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 
  'REFUNDED', 'RECEIVED_IN_CASH', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS',
  'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL',
  'DUNNING_REQUESTED', 'DUNNING_RECEIVED', 'AWAITING_RISK_ANALYSIS',
  'CANCELLED' -- Adicionado para permitir cancelamento
));

-- 3. Marcar cobranças duplicadas como canceladas (manter a paga/mais antiga)
WITH duplicatas AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY contrato_id, tipo 
           ORDER BY 
             CASE WHEN status = 'RECEIVED' THEN 0 ELSE 1 END,
             created_at ASC
         ) as rn
  FROM asaas_cobrancas
  WHERE contrato_id IS NOT NULL 
    AND status NOT IN ('CANCELLED', 'REFUNDED', 'REFUND_REQUESTED')
)
UPDATE asaas_cobrancas 
SET status = 'CANCELLED',
    motivo_cancelamento = 'Cancelado automaticamente - cobrança duplicada',
    updated_at = now()
WHERE id IN (SELECT id FROM duplicatas WHERE rn > 1);

-- 4. Criar índice único parcial para prevenir futuras duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_cobranca_ativa_por_contrato 
ON asaas_cobrancas (contrato_id, tipo)
WHERE contrato_id IS NOT NULL 
  AND status NOT IN ('CANCELLED', 'REFUNDED', 'REFUND_REQUESTED');