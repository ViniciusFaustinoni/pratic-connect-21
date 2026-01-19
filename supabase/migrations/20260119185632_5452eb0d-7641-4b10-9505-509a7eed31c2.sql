-- Sincronizar vistorias de cotações que têm vistoria_rota_id mas vistorias.rota_id é NULL
UPDATE vistorias v
SET 
  rota_id = c.vistoria_rota_id,
  vistoriador_id = COALESCE(v.vistoriador_id, r.instalador_id)
FROM cotacoes c
LEFT JOIN rotas r ON r.id = c.vistoria_rota_id
WHERE v.cotacao_id = c.id
  AND c.vistoria_rota_id IS NOT NULL
  AND v.rota_id IS NULL;

-- Sincronizar vistorias de contratos que têm vistoria_rota_id mas vistorias.rota_id é NULL
UPDATE vistorias v
SET 
  rota_id = ct.vistoria_rota_id,
  vistoriador_id = COALESCE(v.vistoriador_id, r.instalador_id)
FROM contratos ct
LEFT JOIN rotas r ON r.id = ct.vistoria_rota_id
WHERE v.contrato_id = ct.id
  AND ct.vistoria_rota_id IS NOT NULL
  AND v.rota_id IS NULL;