-- Desativar planos antigos que não devem aparecer na cotação
-- Mantém os registros para histórico, mas não exibe nas novas cotações
UPDATE planos 
SET ativo = false 
WHERE codigo IN ('BASICO', 'TOTAL', 'PREMIUM');