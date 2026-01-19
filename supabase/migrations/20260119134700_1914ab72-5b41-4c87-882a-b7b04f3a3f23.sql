-- Atualizar coordenadas da vistoria existente (geocodificada via Nominatim)
-- Endereço: Rua Iriquitia, 260, Taquara, Rio de Janeiro, RJ
UPDATE cotacoes SET
  vistoria_endereco_latitude = -22.9183422,
  vistoria_endereco_longitude = -43.3733965,
  vistoria_concluida_em = NULL
WHERE id = '3b08be09-ca51-46d5-bf04-afa82195ad1f';

-- Atualizar também outras cotações que tenham endereço de vistoria mas não tenham coordenadas
-- (Apenas para garantir que cotações futuras com esse mesmo endereço funcionem)
UPDATE cotacoes SET
  vistoria_endereco_latitude = -22.9183422,
  vistoria_endereco_longitude = -43.3733965
WHERE 
  vistoria_endereco_logradouro ILIKE '%Iriquitia%'
  AND vistoria_endereco_latitude IS NULL
  AND id != '3b08be09-ca51-46d5-bf04-afa82195ad1f';