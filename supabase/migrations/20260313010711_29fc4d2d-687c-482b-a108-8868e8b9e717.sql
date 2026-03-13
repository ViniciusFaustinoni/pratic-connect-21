
-- Fix stuck imprevisto records: set status to nao_compareceu where duplo_check was confirmed but status is wrong
UPDATE servicos 
SET status = 'nao_compareceu', updated_at = NOW() 
WHERE imprevisto_duplo_check = true 
  AND status NOT IN ('nao_compareceu', 'reagendada', 'cancelada');
