INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao)
VALUES ('categorias_veiculo_plano',
  '[{"value":"passeio","label":"Passeio"},{"value":"aplicativo","label":"Aplicativo"},{"value":"moto","label":"Moto"},{"value":"diesel","label":"Diesel"},{"value":"eletrico","label":"Elétrico"},{"value":"especial_plus","label":"Especial Plus"},{"value":"lancamento","label":"Lançamento"}]',
  'json',
  'operacional',
  'Categorias de veículo aceitas nos planos (usado no formulário de criação de plano)')
ON CONFLICT (chave) DO NOTHING;