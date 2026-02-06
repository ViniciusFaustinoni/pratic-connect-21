-- Corrigir dados da cotação f7091946-4f10-423b-bc96-93520ed045ad que foi recusada mas não atualizou corretamente

-- 1. Atualizar veículo para status 'recusado'
UPDATE veiculos 
SET status = 'recusado'
WHERE id = 'fb787624-7ecd-4675-8842-bfee409add85' 
  AND status = 'suspenso';

-- 2. Atualizar associado para status 'suspenso'
UPDATE associados 
SET status = 'suspenso'
WHERE id = '41d1ac0b-fccf-4803-961a-295acb83980c' 
  AND status = 'pendente_vistoria';

-- 3. Atualizar vistoria para status 'reprovada'
UPDATE vistorias 
SET status = 'reprovada',
    observacoes = 'Condições precárias do veículo: mkkll'
WHERE id = 'd9a1c85b-01bd-47c8-9548-b7a148ed301f' 
  AND status = 'em_analise';

-- 4. Atualizar contrato para status 'cancelado'
UPDATE contratos 
SET status = 'cancelado'
WHERE id = '0ebed2dc-4965-4ef9-8fc9-39ab8d53fae5' 
  AND status = 'assinado';

-- 5. Atualizar cotação para status_contratacao 'veiculo_recusado'
UPDATE cotacoes 
SET status_contratacao = 'veiculo_recusado'
WHERE id = 'f7091946-4f10-423b-bc96-93520ed045ad' 
  AND status_contratacao = 'pagamento_ok';

-- 6. Inserir na blacklist se não existir
INSERT INTO blacklist_veiculos (placa, chassi, motivo, justificativa, tipo_reprovacao, veiculo_id, associado_id, vistoria_id, ativo)
SELECT 
  'LTB4J74',
  '9BRBD48E6E2617010',
  'Condições precárias do veículo',
  'Veículo recusado pelo técnico: Condições precárias do veículo: mkkll',
  'vistoria_reprovada',
  'fb787624-7ecd-4675-8842-bfee409add85',
  '41d1ac0b-fccf-4803-961a-295acb83980c',
  'd9a1c85b-01bd-47c8-9548-b7a148ed301f',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM blacklist_veiculos 
  WHERE placa = 'LTB4J74' AND ativo = true
);