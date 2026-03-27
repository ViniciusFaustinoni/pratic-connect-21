
-- Create 2 product lines
INSERT INTO product_lines (id, name, slug, vehicle_type, display_order, is_active, sort_priority, supports_app)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', 'Proteção Veicular', 'protecao', 'car', 1, true, 1, false),
  ('a2222222-2222-2222-2222-222222222222', 'Proteção Premium', 'premium', 'car', 2, true, 2, false)
ON CONFLICT (id) DO NOTHING;

-- Create 3 test plans  
INSERT INTO planos (id, codigo, nome, descricao, tipo_uso, fipe_minima, fipe_maxima, valor_adesao, ativo, tipo_veiculo, uso, ano_minimo, product_line_id, cobertura_fipe, cota_participacao, ordem_exibicao, linha, visivel_gestao)
VALUES 
  ('b1111111-1111-1111-1111-111111111111', 'BASIC-01', 'Plano Básico', 'Proteção básica', 'passeio', 20000, 80000, 250, true, 'carro', 'particular', 2005, 'a1111111-1111-1111-1111-111111111111', 100, 3.5, 1, 'protecao', true),
  ('b2222222-2222-2222-2222-222222222222', 'STD-01', 'Plano Intermediário', 'Proteção intermediária', 'passeio', 40000, 150000, 350, true, 'carro', 'particular', 2008, 'a1111111-1111-1111-1111-111111111111', 100, 2.5, 2, 'protecao', true),
  ('b3333333-3333-3333-3333-333333333333', 'PREM-01', 'Plano Premium', 'Proteção completa', 'passeio', 60000, 300000, 500, true, 'carro', 'particular', 2010, 'a2222222-2222-2222-2222-222222222222', 100, 2.0, 3, 'premium', true)
ON CONFLICT (id) DO NOTHING;

-- Map plans to pricing lines
INSERT INTO plano_preco_map (plano_id, linha_slug, tipo_uso)
VALUES
  ('b1111111-1111-1111-1111-111111111111', 'protecao', 'particular'),
  ('b2222222-2222-2222-2222-222222222222', 'protecao', 'particular'),
  ('b3333333-3333-3333-3333-333333333333', 'premium', 'particular')
ON CONFLICT DO NOTHING;

-- Create pricing table entries (categoria must be Básico/Completo/Premium)
INSERT INTO tabelas_preco_mensalidade (linha_slug, tipo_uso, categoria, fipe_min, fipe_max, valor_mensal, regiao, is_active, combustivel_tipo)
VALUES
  ('protecao', 'particular', 'Básico', 0, 30000, 69.90, 'rio_de_janeiro', true, 'gasolina'),
  ('protecao', 'particular', 'Básico', 30001, 60000, 89.90, 'rio_de_janeiro', true, 'gasolina'),
  ('protecao', 'particular', 'Básico', 60001, 100000, 119.90, 'rio_de_janeiro', true, 'gasolina'),
  ('protecao', 'particular', 'Básico', 100001, 200000, 159.90, 'rio_de_janeiro', true, 'gasolina'),
  ('protecao', 'particular', 'Básico', 0, 30000, 69.90, 'rio_de_janeiro', true, 'flex'),
  ('protecao', 'particular', 'Básico', 30001, 60000, 89.90, 'rio_de_janeiro', true, 'flex'),
  ('protecao', 'particular', 'Básico', 60001, 100000, 119.90, 'rio_de_janeiro', true, 'flex'),
  ('protecao', 'particular', 'Básico', 100001, 200000, 159.90, 'rio_de_janeiro', true, 'flex'),
  ('premium', 'particular', 'Premium', 0, 50000, 149.90, 'rio_de_janeiro', true, 'gasolina'),
  ('premium', 'particular', 'Premium', 50001, 100000, 199.90, 'rio_de_janeiro', true, 'gasolina'),
  ('premium', 'particular', 'Premium', 100001, 300000, 279.90, 'rio_de_janeiro', true, 'gasolina'),
  ('premium', 'particular', 'Premium', 0, 50000, 149.90, 'rio_de_janeiro', true, 'flex'),
  ('premium', 'particular', 'Premium', 50001, 100000, 199.90, 'rio_de_janeiro', true, 'flex'),
  ('premium', 'particular', 'Premium', 100001, 300000, 279.90, 'rio_de_janeiro', true, 'flex'),
  ('protecao', 'particular', 'Básico', 0, 30000, 59.90, 'regiao_dos_lagos', true, 'gasolina'),
  ('protecao', 'particular', 'Básico', 30001, 60000, 79.90, 'regiao_dos_lagos', true, 'gasolina'),
  ('protecao', 'particular', 'Básico', 60001, 100000, 99.90, 'regiao_dos_lagos', true, 'gasolina'),
  ('protecao', 'particular', 'Básico', 60001, 100000, 99.90, 'regiao_dos_lagos', true, 'flex'),
  ('premium', 'particular', 'Premium', 50001, 100000, 179.90, 'regiao_dos_lagos', true, 'gasolina'),
  ('premium', 'particular', 'Premium', 50001, 100000, 179.90, 'regiao_dos_lagos', true, 'flex')
ON CONFLICT DO NOTHING;

-- Link plans to coberturas
INSERT INTO planos_coberturas (plano_id, cobertura_id, percentual_cobertura, obrigatoria)
SELECT 'b1111111-1111-1111-1111-111111111111', id, 100, true FROM coberturas WHERE ativo = true AND nome IN ('Roubo', 'Furto', 'Perda Total (PT)', 'Incêndio')
ON CONFLICT DO NOTHING;

INSERT INTO planos_coberturas (plano_id, cobertura_id, percentual_cobertura, obrigatoria)
SELECT 'b2222222-2222-2222-2222-222222222222', id, 100, true FROM coberturas WHERE ativo = true AND nome IN ('Roubo', 'Furto', 'Perda Total (PT)', 'Incêndio', 'Colisão', 'Chuva de Granizo')
ON CONFLICT DO NOTHING;

INSERT INTO planos_coberturas (plano_id, cobertura_id, percentual_cobertura, obrigatoria)
SELECT 'b3333333-3333-3333-3333-333333333333', id, 100, true FROM coberturas WHERE ativo = true
ON CONFLICT DO NOTHING;
