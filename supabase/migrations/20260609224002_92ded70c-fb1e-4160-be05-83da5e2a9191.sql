-- Limpa contratos presos no status legado 'biometric_review' (heurística temporal removida)
UPDATE contratos SET autentique_status='pending' WHERE autentique_status='biometric_review';
-- Remove notificações órfãs do tipo que não será mais gerado
DELETE FROM notificacoes WHERE tipo='contrato_biometria_revisao' AND lida=false;