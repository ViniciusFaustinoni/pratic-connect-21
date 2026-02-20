-- Corrigir status do sinistro que tem vistoria concluída mas status não avançou
UPDATE sinistros 
SET status = 'aguardando_analise', updated_at = NOW()
WHERE id = 'd089ab74-a18a-462d-93ec-fad83f305f2a'
  AND status = 'comunicado';

-- Registrar a transição no histórico
INSERT INTO sinistro_historico (sinistro_id, status_anterior, status_novo, observacao)
VALUES (
  'd089ab74-a18a-462d-93ec-fad83f305f2a',
  'comunicado',
  'aguardando_analise',
  'Status corrigido automaticamente: vistoria do regulador foi concluída sem atualização do status do sinistro.'
);