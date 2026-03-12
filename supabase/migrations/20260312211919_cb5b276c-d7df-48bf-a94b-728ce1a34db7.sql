
-- Hotfix: Fix Marcus Vinicius cotação pointer and status
UPDATE cotacoes 
SET contrato_gerado_id = '6f48a326-2814-457e-8218-91e6e9490f52',
    status_contratacao = 'contrato_assinado'
WHERE id = 'ae30f9d8-d03a-4ff2-befe-642917ff122c';

-- Add unique partial index to prevent duplicate active contracts per cotação
-- Only allows one non-cancelled contract per cotação
CREATE UNIQUE INDEX IF NOT EXISTS idx_contratos_cotacao_id_ativo 
ON contratos (cotacao_id) 
WHERE status NOT IN ('cancelado'::status_contrato, 'expirado'::status_contrato);
