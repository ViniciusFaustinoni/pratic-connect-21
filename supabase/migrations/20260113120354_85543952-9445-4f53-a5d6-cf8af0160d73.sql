-- Criar histórico retroativo para leads que não possuem nenhum registro
INSERT INTO leads_historico (lead_id, acao, descricao, created_at)
SELECT 
  l.id,
  'criou_lead',
  'Lead "' || l.nome || '" criado (histórico retroativo)',
  l.created_at
FROM leads l
WHERE NOT EXISTS (
  SELECT 1 FROM leads_historico lh 
  WHERE lh.lead_id = l.id
);