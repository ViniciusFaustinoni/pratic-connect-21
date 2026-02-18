-- Preencher valor_fipe no sinistro com o valor do veiculo
UPDATE sinistros s
SET valor_fipe = v.valor_fipe
FROM veiculos v
WHERE s.veiculo_id = v.id
AND s.protocolo = 'SIN-20260217-0008'
AND s.valor_fipe IS NULL;

-- Copiar valor_cota_participacao para valor_participacao
UPDATE sinistros
SET valor_participacao = valor_cota_participacao
WHERE protocolo = 'SIN-20260217-0008'
AND (valor_participacao IS NULL OR valor_participacao = 0)
AND valor_cota_participacao > 0;