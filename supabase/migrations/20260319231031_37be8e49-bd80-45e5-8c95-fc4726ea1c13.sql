INSERT INTO configuracoes (chave, valor, descricao, tipo, categoria)
VALUES 
  ('substituicao_dispensa_vistoria_0km_prazo_crv_dias', '30', 'Prazo máximo em dias do CRV para dispensa de vistoria em substituição (veículo 0km)', 'numero', 'regras_venda')
ON CONFLICT (chave) DO NOTHING;

UPDATE configuracoes 
SET valor = '15' 
WHERE chave = 'substituicao_dispensa_vistoria_0km_prazo_nf_dias' AND valor = '30';